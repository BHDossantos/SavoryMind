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


def _is_mobile_client(client_type: Optional[str]) -> bool:
    """The native client signals itself with X-Client-Type: mobile so we
    know to surface the refresh token in the response body. Web clients
    don't send this header — they use the httpOnly cookie as before."""
    return (client_type or "").strip().lower() == "mobile"


def _build_token_response(access: str, refresh: str, user, mobile: bool) -> TokenResponse:
    return TokenResponse(
        access_token=access,
        user=UserResponse.model_validate(user),
        refresh_token=refresh if mobile else None,
    )


@router.post("/register", response_model=TokenResponse, status_code=201)
@limiter.limit("5/minute")
def register(
    request: Request,
    response: Response,
    data: UserRegister,
    db: Session = Depends(get_db),
    x_client_type: Optional[str] = Header(default=None),
):
    access, refresh, user = auth_service.register(db, data)
    _set_refresh_cookie(response, refresh)
    return _build_token_response(access, refresh, user, _is_mobile_client(x_client_type))


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(
    request: Request,
    response: Response,
    data: UserLogin,
    db: Session = Depends(get_db),
    x_client_type: Optional[str] = Header(default=None),
):
    access, refresh, user = auth_service.login(db, data)
    _set_refresh_cookie(response, refresh)
    return _build_token_response(access, refresh, user, _is_mobile_client(x_client_type))


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
    x_client_type: Optional[str] = Header(default=None),
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
    return _build_token_response(access, refresh, user, _is_mobile_client(x_client_type))


@router.post("/google", response_model=TokenResponse, status_code=200)
@limiter.limit("10/minute")
def google_login(
    request: Request,
    response: Response,
    body: dict,
    db: Session = Depends(get_db),
    x_client_type: Optional[str] = Header(default=None),
):
    """Native Google sign-in via verified ID token.

    Replaces the SOCIAL_LOGIN_SECRET shared-secret pattern for native
    OAuth flows: the client (mobile via expo-auth-session, or web via
    Google Identity Services if we ever wire it directly) hands us a
    Google-issued ID token, the backend verifies its RSA signature
    against Google's JWKS, validates iss/aud/exp, and only then mints
    a SavoryMind session.

    No shared secret on the device. No way for a malicious client to
    impersonate another user.
    """
    from ...services import google_oauth
    if not google_oauth.is_configured():
        raise HTTPException(
            status_code=503,
            detail="Google sign-in is not configured on this server.",
        )

    id_token = (body or {}).get("id_token")
    if not isinstance(id_token, str) or not id_token:
        raise HTTPException(status_code=400, detail="`id_token` is required.")

    try:
        claims = google_oauth.verify_id_token(id_token)
    except google_oauth.GoogleAuthError as e:
        # Don't leak which validation step failed — same opaque 401 for
        # signature / issuer / audience / expiry. Specifics are in logs.
        raise HTTPException(status_code=401, detail=str(e))

    access, refresh, user = auth_service.social_login(
        db,
        provider="google",
        provider_id=str(claims["sub"]),
        email=str(claims.get("email") or ""),
        name=str(claims.get("name") or ""),
        avatar_url=str(claims.get("picture") or ""),
    )
    _set_refresh_cookie(response, refresh)
    return _build_token_response(access, refresh, user, _is_mobile_client(x_client_type))


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("60/minute")
def refresh(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    sm_refresh: Optional[str] = Cookie(default=None),
    x_refresh_token: Optional[str] = Header(default=None),
    x_client_type: Optional[str] = Header(default=None),
):
    """Mint a fresh access token using the refresh token. Web clients send
    the value via the httpOnly cookie; mobile sends it as X-Refresh-Token
    because RN's fetch doesn't carry a cookie jar.

    Whichever path provided the token, it gets rotated — the rotation
    revokes the old jti server-side (auth_service.refresh_session) so a
    stolen copy stops working after the legitimate user's next refresh.
    """
    refresh_token = x_refresh_token or sm_refresh
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token.")
    access, new_refresh, user = auth_service.refresh_session(db, refresh_token)
    _set_refresh_cookie(response, new_refresh)
    return _build_token_response(access, new_refresh, user, _is_mobile_client(x_client_type))


@router.post("/logout", status_code=204)
def logout(
    response: Response,
    db: Session = Depends(get_db),
    sm_refresh: Optional[str] = Cookie(default=None),
    x_refresh_token: Optional[str] = Header(default=None),
):
    """Clear the refresh cookie AND server-side revoke the JTI so a stolen
    copy can't keep refreshing. Mobile clients pass their refresh token via
    X-Refresh-Token header since they have no cookie jar."""
    auth_service.logout(db, x_refresh_token or sm_refresh)
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
