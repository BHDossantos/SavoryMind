from typing import Optional, Any
from pydantic import BaseModel
from datetime import datetime


class WinePairingRequest(BaseModel):
    dish_name: str
    dish_description: Optional[str] = None


class WineRecommendation(BaseModel):
    name: str
    style: str
    confidence: float
    rationale: str
    flavor_profile: str
    regions: list[str]
    price_range: str
    serving_temp: str
    decant: bool
    decant_time: Optional[str] = None


class WinePairingResponse(BaseModel):
    id: int
    dish_name: str
    recommendations: list[WineRecommendation]
    created_at: datetime

    model_config = {"from_attributes": True}


class MusicMoodRequest(BaseModel):
    mood: str          # romantic | celebratory | casual | focused | melancholy | energetic
    food_type: str     # light | rich | spicy | sweet | umami | neutral
    occasion: str      # date_night | dinner_party | solo | family | work_lunch | brunch


class MusicRecommendation(BaseModel):
    genres: list[str]
    artists: list[str]
    bpm_range: str
    vibe: str
    spotify_query: str


class MusicMoodResponse(BaseModel):
    id: int
    mood: str
    food_type: str
    occasion: str
    recommendations: MusicRecommendation
    created_at: datetime

    model_config = {"from_attributes": True}


class SocialConnectionUpdate(BaseModel):
    platform: str
    connected: bool
    username: Optional[str] = None
    profile_url: Optional[str] = None


class SocialConnectionResponse(BaseModel):
    id: int
    platform: str
    connected: bool
    username: Optional[str]
    profile_url: Optional[str]

    model_config = {"from_attributes": True}


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None


class BehaviorLogCreate(BaseModel):
    action_type: str
    metadata: Optional[dict] = None


class PantryItemCreate(BaseModel):
    ingredient: str
    quantity: Optional[str] = None
    category: Optional[str] = "Other"


class PantryItemResponse(BaseModel):
    id: int
    ingredient: str
    quantity: Optional[str]
    category: Optional[str]
    added_at: datetime

    model_config = {"from_attributes": True}


class MealMemoryCreate(BaseModel):
    dish_name: str
    emoji: Optional[str] = "🍽️"
    rating: int = 5
    notes: Optional[str] = None
    what_id_change: Optional[str] = None
    cuisine: Optional[str] = None
    recipe_id: Optional[int] = None


class MealMemoryResponse(BaseModel):
    id: int
    dish_name: str
    emoji: Optional[str]
    rating: int
    notes: Optional[str]
    what_id_change: Optional[str]
    cuisine: Optional[str]
    cooked_at: datetime
    recipe_id: Optional[int]

    model_config = {"from_attributes": True}
