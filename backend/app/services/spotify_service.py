"""Spotify OAuth (Authorization Code Flow) integration.

The previous implementation in this app was a UI-only stub — clicking
"Connect Spotify" stored {connected: True, username: <free-text>} with no
actual OAuth handshake. This module replaces that with a real Auth Code flow:

  1. Frontend calls GET /api/oauth/spotify/start (Bearer auth) → returns the
     Spotify authorize URL with a signed `state` JWT identifying the user.
  2. Browser redirects to Spotify → user grants → Spotify redirects to our
     /api/oauth/spotify/callback?code=&state=
  3. We exchange the code for access_token + refresh_token, fetch the
     user's Spotify profile, and persist on the SocialConnection row.
  4. We redirect the browser back to the frontend social page.

The state JWT is the CSRF defence — Spotify echoes it back, we verify the
signature and `typ` claim, and extract the user_id. Without that, an
attacker could trick a logged-in user's browser into completing OAuth for
the attacker's Spotify account, hijacking the link.
"""

import base64
import hmac
import json
import os
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

from ..core.config import settings
from ..core.security import _b64url_decode, _b64url_encode

SPOTIFY_AUTHORIZE_URL = "https://accounts.spotify.com/authorize"
SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
SPOTIFY_PROFILE_URL = "https://api.spotify.com/v1/me"
SPOTIFY_SEARCH_URL = "https://api.spotify.com/v1/search"

# Minimal scopes for the MVP. Adding playlist creation later requires
# `playlist-modify-private playlist-modify-public`. Web Playback SDK requires
# `streaming` and Spotify Premium on the user's account.
SPOTIFY_SCOPES = "user-read-private user-read-email"

STATE_TYPE = "spotify_oauth_state"


def is_configured() -> bool:
    return bool(settings.spotify_client_id and settings.spotify_client_secret)


def _sign_state(user_id: int) -> str:
    """Mint a short-lived JWT we can hand to Spotify as the `state` parameter.

    Reusing our own SECRET_KEY (HS256) avoids needing a separate Spotify
    state secret. The `typ` claim prevents the state being accepted as an
    auth/refresh token elsewhere.
    """
    import hashlib

    expire = datetime.utcnow() + timedelta(minutes=10)
    header = _b64url_encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = _b64url_encode(
        json.dumps({
            "sub": str(user_id),
            "typ": STATE_TYPE,
            "nonce": os.urandom(8).hex(),
            "exp": int(expire.timestamp()),
        }).encode()
    )
    signing_input = f"{header}.{payload}".encode()
    sig = hmac.new(settings.secret_key.encode(), signing_input, hashlib.sha256).digest()
    return f"{header}.{payload}.{_b64url_encode(sig)}"


def verify_state(state: str) -> int:
    """Return the user_id from a valid state JWT, or raise ValueError."""
    import hashlib

    try:
        header_b64, payload_b64, sig_b64 = state.split(".")
    except ValueError:
        raise ValueError("Malformed state")

    signing_input = f"{header_b64}.{payload_b64}".encode()
    expected_sig = hmac.new(settings.secret_key.encode(), signing_input, hashlib.sha256).digest()
    actual_sig = _b64url_decode(sig_b64)
    if not hmac.compare_digest(expected_sig, actual_sig):
        raise ValueError("Bad state signature")

    payload = json.loads(_b64url_decode(payload_b64))
    if payload.get("typ") != STATE_TYPE:
        raise ValueError("Wrong state type")
    if payload.get("exp", 0) < datetime.utcnow().timestamp():
        raise ValueError("State expired")
    return int(payload["sub"])


def build_authorize_url(user_id: int) -> str:
    state = _sign_state(user_id)
    params = {
        "client_id": settings.spotify_client_id,
        "response_type": "code",
        "redirect_uri": settings.spotify_redirect_uri,
        "scope": SPOTIFY_SCOPES,
        "state": state,
        # show_dialog=true so the user sees the consent screen even if
        # they've authorized this app before — useful while iterating on
        # scopes during development. Can drop in production for less
        # friction.
        "show_dialog": "false",
    }
    return f"{SPOTIFY_AUTHORIZE_URL}?{urlencode(params)}"


def _http_post_form(url: str, form: dict, headers: dict) -> dict:
    body = urlencode(form).encode()
    req = Request(url, data=body, headers={**headers, "Content-Type": "application/x-www-form-urlencoded"}, method="POST")
    with urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode())


def _http_get_json(url: str, access_token: str) -> dict:
    req = Request(url, headers={"Authorization": f"Bearer {access_token}"}, method="GET")
    with urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode())


def exchange_code(code: str) -> dict:
    """Exchange an auth code for {access_token, refresh_token, expires_in, scope}."""
    basic = base64.b64encode(
        f"{settings.spotify_client_id}:{settings.spotify_client_secret}".encode()
    ).decode()
    return _http_post_form(
        SPOTIFY_TOKEN_URL,
        {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": settings.spotify_redirect_uri,
        },
        {"Authorization": f"Basic {basic}"},
    )


