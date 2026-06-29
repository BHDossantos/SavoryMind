"""Google ID-token verification.

Replaces the SOCIAL_LOGIN_SECRET shared-secret approach for native
mobile / first-party OAuth. The previous flow had the backend trust
any caller that knew the secret with whatever profile data they
claimed — fine when only the Next.js server-side bridge held the
secret, but terrible if the secret ever ships to a client. This
module instead verifies the Google-signed ID token cryptographically:

  1. Fetch Google's public keys from their JWKS endpoint (cached).
  2. Find the key matching the token's `kid` header.
  3. Verify the JWT signature with that RSA public key.
  4. Validate `iss`, `aud`, and `exp` claims.
  5. Return the verified claims (sub, email, name, picture).

If any step fails the caller gets a generic GoogleAuthError — the
specific reason is logged but never surfaced to the client (don't
leak signature-validation internals to potential attackers).
"""
import logging
import time
from typing import Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
import json

import jwt
from jwt import PyJWKClient

from ..core.config import settings

logger = logging.getLogger(__name__)

GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
# Both forms appear in real Google ID tokens depending on the client type
# and how Google rotates issuers — accept either.
GOOGLE_VALID_ISSUERS = ("https://accounts.google.com", "accounts.google.com")

# Cache the JWKS client across requests. Google rotates keys ~daily and
# PyJWKClient handles its own caching (default 5 min TTL), so we just
# need to avoid re-creating the client object per request.
_jwks_client: Optional[PyJWKClient] = None


class GoogleAuthError(Exception):
    """Raised when an ID token can't be verified. Caller should map to
    HTTP 401 — the frontend's response is always "log in again", same
    as any other auth failure."""


def is_configured() -> bool:
    return bool(settings.google_client_id)


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        # cache_keys=True is the lib default but worth being explicit —
        # without it, every request re-fetches the JWKS (cheap but adds
        # a couple hundred ms of network).
        _jwks_client = PyJWKClient(GOOGLE_JWKS_URL, cache_keys=True, lifespan=300)
    return _jwks_client


def verify_id_token(id_token: str) -> dict:
    """Verify a Google-issued ID token and return its claims.

    Validates: signature (RSA via Google's JWKS), issuer, audience
    (must equal settings.google_client_id), expiration. Raises
    GoogleAuthError on any failure with a generic message — the
    specific reason is in the server logs.
    """
    if not is_configured():
        raise GoogleAuthError("Google sign-in is not configured on this server.")
    if not id_token or not isinstance(id_token, str):
        raise GoogleAuthError("Missing or malformed id_token.")

    try:
        # PyJWKClient extracts the kid header and pulls the matching
        # signing key from Google's JWKS. Errors here cover unknown kid,
        # network failures, malformed JWT.
        signing_key = _get_jwks_client().get_signing_key_from_jwt(id_token)
    except (jwt.PyJWKClientError, HTTPError, URLError, TimeoutError) as e:
        logger.warning("google_oauth: JWKS lookup failed: %s", e)
        raise GoogleAuthError("Token signing key not found.") from e

    try:
        claims = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.google_client_id,
            issuer=GOOGLE_VALID_ISSUERS,
            # PyJWT validates exp by default; explicit for clarity.
            options={"require": ["exp", "iss", "aud", "sub"]},
        )
    except jwt.ExpiredSignatureError as e:
        raise GoogleAuthError("Token expired.") from e
    except jwt.InvalidAudienceError as e:
        # Most often "wrong CLIENT_ID configured" — log so ops can fix.
        logger.warning("google_oauth: token audience mismatch (configured aud=%s)", settings.google_client_id)
        raise GoogleAuthError("Token audience mismatch.") from e
    except jwt.InvalidIssuerError as e:
        raise GoogleAuthError("Token issuer mismatch.") from e
    except jwt.InvalidTokenError as e:
        # Catch-all for signature mismatch, malformed payload, missing claims.
        logger.warning("google_oauth: invalid token: %s", e)
        raise GoogleAuthError("Invalid token.") from e

    # Belt-and-braces: PyJWT already validated these but the caller may
    # rely on their presence and the explicit check makes the contract clear.
    if not claims.get("sub"):
        raise GoogleAuthError("Token missing sub claim.")
    if not claims.get("email_verified", False):
        # Google sometimes issues tokens for unverified addresses (e.g.
        # OIDC flows from Workspace tenants). For our use case we treat
        # an unverified email as no-email and let the social_login flow
        # create the account using the sub as the unique identifier.
        # We don't reject — just clear email so it doesn't get linked
        # to an existing account that happens to use the same address.
        logger.info("google_oauth: token has unverified email, treating as no-email")
        claims["email"] = ""
    return claims
