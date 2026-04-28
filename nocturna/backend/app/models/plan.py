from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, JSON, Float, ForeignKey, Text

from app.core.db import Base


class Plan(Base):
    __tablename__ = "plans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    share_token = Column(String, unique=True, index=True, nullable=True)

    city = Column(String, default="rome", nullable=False)
    requested_for = Column(DateTime, nullable=False)
    group_size = Column(Integer, default=2, nullable=False)
    group_type = Column(String, default="friends", nullable=False)
    # solo|date|friends|mixed|bachelor|bachelorette|business|celebration|birthday

    budget_per_person = Column(Integer, default=75, nullable=False)
    budget_band = Column(String, default="50-100", nullable=False)
    # 25-50|50-100|100-200|200+|vip-500+|vip-1000+|vip-2000+|custom

    vibe_tags = Column(JSON, default=list, nullable=False)
    music_pref = Column(JSON, default=list, nullable=False)
    cuisine_pref = Column(JSON, default=list, nullable=False)
    style = Column(String, default="casual", nullable=False)
    neighborhood_pref = Column(JSON, default=list, nullable=False)
    intent = Column(String, default="dinner_drinks", nullable=False)
    # dinner|drinks|dancing|date_night|vip_table|live_music|aperitivo|meet_people|luxury|budget|surprise

    # generated: ordered list:
    # [{venue_id, slot, slot_start, slot_end, role, summary, score, travel_to_next_min}]
    generated = Column(JSON, default=list, nullable=False)
    plan_label = Column(String, nullable=True)
    estimated_cost_eur = Column(Integer, default=0, nullable=False)
    total_travel_min = Column(Integer, default=0, nullable=False)
    vibe_score = Column(Float, default=0.0, nullable=False)
    notes = Column(Text, nullable=True)

    status = Column(String, default="draft", nullable=False)
    # draft|shared|booked|completed|cancelled

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
