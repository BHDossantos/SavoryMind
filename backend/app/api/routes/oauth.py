"""OAuth routes for connecting third-party services (Spotify only for now).

Flow:
  GET  /api/oauth/spotify/start      → JSON {authorize_url}
  GET  /api/oauth/spotify/callback   → 302 to frontend
  POST /api/oauth/spotify/disconnect → 204

The /start endpoint is JSON (not a 302) so the SPA can decide when to
navigate. The /callback is hit by Spotify's redirect — no auth header,
identity comes from the signed `state` JWT.
"""

from datetime import datetime, timedelta
from urllib.error import HTTPError, URLError

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from ...core.config import settings
from ...core.database import get_db
from ...core.security import get_current_user
from ...models.consumer import SocialConnection
from ...models.user import User
from ...services import spotify_service

router = APIRouter(prefix="/oauth", tags=["oauth"])


def _ensure_spotify_configured():
    if not spotify_service.is_configured():
        raise HTTPException(
            status_code=503,
            detail="Spotify integration is not configured on this server.",
        )


@router.get("/spotify/start")
def spotify_start(current_user: User = Depends(get_current_user)):
    """Returns the URL the browser should navigate to in order to begin the
    Spotify Authorization Code flow. We return JSON instead of a 302 so the
    SPA can record analytics or show a loading state before the redirect.
    """
    _ensure_spotify_configured()
    return {"authorize_url": spotify_service.build_authorize_url(current_user.id)}


@router.get("/spotify/callback")
def spotify_callback(
    request: Request,
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    """Spotify redirects here after the user grants/denies access.

    On success: persists tokens on the SocialConnection row, then 302s back
    to the frontend social page. On any error: 302s with a status query
    param so the UI can render an error toast — never returns a JSON 4xx,
    because this endpoint is reached by browser navigation, not XHR.
    """
    _ensure_spotify_configured()
    redirect_base = f"{settings.frontend_url.rstrip('/')}/consumer/social"

    if error or not code or not state:
        return RedirectResponse(url=f"{redirect_base}?spotify=error&reason={error or 'missing_params'}", status_code=302)

    try:
        user_id = spotify_service.verify_state(state)
    except ValueError:
        return RedirectResponse(url=f"{redirect_base}?spotify=error&reason=bad_state", status_code=302)

    try:
        token_response = spotify_service.exchange_code(code)
    except (HTTPError, URLError, TimeoutError):
        return RedirectResponse(url=f"{redirect_base}?spotify=error&reason=token_exchange_failed", status_code=302)

    access_token = token_response.get("access_token")
    refresh_token = token_response.get("refresh_token")
    expires_in = int(token_response.get("expires_in", 3600))
    scopes = token_response.get("scope", "")

    if not access_token:
        return RedirectResponse(url=f"{redirect_base}?spotify=error&reason=no_token", status_code=302)

    # Pull the user's display name + Spotify id so the UI can show
    # "Connected as <name>" instead of a dumb checkmark.
    try:
        profile = spotify_service.fetch_profile(access_token)
    except (HTTPError, URLError, TimeoutError):
        profile = {}

    conn = (
        db.query(SocialConnection)
        .filter(SocialConnection.user_id == user_id, SocialConnection.platform == "spotify")
        .first()
    )
    if not conn:
        conn = SocialConnection(user_id=user_id, platform="spotify")
        db.add(conn)

    conn.connected = True
    conn.access_token = access_token
    if refresh_token:
        # Spotify only returns a fresh refresh_token on the initial grant —
        # subsequent token refreshes may omit it, in which case we keep the
        # old one.
        conn.refresh_token = refresh_token
    conn.token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
    conn.scopes = scopes
    conn.username = profile.get("display_name") or profile.get("id")
    conn.profile_url = (profile.get("external_urls") or {}).get("spotify")
    conn.provider_user_id = profile.get("id")
    db.commit()

    return RedirectResponse(url=f"{redirect_base}?spotify=connected", status_code=302)


@router.post("/spotify/disconnect", status_code=204)
def spotify_disconnect(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Clears stored Spotify tokens for this user. Note: Spotify's API does
    not actually revoke the refresh token from a backend call — we just
    forget it. The user can fully revoke from spotify.com/account/apps if
    they want to terminate the third-party authorization there."""
    conn = (
        db.query(SocialConnection)
        .filter(SocialConnection.user_id == current_user.id, SocialConnection.platform == "spotify")
        .first()
    )
    if conn:
        conn.connected = False
        conn.access_token = None
        conn.refresh_token = None
        conn.token_expires_at = None
        conn.scopes = None
        conn.username = None
        conn.profile_url = None
        conn.provider_user_id = None
        db.commit()
    return None
