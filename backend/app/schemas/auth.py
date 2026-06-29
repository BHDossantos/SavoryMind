from typing import Optional
from urllib.parse import urlparse
from pydantic import BaseModel, Field, field_validator


def _validate_https_url(v: str) -> str:
    """Reject anything that isn't an https:// URL with a host. Empty string
    is allowed (avatar is optional). Prevents javascript:, data:, http:, and
    malformed values from reaching the database and being rendered as <img src>
    in the frontend without escaping."""
    if not v:
        return v
    parsed = urlparse(v)
    if parsed.scheme != "https" or not parsed.netloc:
        raise ValueError("avatar_url must be an https:// URL")
    return v


class SocialLoginRequest(BaseModel):
    provider:    str = Field(min_length=1, max_length=50)
    provider_id: str = Field(min_length=1, max_length=255)
    email:       str = Field(default="", max_length=150)
    name:        str = Field(default="", max_length=100)
    avatar_url:  str = Field(default="", max_length=500)

    @field_validator("avatar_url")
    @classmethod
    def _check_avatar_url(cls, v: str) -> str:
        return _validate_https_url(v)


class AppleLoginRequest(BaseModel):
    """Body shape for POST /api/auth/apple. Apple's id_token never includes
    name (and may omit email if the user revoked email sharing on first
    sign-in), so name + email are passed by the mobile client from
    response.fullName / response.email — those values only arrive on the
    very first sign-in. Subsequent sign-ins legitimately send only id_token.
    """
    id_token: str = Field(min_length=1)
    name:     Optional[str] = Field(default=None, max_length=200)
    email:    Optional[str] = Field(default=None, max_length=254)

    model_config = {"extra": "forbid"}


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
    kitchen_style:       Optional[str]  = None
    skill_level:         Optional[str]  = None
    cooking_frequency:   Optional[str]  = None
    cooking_time_pref:   Optional[str]  = None
    flavor_profile:      Optional[str]  = None
    cooking_goals:       Optional[str]  = None
    meal_types:          Optional[str]  = None
    kitchen_tools:       Optional[str]  = None
    ingredient_budget:   Optional[str]  = None
    music_moods:         Optional[str]  = None
    non_alcoholic_ok:    Optional[bool] = None
    cuisine_dislikes:    Optional[str]  = None
    dining_occasions:    Optional[str]  = None
    atmosphere_prefs:    Optional[str]  = None
    dining_budget:       Optional[str]  = None
    dining_frequency:    Optional[str]  = None
    dining_group:        Optional[str]  = None
    business_type:       Optional[str]  = None
    restaurant_cuisine:  Optional[str]  = None
    service_type:        Optional[str]  = None
    dining_style:        Optional[str]  = None
    target_audience:     Optional[str]  = None
    peak_hours:          Optional[str]  = None
    restaurant_goals:    Optional[str]  = None
    wine_program:        Optional[str]  = None
    seating_capacity:    Optional[int]  = None
    serves_wine:         Optional[bool] = None
    serves_cocktails:    Optional[bool] = None
    serves_beer:         Optional[bool] = None
    phone:               Optional[str]  = None
    # Public booking slug — restaurants only, server-assigned, read-only for the client.
    slug:                Optional[str]  = None
    # Today's menu — restaurant edits via PATCH /api/auth/profile.
    menu_of_the_day:     Optional[str]  = None
    onboarding_completed: bool          = False
    # i18n preference; default 'en' so legacy clients without the column still work.
    language:            str             = "en"

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    user:         UserResponse
    # Only populated for native-client requests (X-Client-Type: mobile).
    # Web clients keep getting the refresh token via httpOnly cookie so it
    # stays unreachable from JS. Mobile can't read Set-Cookie reliably and
    # has its own secure storage (SecureStore / Keychain), so we hand the
    # value over in the body for that flow only.
    refresh_token: Optional[str] = None


class ProfileUpdate(BaseModel):
    display_name:        Optional[str]   = None
    restaurant_name:     Optional[str]   = None
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
    kitchen_style:       Optional[str]   = None
    skill_level:         Optional[str]   = None
    cooking_frequency:   Optional[str]   = None
    cooking_time_pref:   Optional[str]   = None
    flavor_profile:      Optional[str]   = None
    cooking_goals:       Optional[str]   = None
    meal_types:          Optional[str]   = None
    kitchen_tools:       Optional[str]   = None
    ingredient_budget:   Optional[str]   = None
    music_moods:         Optional[str]   = None
    non_alcoholic_ok:    Optional[bool]  = None
    cuisine_dislikes:    Optional[str]   = None
    dining_occasions:    Optional[str]   = None
    atmosphere_prefs:    Optional[str]   = None
    dining_budget:       Optional[str]   = None
    dining_frequency:    Optional[str]   = None
    dining_group:        Optional[str]   = None
    business_type:       Optional[str]   = None
    restaurant_cuisine:  Optional[str]   = None
    service_type:        Optional[str]   = None
    dining_style:        Optional[str]   = None
    target_audience:     Optional[str]   = None
    peak_hours:          Optional[str]   = None
    restaurant_goals:    Optional[str]   = None
    wine_program:        Optional[str]   = None
    seating_capacity:    Optional[int]   = None
    serves_wine:         Optional[bool]  = None
    serves_cocktails:    Optional[bool]  = None
    serves_beer:         Optional[bool]  = None
    phone:               Optional[str]   = None
    # Today's menu — restaurant publishes the body via PATCH /api/auth/profile.
    # The daily cron SMSs it to opted-in CRM customers at ~11am restaurant-local.
    menu_of_the_day:     Optional[str]   = None
    onboarding_completed: Optional[bool] = None

    # IANA timezone string for restaurant-local scheduling (inventory digest etc.)
    timezone: Optional[str] = None

    # i18n preference. Supported codes: en, es, it, pt, fr.
    language: Optional[str] = None

    @field_validator("language")
    @classmethod
    def validate_language(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.lower().strip()
        if v not in ("en", "es", "it", "pt", "fr"):
            raise ValueError("language must be one of: en, es, it, pt, fr")
        return v

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        # Validate against the IANA TZ database. zoneinfo raises if invalid.
        from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
        try:
            ZoneInfo(v)
        except (ZoneInfoNotFoundError, Exception):
            raise ValueError(f"timezone must be a valid IANA TZ name (got {v!r})")
        return v

    @field_validator("account_type")
    @classmethod
    def validate_account_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ("consumer", "restaurant", "diner"):
            raise ValueError("account_type must be consumer, restaurant, or diner")
        return v
