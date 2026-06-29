"""Revoked refresh-token JTIs.

When a user logs out we record the JTI of the cookie they're holding.
Subsequent /refresh attempts using that JTI return 401 instead of
silently succeeding — closing the "stolen-cookie reuse after logout"
window. Rotation also revokes the OLD JTI so a captured-then-rotated
cookie can't be replayed (token-family / replay detection lite).

Rows are pruned on every refresh by deleting WHERE expires_at < now().
At ≤ refresh_token_expire_days = 30 days of TTL the table stays
bounded by active user count × logouts/30d.
"""
from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String

from ..core.database import Base


class RefreshTokenRevocation(Base):
    __tablename__ = "refresh_token_revocations"

    # JTI is opaque uuid4 hex (32 chars) generated when the token was minted
    # in security.create_refresh_token. PK so duplicate revocations are no-ops.
    jti = Column(String(64), primary_key=True)
    # When the token would have naturally expired. Used to prune the table —
    # once a token's exp is in the past, its row is no longer load-bearing.
    expires_at = Column(DateTime, nullable=False, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    revoked_at = Column(DateTime, default=datetime.utcnow, nullable=False)
