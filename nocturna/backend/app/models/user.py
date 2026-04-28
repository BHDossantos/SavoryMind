from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, JSON

from app.core.db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String, nullable=True)
    name = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="user", nullable=False)  # user | admin
    lang = Column(String, default="en", nullable=False)
    home_city = Column(String, default="rome", nullable=False)
    age_range = Column(String, nullable=True)
    gender = Column(String, nullable=True)
    prefs = Column(JSON, default=dict, nullable=False)
    # prefs JSON shape:
    # {
    #   music: [], cuisines: [], budget_band: "50-100",
    #   neighborhoods: [], style: "elegant", saved_venues: []
    # }
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
