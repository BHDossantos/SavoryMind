from fastapi import APIRouter, Cookie, Depends, HTTPException, Header, Request, Response
from typing import Optional
from sqlalchemy.orm import Session
from ...core.database import get_db
from ...core.config import settings
from ...core.rate_limit import limiter
from ...core.security import get_current_user
from ...schemas.auth import UserRegister, UserLogin, TokenResponse, UserResponse, ProfileUpdate, SocialLoginRequest
from ...services import auth_service
from ...models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    """Attach the refresh-token cookie to the outgoing response. The cookie is
    httpOnly + secure (in prod) so JS can never read it — eliminating the
    XSS-stealable-token risk that the prior localStorage design had.
    """
    kwargs = dict(
        key=settings.cookie_name,
        value=refresh_token,
        max_age=settings.refresh_token_expire_days * 24 * 3600,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        path=settings.cookie_path,
    )
    if settings.cookie_domain:
        kwargs["domain"] = settings.cookie_domain
    response.set_cookie(**kwargs)


def _clear_refresh_cookie(response: Response) -> None:
    kwargs = dict(
        key=settings.cookie_name,
        path=settings.cookie_path,
    )
    if settings.cookie_domain:
        kwargs["domain"] = settings.cookie_domain
    response.delete_cookie(**kwargs)


@router.post("/register", response_model=TokenResponse, status_code=201)
@limiter.limit("5/minute")
def register(request: Request, response: Response, data: UserRegister, db: Session = Depends(get_db)):
    access, refresh, user = auth_service.register(db, data)
    _set_refresh_cookie(response, refresh)
    return TokenResponse(access_token=access, user=UserResponse.model_validate(user))


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(request: Request, response: Response, data: UserLogin, db: Session = Depends(get_db)):
    access, refresh, user = auth_service.login(db, data)
    _set_refresh_cookie(response, refresh)
    return TokenResponse(access_token=access, user=UserResponse.model_validate(user))


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/social", response_model=TokenResponse, status_code=200)
@limiter.limit("10/minute")
def social_login(
    request: Request,
    response: Response,
    data: SocialLoginRequest,
    db: Session = Depends(get_db),
    x_social_secret: Optional[str] = Header(default=None),
):
    expected = settings.social_login_secret
    # In production (non-SQLite DB) the secret must always be provided and correct.
    # In local dev (SQLite) with the default secret the check is skipped for convenience.
    is_dev = "sqlite" in settings.database_url
    if not is_dev and x_social_secret != expected:
        raise HTTPException(status_code=403, detail="Invalid social login secret.")
    access, refresh, user = auth_service.social_login(
        db, data.provider, data.provider_id, data.email, data.name, data.avatar_url
    )
    _set_refresh_cookie(response, refresh)
    return TokenResponse(access_token=access, user=UserResponse.model_validate(user))


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("60/minute")
def refresh(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    sm_refresh: Optional[str] = Cookie(default=None),
):
    """Mint a fresh access token (and rotate the refresh cookie) using the
    httpOnly refresh cookie set at login. No body required.
    """
    if not sm_refresh:
        raise HTTPException(status_code=401, detail="No refresh token.")
    access, new_refresh, user = auth_service.refresh_session(db, sm_refresh)
    _set_refresh_cookie(response, new_refresh)
    return TokenResponse(access_token=access, user=UserResponse.model_validate(user))


@router.post("/logout", status_code=204)
def logout(
    response: Response,
    db: Session = Depends(get_db),
    sm_refresh: Optional[str] = Cookie(default=None),
):
    """Clear the refresh cookie AND server-side revoke the JTI so a stolen
    copy can't keep refreshing. The short-lived access token in the
    client's memory will expire on its own (≤ access_token_expire_minutes)."""
    auth_service.logout(db, sm_refresh)
    _clear_refresh_cookie(response)
    return Response(status_code=204)


@router.patch("/profile", response_model=UserResponse)
def update_profile(
    data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    payload = data.model_dump(exclude_none=True)

    # account_type is set-once. After it's chosen, only an admin flow (not this
    # endpoint) may change it — otherwise a diner/consumer could self-promote
    # to restaurant tier.
    was_no_type = current_user.account_type is None
    if "account_type" in payload and not was_no_type:
        raise HTTPException(
            status_code=403,
            detail="account_type cannot be changed after initial setup.",
        )

    for field, value in payload.items():
        if field not in ProfileUpdate.model_fields:
            continue
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)

    # First time a social user picks their account type → seed their demo data
    if was_no_type and current_user.account_type:
        auth_service._seed_for_type(db, current_user)

    return current_user