def refresh_access_token(refresh_token: str) -> dict:
    """Use the stored refresh_token to mint a new access_token. Spotify may
    or may not return a new refresh_token in the response — callers must
    handle both cases.
    """
    basic = base64.b64encode(
        f"{settings.spotify_client_id}:{settings.spotify_client_secret}".encode()
    ).decode()
    return _http_post_form(
        SPOTIFY_TOKEN_URL,
        {"grant_type": "refresh_token", "refresh_token": refresh_token},
        {"Authorization": f"Basic {basic}"},
    )


def fetch_profile(access_token: str) -> dict:
    """Returns the Spotify /v1/me payload (display_name, id, email, ...)."""
    return _http_get_json(SPOTIFY_PROFILE_URL, access_token)


# ---- Higher-level helpers used by API routes ----------------------------
#
# These are deliberately kept here (rather than in oauth.py) so the rules for
# token freshness and Spotify-error mapping live with everything else
# Spotify-shaped.

# How much slack to leave before the stored access_token actually expires.
# Calling Spotify with a token that's seconds-from-expiry is a coin-flip
# between success and a 401, so we refresh anything within this window.
_TOKEN_REFRESH_LEEWAY_SECONDS = 60


class SpotifyAuthError(Exception):
    """Raised when the user's Spotify connection is no longer usable
    (refresh token rejected, missing tokens, etc.). API routes should
    surface this as 401 so the UI can prompt the user to reconnect.
    """


def get_fresh_access_token(db, conn) -> str:
    """Return a non-expired access_token for `conn`, refreshing via the
    stored refresh_token if needed. Mutates and commits `conn` so the next
    call won't refresh again until close to expiry.

    Raises SpotifyAuthError if the connection lacks tokens or Spotify
    rejects the refresh — the row is marked disconnected so the UI shows
    the "Connect Spotify" CTA again.
    """
    if not conn or not conn.access_token:
        raise SpotifyAuthError("Spotify is not connected.")

    now = datetime.utcnow()
    expires_at = conn.token_expires_at
    if expires_at and expires_at - now > timedelta(seconds=_TOKEN_REFRESH_LEEWAY_SECONDS):
        return conn.access_token

    if not conn.refresh_token:
        # Token is expired and we have no way to refresh — full reconnect.
        conn.connected = False
        db.commit()
        raise SpotifyAuthError("Spotify session expired — please reconnect.")

    try:
        refreshed = refresh_access_token(conn.refresh_token)
    except (HTTPError, URLError, TimeoutError) as e:
        # Network / Spotify-side failure. Don't mark disconnected — likely
        # transient. Caller will get a 502 from the route layer.
        raise SpotifyAuthError(f"Spotify token refresh failed: {e}") from e

    new_access = refreshed.get("access_token")
    if not new_access:
        # Spotify accepted the request but didn't return a token — usually
        # means the refresh token itself was revoked. Force reconnect.
        conn.connected = False
        conn.access_token = None
        conn.refresh_token = None
        conn.token_expires_at = None
        db.commit()
        raise SpotifyAuthError("Spotify refresh token was rejected — please reconnect.")

    conn.access_token = new_access
    if refreshed.get("refresh_token"):
        # Spotify only sometimes rotates the refresh token; keep the old one
        # if not. If it does rotate, store the new one.
        conn.refresh_token = refreshed["refresh_token"]
    expires_in = int(refreshed.get("expires_in", 3600))
    conn.token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
    if refreshed.get("scope"):
        conn.scopes = refreshed["scope"]
    db.commit()
    return new_access


def search_tracks(access_token: str, query: str, limit: int = 20) -> list[dict]:
    """Search Spotify for tracks matching `query`. Returns a normalized list
    of {id, name, artists, album, album_image, preview_url, external_url,
    uri, duration_ms}, capped at `limit` (Spotify max 50).
    """
    limit = max(1, min(int(limit or 20), 50))
    url = f"{SPOTIFY_SEARCH_URL}?{urlencode({'q': query, 'type': 'track', 'limit': limit})}"
    payload = _http_get_json(url, access_token)
    items = (payload.get("tracks") or {}).get("items") or []
    out = []
    for t in items:
        if not t:
            continue
        album = t.get("album") or {}
        images = album.get("images") or []
        out.append({
            "id": t.get("id"),
            "name": t.get("name"),
            "artists": [a.get("name") for a in (t.get("artists") or []) if a],
            "album": album.get("name"),
            "album_image": images[0]["url"] if images else None,
            "preview_url": t.get("preview_url"),
            "external_url": (t.get("external_urls") or {}).get("spotify"),
            "uri": t.get("uri"),
            "duration_ms": t.get("duration_ms"),
        })
    return out
