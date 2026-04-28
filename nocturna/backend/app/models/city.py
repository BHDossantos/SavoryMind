from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, JSON, Boolean, Float

from app.core.db import Base


class City(Base):
    __tablename__ = "cities"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    country = Column(String, nullable=False)
    timezone = Column(String, default="Europe/Rome", nullable=False)
    currency = Column(String, default="EUR", nullable=False)
    center_lat = Column(Float, nullable=False)
    center_lng = Column(Float, nullable=False)
    neighborhoods = Column(JSON, default=list, nullable=False)  # ["Centro","Trastevere",...]
    nightlife_window = Column(JSON, default=dict, nullable=False)
    # { dinner:["19:30","22:30"], aperitivo:["18:30","20:30"], bar:["22:00","01:30"], club:["23:30","04:30"], late_food:["02:00","05:00"] }
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
