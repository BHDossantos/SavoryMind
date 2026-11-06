import secrets
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session
from ...core.config import settings
from ...core.database import get_db
from ...core.rate_limit import limiter
from ...core.security import get_current_user
from ...models.user import User
from ...models.store_membership import StoreMembership
from ...services import store_billing

router = APIRouter(prefix='/billing/store', tags=['billing'])

@router.get('/context')
def context(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if store_billing.configured(user):
        return store_billing.sync(db, user)
    return store_billing.context(db, user)

@router.post('/sync')
@limiter.limit('10/minute')
def sync(request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return store_billing.sync(db, user)

@router.post('/webhook')
async def webhook(request: Request, authorization: str = Header(default=''), db: Session = Depends(get_db)):
    secret = settings.revenuecat_webhook_authorization
    if not secret or not secrets.compare_digest(authorization, secret):
        raise HTTPException(status_code=403, detail='Invalid webhook authorization.')
    try:
        event = (await request.json())['event']
        # Provider IDs identify candidates only: never create aliases or link
        # accounts from webhook data. Re-fetch each already-known account.
        identities = [event.get('app_user_id'), event.get('original_app_user_id')]
        for field in ('aliases', 'transferred_from', 'transferred_to'):
            values = event.get(field, [])
            if not isinstance(values, list) or len(values) > 200:
                raise ValueError('invalid identity list')
            identities.extend(values)
        identities = {value for value in identities if isinstance(value, str) and 0 < len(value) <= 36}
        if len(identities) > 20:
            raise ValueError('too many identities')
    except (ValueError, KeyError, TypeError, AttributeError):
        raise HTTPException(status_code=400, detail='Invalid event.') from None
    for value in sorted(identities):
        row = db.query(StoreMembership).filter_by(app_user_id=value).first()
        if row is not None:
            user = db.get(User, row.user_id)
            if user is not None:
                store_billing.sync(db, user)
    return {'received': True}
