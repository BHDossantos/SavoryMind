"""Verified native billing through RevenueCat; never trust client entitlements."""
from datetime import datetime, timezone
from urllib.parse import quote
import httpx
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from ..core.config import settings
from ..models.user import User
from ..models.store_membership import StoreMembership, StoreReceipt


def target_plan(user):
    return 'pro' if user.account_type == 'restaurant' else 'premium'


def products(user):
    if user.account_type not in ('consumer', 'diner', 'restaurant'):
        return []
    return [sku for sku, plan in settings.revenuecat_products.items() if plan == target_plan(user)]


def configured(user):
    return bool(settings.revenuecat_secret_api_key and products(user))


def identity(db, user):
    row = db.get(StoreMembership, user.id)
    if row is None:
        row = StoreMembership(user_id=user.id)
        db.add(row)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            row = db.get(StoreMembership, user.id)
        db.refresh(row)
    return row


def apply_plan(db, user):
    row = db.get(StoreMembership, user.id)
    if row is None or row.status == 'unlinked':
        return
    if row.status == 'active' and row.expires_at and row.expires_at > datetime.utcnow():
        user.plan = target_plan(user)
    elif (user.subscription_status in ('active', 'trialing')
          and user.stripe_verified_plan == target_plan(user)
          and user.subscription_period_end
          and user.subscription_period_end > datetime.utcnow()):
        # Preserve only a separately verified, unexpired Stripe entitlement.
        # `active` can also describe an unrelated/unrecognized Stripe price.
        user.plan = user.stripe_verified_plan
    else:
        user.plan = 'free'


def context(db, user):
    row = identity(db, user)
    apply_plan(db, user)
    stripe_active = user.subscription_status in ('active', 'trialing')
    return {'enabled': configured(user), 'can_purchase': configured(user) and not stripe_active and not (row.status == 'active' and row.expires_at and row.expires_at > datetime.utcnow()),
            'app_user_id': row.app_user_id, 'products': products(user), 'plan': user.plan,
            'status': row.status, 'expires_at': row.expires_at.isoformat() if row.expires_at else None,
            'management_url': 'https://apps.apple.com/account/subscriptions' if row.store == 'app_store' else 'https://play.google.com/store/account/subscriptions' if row.store == 'play_store' else None}


def _client():
    return httpx.Client(timeout=10.0, follow_redirects=False)


def _date(value):
    if not isinstance(value, str):
        raise ValueError('missing expiry')
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        raise ValueError('missing timezone')
    return parsed.astimezone(timezone.utc).replace(tzinfo=None)


def sync(db, user):
    if not configured(user):
        raise HTTPException(status_code=503, detail='Native store verification is not configured.')
    # Serialize updates for one identity before retrieving its authoritative state.
    db.query(User).filter_by(id=user.id).populate_existing().with_for_update().one()
    row = db.query(StoreMembership).filter_by(user_id=user.id).populate_existing().with_for_update().first()
    if row is None:
        row = identity(db, user)
        # identity creation commits; reacquire before fetching provider state.
        db.query(User).filter_by(id=user.id).populate_existing().with_for_update().one()
        db.refresh(row)
    try:
        with _client() as client:
            response = client.get('https://api.revenuecat.com/v1/subscribers/' + quote(row.app_user_id, safe=''),
                                  headers={'Authorization': 'Bearer ' + settings.revenuecat_secret_api_key})
        response.raise_for_status()
        subscriptions = response.json()['subscriber']['subscriptions']
        if not isinstance(subscriptions, dict):
            raise ValueError('invalid subscriptions')
        active = []
        for sku, item in subscriptions.items():
            if sku not in products(user):
                continue
            if not isinstance(item, dict):
                raise ValueError('invalid item')
            if item.get('store') not in ('app_store', 'play_store'):
                continue
            if (not settings.revenuecat_allow_sandbox or 'sqlite' not in settings.database_url) and item.get('is_sandbox') is not False:
                continue
            expiry = _date(item.get('expires_date'))
            if item.get('grace_period_expires_date'):
                expiry = max(expiry, _date(item['grace_period_expires_date']))
            if expiry <= datetime.utcnow() or item.get('refunded_at'):
                continue
            transaction = item.get('store_transaction_id')
            if not isinstance(transaction, (str, int)) or not str(transaction) or len(str(transaction)) > 128:
                raise ValueError('invalid transaction')
            active.append((expiry, sku, item['store'], str(transaction)))
    except (httpx.HTTPError, ValueError, TypeError, KeyError, OverflowError):
        raise HTTPException(status_code=503, detail='Purchase verification is temporarily unavailable. Try restoring again; do not buy again.') from None
    if active:
        expiry, sku, store, transaction = max(active)
        receipt_key = store + ':' + transaction
        receipt = db.get(StoreReceipt, receipt_key)
        if receipt and receipt.user_id != user.id:
            raise HTTPException(status_code=409, detail='This purchase belongs to another account. Contact support before transferring it.')
        if receipt is None:
            db.add(StoreReceipt(receipt_key=receipt_key, user_id=user.id))
        row.status, row.product_id, row.store, row.expires_at = 'active', sku, store, expiry
    elif row.status != 'unlinked':
        row.status = 'expired'
    db.flush()
    apply_plan(db, user)
    db.commit()
    return {'granted': bool(active), **context(db, user)}
