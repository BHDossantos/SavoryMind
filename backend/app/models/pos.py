"""POS connection model — encrypted OAuth tokens + sync state.

One row per restaurant per provider (Square to start). Tokens are
Fernet-encrypted at rest via EncryptedText, same pattern as
SocialConnection's Spotify tokens.
"""
from datetime import datetime

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey

from ..core.database import Base
from ..core.encrypted_field import EncryptedText


class POSConnection(Base):
    __tablename__ = "pos_connections"

    id               = Column(Integer, primary_key=True, index=True)
    user_id          = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    provider         = Column(String(20), nullable=False, default="square", server_default="square")
    merchant_id      = Column(String(120), nullable=True)
    merchant_name    = Column(String(200), nullable=True)
    access_token     = Column(EncryptedText, nullable=True)
    refresh_token    = Column(EncryptedText, nullable=True)
    token_expires_at = Column(DateTime, nullable=True)
    connected        = Column(Boolean, nullable=False, default=False, server_default="0")
    last_synced_at   = Column(DateTime, nullable=True)
    last_sync_stats  = Column(Text, nullable=True)   # JSON: {items, orders, revenue}
    created_at       = Column(DateTime, default=datetime.utcnow, nullable=False)
