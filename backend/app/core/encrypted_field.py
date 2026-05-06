"""SQLAlchemy column types for encrypting sensitive values at rest.

Used for OAuth tokens (access + refresh) on SocialConnection so a database
dump or read-replica leak doesn't immediately surface usable credentials
for third-party services. Encryption is symmetric (Fernet / AES-128-CBC +
HMAC-SHA256), keyed by `settings.token_encryption_key`. Decryption failures
return None rather than raising, so:

  - Existing plaintext rows from before this migration silently become
    "no token" and the user is prompted to reconnect on next use,
  - Ciphertext encrypted with a different key (e.g. key rotation gone
    wrong) doesn't crash the app — it just degrades to a reconnect prompt.

Trade-off: an attacker who steals both the database and the encryption
key still wins. Real defence-in-depth would put the key in KMS / Secret
Manager and decrypt JIT. That's the next step after this lands.
"""
from __future__ import annotations

from typing import Optional

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy.types import Text, TypeDecorator

from .config import settings

_fernet: Optional[Fernet] = None


def _get_fernet() -> Fernet:
    """Lazily build the Fernet instance so a misconfigured key fails on
    first use rather than at import time (which would break Alembic, tests,
    and any tooling that imports models without needing crypto)."""
    global _fernet
    if _fernet is None:
        key = settings.token_encryption_key
        if not key:
            raise RuntimeError(
                "TOKEN_ENCRYPTION_KEY is not set. Generate one with "
                "`python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\"` "
                "and set it as an env var."
            )
        try:
            _fernet = Fernet(key.encode() if isinstance(key, str) else key)
        except (ValueError, TypeError) as e:
            raise RuntimeError(
                f"TOKEN_ENCRYPTION_KEY is not a valid Fernet key: {e}. "
                "Must be 32 url-safe base64-encoded bytes."
            ) from e
    return _fernet


class EncryptedText(TypeDecorator):
    """Text column that encrypts on write and decrypts on read.

    Storage layer remains TEXT, so no schema migration is needed when
    swapping a plain Text column for this — only the data values change
    format on next write. Pre-existing plaintext values are treated as
    decryption failures (return None) and replaced on next write.
    """

    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if not isinstance(value, str):
            value = str(value)
        return _get_fernet().encrypt(value.encode("utf-8")).decode("ascii")

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        try:
            return _get_fernet().decrypt(value.encode("ascii")).decode("utf-8")
        except (InvalidToken, ValueError, UnicodeDecodeError):
            # Plaintext leftover, key rotation, or bit-flip — fail soft.
            return None
