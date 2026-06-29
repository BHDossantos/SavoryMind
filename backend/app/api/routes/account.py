"""Account lifecycle endpoints.

Currently houses POST /api/account/delete-request — the public endpoint
behind the /legal/account-deletion web form that Play Store / App Store
review require for any app with user accounts. The endpoint accepts a
deletion request from anyone (including users who already uninstalled
the app and therefore can't log in), emails the admin, and emails the
requester a confirmation.

Why request-only (vs. instant self-service delete):
  Self-service delete from an unauthenticated endpoint is risky — a
  bad actor could enumerate and trigger deletes for arbitrary emails.
  Routing through an admin-reviewed queue + manual deletion keeps the
  blast radius small for v1. We can graduate to instant self-service
  once we add a verification step (email link with one-time token).

Rate-limited to 3/hour per IP to prevent abuse.

Response shape is intentionally identical whether the email is on file
or not — avoids leaking which addresses have SavoryMind accounts to a
random attacker probing the form.
"""
from fastapi import APIRouter, Request
from sqlalchemy.orm import Session
from fastapi import Depends

from ...core.database import get_db
from ...core.rate_limit import limiter
from ...models.user import User
from ...schemas.account import AccountDeleteRequest
from ...services import resend_client


router = APIRouter(prefix="/account", tags=["account"])


_ADMIN_NOTIFICATION_TO = "privacy@savorymind.net"


def _admin_email_html(email: str, reason: str | None, user_on_file: bool) -> str:
    """Plain HTML for the admin notification — no template engine for
    something this small. Keep it ugly + readable."""
    reason_block = (
        f"<p><strong>Reason:</strong></p><pre style='white-space:pre-wrap'>{reason}</pre>"
        if reason else
        "<p><em>(no reason provided)</em></p>"
    )
    status = "✅ MATCH — account exists" if user_on_file else "⚠️ NO MATCH — no account with this email"
    return f"""
        <h2>SavoryMind: Account Deletion Request</h2>
        <p><strong>Requester:</strong> {email}</p>
        <p><strong>Account status:</strong> {status}</p>
        {reason_block}
        <hr/>
        <p>Action required: delete the account + associated data within 30 days, then reply
        to the requester confirming deletion.</p>
    """


def _confirmation_email_html(email: str) -> str:
    """Confirmation sent to the requester. Plain language, no marketing."""
    return f"""
        <p>Hi,</p>
        <p>We've received your request to delete the SavoryMind account associated with
        <strong>{email}</strong>.</p>
        <p>We'll process it within 30 days and reply to this email address once it's done.
        If you have additional context (e.g. which account type, or which related data to
        also remove), just reply to this email.</p>
        <p>If you didn't make this request, you can safely ignore this message — no action
        will be taken without your follow-up.</p>
        <p>— Team SavoryMind</p>
    """


@router.post("/delete-request", status_code=200)
@limiter.limit("3/hour")
def request_account_deletion(
    request: Request,
    body: AccountDeleteRequest,
    db: Session = Depends(get_db),
):
    """Public deletion-request endpoint. Always returns the same shape
    regardless of whether the email is on file (avoids enumeration)."""
    email = body.email.lower().strip()
    user_on_file = db.query(User).filter(User.email == email).first() is not None

    resend_client.send_email(
        to=_ADMIN_NOTIFICATION_TO,
        subject=f"[deletion-request] {email}",
        html=_admin_email_html(email, body.reason, user_on_file),
    )
    resend_client.send_email(
        to=email,
        subject="We received your SavoryMind deletion request",
        html=_confirmation_email_html(email),
    )

    return {"ok": True, "message": "Request received. We'll process it within 30 days."}
