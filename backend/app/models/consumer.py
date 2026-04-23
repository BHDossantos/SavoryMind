from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from datetime import datetime
from ..core.database import Base


class WinePairing(Base):
    __tablename__ = "wine_pairings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    dish_name = Column(String, nullable=False)
    dish_description = Column(Text, nullable=True)
    recommendations = Column(Text, nullable=False)  # JSON blob
    created_at = Column(DateTime, default=datetime.utcnow)


class MusicMood(Base):
    __tablename__ = "music_moods"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    mood = Column(String, nullable=False)
    food_type = Column(String, nullable=True)
    occasion = Column(String, nullable=True)
    recommendations = Column(Text, nullable=False)  # JSON blob
    created_at = Column(DateTime, default=datetime.utcnow)


class SocialConnection(Base):
    __tablename__ = "social_connections"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    platform = Column(String, nullable=False)  # spotify | amazon_music | alexa | instagram | tiktok
    connected = Column(Boolean, default=False)
    username = Column(String, nullable=True)
    profile_url = Column(String, nullable=True)


class BehaviorLog(Base):
    __tablename__ = "behavior_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    action_type = Column(String, nullable=False)   # wine_pairing | music_mood | view_recommendation | etc.
    action_meta = Column(Text, nullable=True)       # JSON
    created_at = Column(DateTime, default=datetime.utcnow)


class PantryItem(Base):
    __tablename__ = "pantry_items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    ingredient = Column(String(100), nullable=False)
    quantity = Column(String(50), nullable=True)    # "2 cups", "1 lb", "a handful", etc.
    category = Column(String(50), nullable=True)    # Proteins | Vegetables | Dairy | Grains | Spices | Other
    added_at = Column(DateTime, default=datetime.utcnow)
