from sqlalchemy import Column, Integer, String, DateTime, Text
from datetime import datetime
from ..core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    account_type = Column(String, default="restaurant")  # "consumer" | "restaurant"
    display_name = Column(String, nullable=False)        # consumer name OR restaurant name
    restaurant_name = Column(String, nullable=True)      # restaurants only
    plan = Column(String, default="free")
    bio = Column(Text, nullable=True)
    avatar_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
