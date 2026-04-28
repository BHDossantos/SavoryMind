from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Boolean,
    DateTime,
    JSON,
    Text,
)

from app.core.db import Base


class Venue(Base):
    __tablename__ = "venues"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # restaurant|bar|club|lounge|rooftop|live_music|speakeasy|late_food
    description = Column(Text, nullable=True)
    address = Column(String, nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    neighborhood = Column(String, nullable=False, index=True)
    city = Column(String, default="rome", nullable=False, index=True)
    country = Column(String, default="IT", nullable=False)

    # Hours: { mon:[{open:"19:00",close:"02:00"}], tue:[...], ... }
    opening_hours = Column(JSON, default=dict, nullable=False)
    best_arrival_time = Column(String, nullable=True)  # "21:30"

    price_level = Column(Integer, default=2, nullable=False)  # 1..4
    avg_price_eur = Column(Integer, default=50, nullable=False)
    dress_code = Column(String, default="casual", nullable=False)  # casual|elegant|sexy|luxury|streetwear|business

    music_types = Column(JSON, default=list, nullable=False)
    crowd_types = Column(JSON, default=list, nullable=False)
    vibe_tags = Column(JSON, default=list, nullable=False)
    cuisine_tags = Column(JSON, default=list, nullable=False)

    reservation_required = Column(Boolean, default=False, nullable=False)
    walk_in_ok = Column(Boolean, default=True, nullable=False)
    vip_available = Column(Boolean, default=False, nullable=False)
    guestlist_required = Column(Boolean, default=False, nullable=False)

    contact = Column(JSON, default=dict, nullable=False)
    # { phone, whatsapp, email, instagram, website }
    photos = Column(JSON, default=list, nullable=False)
    menu_url = Column(String, nullable=True)
    booking_url = Column(String, nullable=True)
    capacity = Column(Integer, nullable=True)

    partner_status = Column(String, default="none", nullable=False)  # none|basic|pro|premium
    commission_pct = Column(Float, default=0.0, nullable=False)
    promoted = Column(Boolean, default=False, nullable=False)
    quality_score = Column(Float, default=0.7, nullable=False)  # 0..1

    best_nights = Column(JSON, default=list, nullable=False)  # ["fri","sat"]
    active = Column(Boolean, default=True, nullable=False, index=True)
    admin_notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
