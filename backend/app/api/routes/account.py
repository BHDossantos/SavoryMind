"""Durable account deletion intake with separate identity and completion states.

Authenticated requests bind to the session user, never a supplied email. Public
requests require a short-lived email token before entering the actionable queue.
Mail is notification only: delivery failure cannot discard a committed request.
No endpoint claims that a request has erased data or cancelled a subscription.
"""
from datetime import datetime, timedelta
from hashlib import sha256
from html import escape
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ...core.config import settings
from ...core.database import get_db
from ...core.rate_limit import limiter
from ...core.security import get_current_user
from ...models.user import User
from ...models.account_deletion import AccountDeletionRequest
from ...schemas.account import AccountDeleteRequest
from ...services import resend_client

router = APIRouter(prefix='/account', tags=['account'])
_ADMIN_NOTIFICATION_TO = 'privacy@savorymind.net'


class VerifyDeletion(BaseModel):
    token: str = Field(min_length=32, max_length=128)


class AuthenticatedDeletion(BaseModel):
    reason: str | None = Field(default=None, max_length=1000)


def _request_row(db: Session, email: str) -> AccountDeletionRequest:
    row = db.query(AccountDeletionRequest).filter_by(email=email).first()
    if row is not None:
        return row
    row = AccountDeletionRequest(email=email)
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return db.query(AccountDeletionRequest).filter_by(email=email).one()
    db.refresh(row)
    return row


def _notify(db: Session, row: AccountDeletionRequest) -> None:
    if row.notification_sent_at is not None:
        return
    # No unverified identity or user free text is sent to an operator as an
    # actionable deletion instruction. The authenticated database queue is truth.
    if resend_client.send_email(to=_ADMIN_NOTIFICATION_TO, subject='Verified deletion request pending review',
                                html=f'<p>Verified deletion request {escape(row.id)} is pending in the database queue. Review applicable retention and provider cleanup before completing it.</p>'):
        row.notification_sent_at = datetime.utcnow()
        db.commit()


def _payload(row: AccountDeletionRequest) -> dict:
    return {'ok': True, 'request_id': row.id, 'status': row.status,
            'message': 'Your verified deletion request is saved for review. Deletion has not been confirmed. This does not cancel a subscription.'}


@router.post('/deletion', status_code=200)
@limiter.limit('3/hour')
def authenticated_deletion(request: Request, body: AuthenticatedDeletion,
                           user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = _request_row(db, user.email.lower().strip())
    if row.user_id is not None and row.user_id != user.id:
        raise HTTPException(status_code=409, detail='An earlier request needs privacy-team review before another can be submitted.')
    if row.status == 'awaiting_verification' or row.user_id is None:
        row.user_id = user.id
        row.reason = body.reason
        row.status = 'pending_review'
        row.verified_at = datetime.utcnow()
        row.verification_hash = None
        row.verification_expires_at = None
        db.commit()
    _notify(db, row)
    return _payload(row)


@router.get('/deletion')
def deletion_status(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.query(AccountDeletionRequest).filter_by(user_id=user.id).order_by(AccountDeletionRequest.created_at.desc()).first()
    return _payload(row) if row else {'status': 'none'}


@router.post('/delete-request', status_code=200)
@limiter.limit('3/hour')
def request_account_deletion(request: Request, body: AccountDeleteRequest, db: Session = Depends(get_db)):
    row = _request_row(db, body.email.lower().strip())
    token = secrets.token_urlsafe(32)
    # A public request cannot reset a verified request or alter its reason.
    if row.status == 'awaiting_verification':
        row.reason = body.reason
        row.verification_hash = sha256(token.encode()).hexdigest()
        row.verification_expires_at = datetime.utcnow() + timedelta(hours=24)
        db.commit()
        # Fragment tokens are not sent to web server access logs. Opening the
        # page never confirms a request; the recipient must press Confirm.
        url = settings.frontend_url.rstrip('/') + '/legal/account-deletion#token=' + token
        html = f'<p>Confirm your account deletion request by opening <a href="{escape(url, quote=True)}">this verification page</a> and pressing Confirm. This link expires in 24 hours. Opening it alone does not confirm or delete anything.</p><p>If you did not request deletion, ignore this email. No deletion request becomes actionable without verification.</p>'
    else:
        html = '<p>A verified deletion request is already saved for this address. This message does not confirm completed deletion or a processing deadline.</p>'
    delivered = resend_client.send_email(to=body.email, subject='Verify your SavoryMind deletion request', html=html)
    if not delivered:
        raise HTTPException(status_code=503, detail='Your request is saved, but the verification email could not be sent. Please retry later or use the signed-in account deletion option.')
    # Same shape for existing/nonexistent accounts; no account lookup until
    # possession of the email token has been proved.
    return {'ok': True, 'message': 'Check your email for the next step. Deletion has not been confirmed.'}


@router.post('/delete-request/verify', status_code=200)
@limiter.limit('10/hour')
def verify_deletion(request: Request, body: VerifyDeletion, db: Session = Depends(get_db)):
    row = db.query(AccountDeletionRequest).filter_by(verification_hash=sha256(body.token.encode()).hexdigest()).with_for_update().first()
    if row is None or row.verification_expires_at is None or row.verification_expires_at <= datetime.utcnow() or row.status != 'awaiting_verification':
        raise HTTPException(status_code=400, detail='This verification link is invalid, expired, or already used. Request a new link if needed.')
    user = db.query(User).filter_by(email=row.email).first()
    row.user_id = user.id if user else None
    row.verified_at = datetime.utcnow()
    row.status = 'pending_review'
    row.verification_hash = None
    row.verification_expires_at = None
    db.commit()
    _notify(db, row)
    return {'ok': True, 'status': 'pending_review', 'message': 'Your verified request is saved for review. Deletion has not been confirmed.'}
