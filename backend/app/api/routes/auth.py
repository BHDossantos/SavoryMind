from fastapi import APIRouter, Cookie, Depends, HTTPException, Header, Request, Response
from typing import Optional
from sqlalchemy.orm import Session
from ...core.database import get_db
from ...core.config import settings
from ...core.rate_limit import limiter
from ...core.security import get_current_user
from ...schemas.auth import UserRegister, UserLogin, TokenResponse, UserResponse, ProfileUpdate, SocialLoginRequest, AppleLoginRequest
from ...services import auth_service, posthog_client
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
    # Identify the new user + capture the signup event. Both no-op when
    # POSTHOG_API_KEY is unset. Privacy-safe traits only — no email/name.
    posthog_client.identify(user.id, {
        "account_type": user.account_type,
        "client_type":  "mobile" if _is_mobile_client(x_client_type) else "web",
    })
    posthog_client.capture(user.id, "signup_completed", {
        "account_type": user.account_type,
        "method":       "email_password",
    })
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
    posthog_client.capture(user.id, "login_completed", {
        "account_type": user.account_type,
        "method":       "email_password",
        "client_type":  "mobile" if _is_mobile_client(x_client_type) else "web",
    })
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
    posthog_client.capture(user.id, "login_completed", {
        "account_type": user.account_type,
        "method":       "google",
        "client_type":  "mobile" if _is_mobile_client(x_client_type) else "web",
    })
    return _build_token_response(access, refresh, user, _is_mobile_client(x_client_type))


@router.post("/apple", response_model=TokenResponse, status_code=200)
@limiter.limit("10/minute")
def apple_login(
    request: Request,
    response: Response,
    body: AppleLoginRequest,
    db: Session = Depends(get_db),
    x_client_type: Optional[str] = Header(default=None),
):
    """Native Sign in with Apple via verified ID token.

    iOS only — required by Apple App Store Review Guideline 4.8 since
    we offer Google sign-in. Web doesn't use this path.

    Body validated by `AppleLoginRequest`. Apple ONLY includes name +
    email in the response payload (not in the id_token claims) and
    ONLY on the very first sign-in. Subsequent sign-ins legitimately
    send only id_token — backend then uses the existing user row's
    data. The mobile client is responsible for capturing name + email
    from `response.fullName` / `response.email` on first auth and
    passing them here, because Apple shows the prompt exactly once.
    """
    from ...services import apple_oauth
    if not apple_oauth.is_configured():
        raise HTTPException(
            status_code=503,
            detail="Apple sign-in is not configured on this server.",
        )

    try:
        claims = apple_oauth.verify_id_token(body.id_token)
    except apple_oauth.AppleAuthError as e:
        raise HTTPException(status_code=401, detail=str(e))

    # Apple's id_token may contain email if the user shared it with the
    # app on first sign-in, OR it may be omitted entirely if they
    # revoked email sharing. Body-supplied email wins (it's what Apple
    # gave us in the auth response on first sign-in), with token-claim
    # email as fallback. Apple-private-relay emails
    # (xxxxx@privaterelay.appleid.com) are real, deliverable, and
    # Apple-verified — treat them like any other.
    body_email  = (body.email or "").strip()
    body_name   = (body.name or "").strip()
    claim_email = str(claims.get("email") or "").strip()
    email = body_email or claim_email

    # Defense-in-depth: mirror google_oauth's behavior — if the token's
    # email_verified flag is false, treat as no-email rather than letting
    # an unverified address get linked to an existing SavoryMind account
    # of the same address. Apple normally verifies all addresses at
    # account creation, so this branch should be rare; when it does fire,
    # social_login mints a placeholder apple_<sub>@social user.
    raw_verified = claims.get("email_verified")
    is_verified = (
        raw_verified is True
        or (isinstance(raw_verified, str) and raw_verified.lower() == "true")
        or raw_verified is None  # Apple sometimes omits the claim entirely
    )
    if not is_verified and email == claim_email:
        # Token said unverified AND we're using the token's email. Drop
        # it so social_login mints a placeholder rather than linking.
        email = ""

    access, refresh, user = auth_service.social_login(
        db,
        provider="apple",
        provider_id=str(claims["sub"]),
        email=email,
        name=body_name,
        avatar_url="",  # Apple doesn't provide avatar
    )
    _set_refresh_cookie(response, refresh)
    posthog_client.capture(user.id, "login_completed", {
        "account_type": user.account_type,
        "method":       "apple",
        "client_type":  "mobile" if _is_mobile_client(x_client_type) else "web",
    })
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

    # Snapshot the pre-PATCH state so we can detect the
    # onboarding-completed transition and fire the welcome email exactly
    # once. `onboarding_completed` is nullable; treat None as False.
    was_onboarding_complete = bool(current_user.onboarding_completed)

    for field, value in payload.items():
        if field not in ProfileUpdate.model_fields:
            continue
        setattr(current_user, field, value)

    # Generate the public booking slug as soon as a restaurant has a name —
    # idempotent and skipped for consumer/diner accounts. Restaurants share
    # this link with their existing diners (savorymind.net/r/{slug}) so they
    # can book without creating an account.
    from ...services.slug_service import ensure_restaurant_slug
    ensure_restaurant_slug(db, current_user)

    # Welcome email — fires exactly when a restaurant transitions from
    # incomplete → complete onboarding. The slug call above guarantees a
    # link to put in the email.
    if (
        current_user.account_type == "restaurant"
        and not was_onboarding_complete
        and current_user.onboarding_completed
    ):
        from ...services.welcome_email import send_restaurant_welcome
        send_restaurant_welcome(current_user)

    db.commit()
    db.refresh(current_user)

    # First time a social user picks their account type → seed their demo data
    if was_no_type and current_user.account_type:
        auth_service._seed_for_type(db, current_user)

    return current_user
