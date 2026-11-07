import uuid
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from ..core.database import Base

class StoreMembership(Base):
    __tablename__ = 'store_memberships'
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    app_user_id = Column(String(36), nullable=False, unique=True, default=lambda: str(uuid.uuid4()))
    status = Column(String(20), nullable=False, default='unlinked')
    product_id = Column(String(128), nullable=True)
    store = Column(String(20), nullable=True)
    expires_at = Column(DateTime, nullable=True)

class StoreReceipt(Base):
    __tablename__ = 'store_receipts'
    receipt_key = Column(String(180), primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
