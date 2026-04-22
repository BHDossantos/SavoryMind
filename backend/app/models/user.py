from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, Float
from datetime import datetime
from ..core.database import Base


class User(Base):
    __tablename__ = "users"

    id               = Column(Integer, primary_key=True, index=True)
    email            = Column(String, unique=True, nullable=False, index=True)
    password_hash    = Column(String, nullable=True)   # null for social-only accounts
    social_provider  = Column(String(50),  nullable=True)  # google | github | microsoft | etc.
    social_id        = Column(String(255), nullable=True)
    account_type     = Column(String, default="restaurant")  # "consumer" | "restaurant" | "diner"
    display_name     = Column(String, nullable=False)
    restaurant_name  = Column(String, nullable=True)
    plan             = Column(String, default="free")
    bio              = Column(Text, nullable=True)
    avatar_url       = Column(String, nullable=True)
    created_at       = Column(DateTime, default=datetime.utcnow)

    # Personal info
    first_name       = Column(String(100), nullable=True)
    last_name        = Column(String(100), nullable=True)

    # Location (worldwide)
    city             = Column(String(150), nullable=True)
    country          = Column(String(100), nullable=True)
    latitude         = Column(Float, nullable=True)
    longitude        = Column(Float, nullable=True)

    # Preferences stored as JSON strings
    music_genres        = Column(Text, nullable=True)  # ["Jazz","Pop",...]
    cuisine_preferences = Column(Text, nullable=True)  # ["Italian","Japanese",...]
    dietary_preferences = Column(Text, nullable=True)  # ["Vegetarian","Gluten-Free",...]
    drinking_habits     = Column(Text, nullable=True)  # {"wine":"often","beer":"never",...}
    recipe_interests    = Column(Text, nullable=True)  # ["Quick meals","Desserts",...]

    # Onboarding gate
    onboarding_completed = Column(Boolean, default=False)
