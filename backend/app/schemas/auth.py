from typing import Optional
from pydantic import BaseModel, Field, field_validator


class SocialLoginRequest(BaseModel):
    provider:    str = Field(min_length=1, max_length=50)
    provider_id: str = Field(min_length=1, max_length=255)
    email:       str = Field(default="", max_length=150)
    name:        str = Field(default="", max_length=100)
    avatar_url:  str = Field(default="", max_length=500)


class UserRegister(BaseModel):
    email:        str = Field(min_length=5, max_length=150)
    password:     str = Field(min_length=6, max_length=100)
    account_type: str = Field(default="restaurant")
    display_name: str = Field(min_length=2, max_length=100)

    @field_validator("account_type")
    @classmethod
    def validate_account_type(cls, v: str) -> str:
        if v not in ("consumer", "restaurant", "diner", "staff"):
            raise ValueError("account_type must be 'consumer', 'restaurant', 'diner', or 'staff'")
        return v


class UserLogin(BaseModel):
    email:    str
    password: str


class UserResponse(BaseModel):
    id:           int
    email:        str
    account_type: Optional[str]  # null for new social users until they pick type
    display_name: str
    employer_id:         Optional[int]  = None
    restaurant_name:     Optional[str]  = None
    plan:                str            = "free"
    bio:                 Optional[str]  = None
    avatar_url:          Optional[str]  = None
    first_name:          Optional[str]  = None
    last_name:           Optional[str]  = None
    city:                Optional[str]  = None
    country:             Optional[str]  = None
    latitude:            Optional[float] = None
    longitude:           Optional[float] = None
    music_genres:        Optional[str]  = None
    cuisine_preferences: Optional[str]  = None
    dietary_preferences: Optional[str]  = None
    drinking_habits:     Optional[str]  = None
    recipe_interests:    Optional[str]  = None
    onboarding_completed: bool          = False

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    user:         UserResponse


class ProfileUpdate(BaseModel):
    display_name:        Optional[str]   = None
    bio:                 Optional[str]   = None
    account_type:        Optional[str]   = None
    first_name:          Optional[str]   = None
    last_name:           Optional[str]   = None
    city:                Optional[str]   = None
    country:             Optional[str]   = None
    latitude:            Optional[float] = None
    longitude:           Optional[float] = None
    music_genres:        Optional[str]   = None
    cuisine_preferences: Optional[str]   = None
    dietary_preferences: Optional[str]   = None
    drinking_habits:     Optional[str]   = None
    recipe_interests:    Optional[str]   = None
    onboarding_completed: Optional[bool] = None

    @field_validator("account_type")
    @classmethod
    def validate_account_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ("consumer", "restaurant", "diner"):
            raise ValueError("account_type must be consumer, restaurant, or diner")
        return v
