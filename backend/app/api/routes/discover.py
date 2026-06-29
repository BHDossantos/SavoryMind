from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header, Request, UploadFile, File, Form
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from ...core.database import get_db
from ...core.rate_limit import limiter
from ...core.security import get_current_user
from ...models.user import User
from ...services import discover_service, booking_service, mood_to_meal_service, menu_snap_service, restaurant_matcher

router = APIRouter(prefix="/discover", tags=["discover"])


def _maybe_user(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Soft-auth dependency: returns the current user if the request has a
    valid bearer token, else None. Lets a public endpoint personalise
    when there's a logged-in caller and still answer guests."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    try:
        from ...core.security import decode_token, ACCESS_TOKEN_TYPE
        token = authorization.split(" ", 1)[1].strip()
        payload = decode_token(token, ACCESS_TOKEN_TYPE)
        uid = payload.get("sub")
        if not uid:
            return None
        return db.query(User).filter(User.id == int(uid)).first()
    except Exception:
        return None


def _pj(s, fallback):
    if not s:
        return fallback
    try:
        import json
        v = json.loads(s)
        return v if isinstance(v, list) else fallback
    except Exception:
        return fallback


# ── Public discovery ──────────────────────────────────────────────────────────

@router.get("/restaurants")
def list_restaurants(
    cuisine: str = "",
    city: str = "",
    mood: str = "",
    db: Session = Depends(get_db),
):
    return discover_service.get_restaurants(db, cuisine=cuisine, city=city, mood=mood)


@router.get("/restaurants/{restaurant_id}")
def get_restaurant(restaurant_id: int, db: Session = Depends(get_db)):
    r = discover_service.get_restaurant(db, restaurant_id)
    if not r:
        raise HTTPException(status_code=404, detail="Restaurant not found.")
    return r


@router.get("/availability/{restaurant_id}")
def get_availability(
    restaurant_id: int,
    check_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    d = check_date or date.today()
    return discover_service.get_availability(db, restaurant_id, d)


# ── Diner: request a booking ─────────────────────────────────────────────────

class BookingRequest(BaseModel):
    restaurant_id: int
    booking_date: date  # parsed from "YYYY-MM-DD"; malformed input → 422
    booking_time: str   # "19:00"
    party_size: int = 2
    special_requests: str = ""


@router.post("/book", status_code=201)
def request_booking(
    body: BookingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Consumer + diner accounts are the unified "food person" — both can
    # book. "diner" is legacy; new signups are always "consumer".
    if current_user.account_type not in ("consumer", "diner"):
        raise HTTPException(status_code=403, detail="Booking requires a food account.")
    diner_booking = booking_service.request_booking(
        db,
        diner_user_id=current_user.id,
        restaurant_user_id=body.restaurant_id,
        booking_date=body.booking_date,
        booking_time=body.booking_time,
        party_size=body.party_size,
        special_requests=body.special_requests,
    )
    return diner_booking


# ── Restaurant: manage availability ──────────────────────────────────────────

class AvailabilityUpdate(BaseModel):
    time_slots: list[str]           # ["12:00", "19:00", "20:00"]
    booking_window_days: int = 60


@router.get("/my-availability")
def get_my_availability(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.account_type != "restaurant":
        raise HTTPException(status_code=403, detail="Restaurant account required.")
    from ...services.discover_service import DEFAULT_SLOTS, _slots_for
    slots = _slots_for(current_user)
    return {
        "time_slots": slots,
        "booking_window_days": current_user.booking_window_days or 60,
        "is_custom": bool(current_user.available_time_slots),
    }


@router.patch("/my-availability")
def update_my_availability(
    body: AvailabilityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.account_type != "restaurant":
        raise HTTPException(status_code=403, detail="Restaurant account required.")
    current_user.available_time_slots = ",".join(body.time_slots)
    current_user.booking_window_days = body.booking_window_days
    db.commit()
    db.refresh(current_user)
    return {"time_slots": body.time_slots, "booking_window_days": body.booking_window_days}


# ── Mood-to-Meal: the consumer wedge ─────────────────────────────────────────
# "Tell us how you feel. We'll tell you what to eat."
#
# Public endpoint so a fresh visitor can try once without signing up — the
# whole acquisition flow rests on this being a 5-second tap-and-share moment.
# Logged-in users get their stored taste profile mixed in for sharper
# personalisation; guests pass an inline taste mini-profile in the body.

class MoodToMealRequest(BaseModel):
    mood:        str = Field(..., min_length=1, max_length=40)
    experience:  str = Field(..., min_length=1, max_length=40)
    budget:      str = Field(..., min_length=1, max_length=20)  # "low" | "medium" | "high"
    location:    Optional[str] = Field(default=None, max_length=120)
    at_home:     bool = False
    language:    Optional[str] = Field(default=None, max_length=5)
    # Inline taste profile for guest visitors (signed-in users get the real one)
    cuisines:    Optional[list[str]]  = None
    dietary:     Optional[list[str]]  = None
    spice:       Optional[str]        = Field(default=None, max_length=20)


@router.post("/mood-to-meal", status_code=200)
@limiter.limit("20/minute")
def mood_to_meal(
    body: MoodToMealRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(_maybe_user),
):
    """The Magic Moment endpoint. Always returns 200 with either a
    recommendation or a stub when Claude isn't configured, so the UI can
    render something sensible during local dev / outages."""
    # If signed in, the user's stored profile wins over inline taste fields
    # (richer data, allergies, dislikes the guest form doesn't capture).
    if user:
        cuisines = body.cuisines or _pj(user.cuisine_preferences, [])
        dietary  = body.dietary  or _pj(user.dietary_preferences, [])
        dislikes = _pj(user.cuisine_dislikes, [])
        language = body.language or user.language or "en"
        non_alc  = bool(user.non_alcoholic_ok)
    else:
        cuisines = body.cuisines or []
        dietary  = body.dietary  or []
        dislikes = []
        language = body.language or "en"
        non_alc  = "non_alcoholic" in dietary or "alcohol_free" in dietary

    result = mood_to_meal_service.recommend(
        mood=body.mood,
        experience=body.experience,
        budget=body.budget,
        location=body.location,
        at_home=body.at_home,
        language=language,
        cuisines=cuisines,
        dietary=dietary,
        dislikes=dislikes,
        spice=body.spice,
        non_alcoholic=non_alc,
    )

    if result is None:
        # Dev fallback when ANTHROPIC_API_KEY isn't set, so the UI is
        # still demoable. Honest about the source so we never claim AI
        # output when we don't have it.
        result = {
            "dish":           "Cacio e pepe",
            "dish_desc":      "A Roman classic — cracked pepper and pecorino, comfort in three ingredients.",
            "drink":          "Frascati Superiore",
            "drink_desc":     "Bright Lazio white that gets out of the way.",
            "music_vibe":     "vinyl jazz, late evening",
            "dessert":        "Maritozzo con panna",
            "share_title":    "Tonight you are: cacio e pepe, Frascati, jazz on vinyl",
            "share_subtitle": "Cozy mood, medium budget, Roman soul",
            "cuisine":        "Italian",
        }
        source = "stub"
    else:
        source = "ai"

    # When the user is going out, surface up to 3 onboarded restaurants
    # that serve this dish's cuisine — same-city first, then nationally.
    # Empty list when no signed-up restaurants fit; consumer UI hides
    # the section gracefully.
    restaurants: list[dict] = []
    if not body.at_home:
        restaurants = restaurant_matcher.find_matches(
            db,
            cuisine=result.get("cuisine"),
            city=body.location,
        )
    return {
        "ok":              True,
        "source":          source,
        "recommendation":  result,
        "restaurants":     restaurants,
    }


# ── Snap-a-Menu: "Order like a local, anywhere." ────────────────────────────
# Same engine, image input. Tourist takes a photo of a menu they can't read,
# gets back the one dish they should order with reasoning.

@router.post("/snap-menu", status_code=200)
@limiter.limit("10/minute")
async def snap_menu(
    request: Request,
    image: UploadFile = File(...),
    language: Optional[str] = Form(default=None),
    cuisines: Optional[str] = Form(default=None),    # comma-separated
    dietary: Optional[str]  = Form(default=None),    # comma-separated
    spice: Optional[str]    = Form(default=None),
    budget: Optional[str]   = Form(default=None),
    user: Optional[User]    = Depends(_maybe_user),
):
    """Accept a menu photo (multipart) and return the AI's pick.

    Public — anyone can try once without an account. Signed-in users get
    their stored taste profile mixed in (richer signal than the inline
    form fields). Strict ~5MB image size limit; clients should compress
    to <1MB before upload.
    """
    media_type = (image.content_type or "image/jpeg").lower()
    if media_type not in menu_snap_service.ALLOWED_MEDIA_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported image type")

    data = await image.read()
    if len(data) > menu_snap_service.MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image too large (max 5MB)")
    if not data:
        raise HTTPException(status_code=400, detail="Empty image")

    if user:
        eff_cuisines = _pj(user.cuisine_preferences, [])
        eff_dietary  = _pj(user.dietary_preferences, [])
        eff_dislikes = _pj(user.cuisine_dislikes, [])
        eff_language = language or user.language or "en"
        eff_non_alc  = bool(user.non_alcoholic_ok)
    else:
        eff_cuisines = [s.strip() for s in (cuisines or "").split(",") if s.strip()]
        eff_dietary  = [s.strip() for s in (dietary or "").split(",")  if s.strip()]
        eff_dislikes = []
        eff_language = language or "en"
        eff_non_alc  = "non_alcoholic" in eff_dietary

    result = menu_snap_service.recommend_from_image(
        image_bytes=data,
        media_type=media_type,
        language=eff_language,
        cuisines=eff_cuisines,
        dietary=eff_dietary,
        dislikes=eff_dislikes,
        spice=spice,
        budget=budget,
        non_alcoholic=eff_non_alc,
    )

    if result is None:
        return {
            "ok":     True,
            "source": "stub",
            "recommendation": {
                "dish":         "Tagliata di manzo",
                "why":          "A safe, satisfying pick — rare beef matches savoury preferences and is usually the menu's best value at a steakhouse.",
                "alternatives": ["Risotto ai funghi"],
                "warnings":     [],
                "share_title":  "Tonight: Tagliata di manzo. The menu's best value.",
            },
        }
    return {"ok": True, "source": "ai", "recommendation": result}
