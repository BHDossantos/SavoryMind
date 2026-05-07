"""Apple Sign-In ID-token verification.

Apple requires this for any iOS app that offers other social sign-in
options (App Store Review Guideline 4.8). Without it, every App Store
submission gets rejected. Mirrors google_oauth.py — verifies the
RSA-signed ID token via Apple's JWKS, validates issuer/audience/exp.

Apple-specific quirks vs Google:

  - Audience is the iOS bundle identifier (e.g. net.savorymind.app),
    NOT a separate "client ID" string. Set via APPLE_BUNDLE_ID env.

  - Apple's "Hide my email" returns a forwarded email like
    abc123@privaterelay.appleid.com. We accept these as real emails —
    they route through Apple's relay to the user's actual inbox.

  - The user's name (`given_name`, `family_name`) only appears in the
    very first sign-in payload, NOT in the id_token. The mobile client
    must capture it from response.fullName on first auth and pass it to
    the backend explicitly. Subsequent sign-ins return a token with no
    name claim — backend uses the existing user row's name.

  - email_verified is implicit (Apple verifies email at account
    creation). The claim is sometimes a string ("true") rather than a
    bool. We treat any truthy value as verified.

  - sub claim is stable per user per app — never share with other
    parties. Use it as our internal social_id.
"""
from __future__ import annotations

import logging
from typing import Optional
from urllib.error import HTTPError, URLError

import jwt
from jwt import PyJWKClient

from ..core.config import settings

logger = logging.getLogger(__name__)


APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys"
APPLE_VALID_ISSUER = "https://appleid.apple.com"

_jwks_client: Optional[PyJWKClient] = None


class AppleAuthError(Exception):
    """Raised when an ID token can't be verified. Map to HTTP 401 in the
    route handler — same opaque "log in again" UX as any other auth
    failure."""


def is_configured() -> bool:
    return bool(settings.apple_bundle_id)


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = PyJWKClient(APPLE_JWKS_URL, cache_keys=True, lifespan=300)
    return _jwks_client


def verify_id_token(id_token: str) -> dict:
    """Verify an Apple-issued ID token and return its claims.

    Validates signature (Apple's RSA via JWKS), issuer, audience
    (must equal the bundle ID), expiration. Raises AppleAuthError on
    any failure — generic message, specifics in logs.
    """
    if not is_configured():
        raise AppleAuthError("Apple sign-in is not configured on this server.")
    if not id_token or not isinstance(id_token, str):
        raise AppleAuthError("Missing or malformed id_token.")

    try:
        signing_key = _get_jwks_client().get_signing_key_from_jwt(id_token)
    except (jwt.PyJWKClientError, HTTPError, URLError, TimeoutError) as e:
        logger.warning("apple_oauth: JWKS lookup failed: %s", e)
        raise AppleAuthError("Token signing key not found.") from e

    try:
        claims = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.apple_bundle_id,
            issuer=APPLE_VALID_ISSUER,
            options={"require": ["exp", "iss", "aud", "sub"]},
        )
    except jwt.ExpiredSignatureError as e:
        raise AppleAuthError("Token expired.") from e
    except jwt.InvalidAudienceError as e:
        logger.warning(
            "apple_oauth: token audience mismatch (configured aud=%s)",
            settings.apple_bundle_id,
        )
        raise AppleAuthError("Token audience mismatch.") from e
    except jwt.InvalidIssuerError as e:
        raise AppleAuthError("Token issuer mismatch.") from e
    except jwt.InvalidTokenError as e:
        logger.warning("apple_oauth: invalid token: %s", e)
        raise AppleAuthError("Invalid token.") from e

    if not claims.get("sub"):
        raise AppleAuthError("Token missing sub claim.")

    # Apple's email_verified is sometimes a string. Normalize.
    raw_verified = claims.get("email_verified")
    is_verified = (
        raw_verified is True
        or (isinstance(raw_verified, str) and raw_verified.lower() == "true")
    )
    # Apple omits email entirely if the user revoked email sharing for
    # this app. Treat as no-email and let social_login mint a placeholder
    # like apple_<sub>@social (matching the existing pattern for social
    # users with no email).
    if not is_verified:
        # Apple does verify all emails on account creation, so an
        # unverified flag here is unusual — most likely a private-relay
        # forwarder. We trust it.
        if claims.get("email"):
            logger.info("apple_oauth: email present but unverified flag — accepting")

    return claims
