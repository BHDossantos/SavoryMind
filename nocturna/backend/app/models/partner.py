from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON

from app.core.db import Base


class PartnerProfile(Base):
    __tablename__ = "partner_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    venue_ids = Column(JSON, default=list, nullable=False)
    company_name = Column(String, nullable=True)
    contact_phone = Column(String, nullable=True)
    contact_whatsapp = Column(String, nullable=True)
    push_token = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
