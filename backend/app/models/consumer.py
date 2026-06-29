from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from datetime import datetime
from ..core.database import Base
from ..core.encrypted_field import EncryptedText


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
    platform = Column(String, nullable=False)  # spotify (others removed — no viable OAuth)
    connected = Column(Boolean, default=False)
    username = Column(String, nullable=True)
    profile_url = Column(String, nullable=True)
    # OAuth tokens for real provider integrations (currently only Spotify
    # actually populates these). Encrypted at rest via Fernet — see
    # app/core/encrypted_field.py. The DB column remains TEXT, only the
    # value format changed, so no schema migration is needed.
    access_token = Column(EncryptedText, nullable=True)
    refresh_token = Column(EncryptedText, nullable=True)
    token_expires_at = Column(DateTime, nullable=True)
    scopes = Column(String, nullable=True)
    provider_user_id = Column(String, nullable=True)  # e.g. Spotify user URI/id


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
    quantity = Column(String(50), nullable=True)
    category = Column(String(50), nullable=True)
    added_at = Column(DateTime, default=datetime.utcnow)


class MealMemory(Base):
    __tablename__ = "meal_memories"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    dish_name = Column(String(150), nullable=False)
    emoji = Column(String(10), nullable=True, default="🍽️")
    rating = Column(Integer, nullable=False, default=5)        # 1-5
    notes = Column(Text, nullable=True)
    what_id_change = Column(Text, nullable=True)
    cuisine = Column(String(100), nullable=True)
    cooked_at = Column(DateTime, default=datetime.utcnow)
    recipe_id = Column(Integer, nullable=True)                 # optional link back to recipe
