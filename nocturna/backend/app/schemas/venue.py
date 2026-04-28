from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class VenueBase(BaseModel):
    slug: str
    name: str
    type: str
    description: Optional[str] = None
    address: str
    lat: float
    lng: float
    neighborhood: str
    city: str = "rome"
    country: str = "IT"
    opening_hours: Dict[str, Any] = Field(default_factory=dict)
    best_arrival_time: Optional[str] = None
    price_level: int = 2
    avg_price_eur: int = 50
    dress_code: str = "casual"
    music_types: List[str] = Field(default_factory=list)
    crowd_types: List[str] = Field(default_factory=list)
    vibe_tags: List[str] = Field(default_factory=list)
    cuisine_tags: List[str] = Field(default_factory=list)
    reservation_required: bool = False
    walk_in_ok: bool = True
    vip_available: bool = False
    guestlist_required: bool = False
    contact: Dict[str, Any] = Field(default_factory=dict)
    photos: List[str] = Field(default_factory=list)
    menu_url: Optional[str] = None
    booking_url: Optional[str] = None
    capacity: Optional[int] = None
    partner_status: str = "none"
    commission_pct: float = 0.0
    promoted: bool = False
    quality_score: float = 0.7
    best_nights: List[str] = Field(default_factory=list)
    active: bool = True
    admin_notes: Optional[str] = None


class VenueCreate(VenueBase):
    pass


class VenueUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    neighborhood: Optional[str] = None
    opening_hours: Optional[Dict[str, Any]] = None
    best_arrival_time: Optional[str] = None
    price_level: Optional[int] = None
    avg_price_eur: Optional[int] = None
    dress_code: Optional[str] = None
    music_types: Optional[List[str]] = None
    crowd_types: Optional[List[str]] = None
    vibe_tags: Optional[List[str]] = None
    cuisine_tags: Optional[List[str]] = None
    reservation_required: Optional[bool] = None
    walk_in_ok: Optional[bool] = None
    vip_available: Optional[bool] = None
    guestlist_required: Optional[bool] = None
    contact: Optional[Dict[str, Any]] = None
    photos: Optional[List[str]] = None
    menu_url: Optional[str] = None
    booking_url: Optional[str] = None
    capacity: Optional[int] = None
    partner_status: Optional[str] = None
    commission_pct: Optional[float] = None
    promoted: Optional[bool] = None
    quality_score: Optional[float] = None
    best_nights: Optional[List[str]] = None
    active: Optional[bool] = None
    admin_notes: Optional[str] = None


class VenueOut(VenueBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PromoBase(BaseModel):
    title: str
    type: str
    description: Optional[str] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    active: bool = True


class PromoCreate(PromoBase):
    venue_id: int


class PromoOut(PromoBase):
    id: int
    venue_id: int
    created_at: datetime

    class Config:
        from_attributes = True
