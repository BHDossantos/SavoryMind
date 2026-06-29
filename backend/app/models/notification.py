from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from datetime import datetime
from ..core.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    message    = Column(String, nullable=False)
    link       = Column(String, nullable=True)   # e.g. "/diner/book"
    read       = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
