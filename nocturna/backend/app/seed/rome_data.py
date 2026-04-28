"""Rome venue seed data — 50+ curated venues across dinner, bar, club, rooftop, etc."""
from .generate_venues import (
    bar,
    club,
    late_food,
    live_music,
    lounge,
    restaurant,
    rooftop,
    slugify,
    speakeasy,
)


def _v(**kw):
    """Helper that fills sane defaults for a Rome venue row."""
    name = kw.pop("name")
    base = {
        "slug": kw.pop("slug", None) or slugify(name),
        "name": name,
        "city": "rome",
        "country": "IT",
        "description": kw.pop("description", f"{name} — a curated Nocturna pick in Rome."),
        "best_arrival_time": kw.pop("best_arrival_time", None),
        "price_level": kw.pop("price_level", 2),
        "avg_price_eur": kw.pop("avg_price_eur", 60),
        "dress_code": kw.pop("dress_code", "casual"),
        "music_types": kw.pop("music_types", []),
        "crowd_types": kw.pop("crowd_types", []),
        "vibe_tags": kw.pop("vibe_tags", []),
        "cuisine_tags": kw.pop("cuisine_tags", []),
        "reservation_required": kw.pop("reservation_required", False),
        "walk_in_ok": kw.pop("walk_in_ok", True),
        "vip_available": kw.pop("vip_available", False),
        "guestlist_required": kw.pop("guestlist_required", False),
        "contact": kw.pop("contact", {"phone": "+39 06 0000000"}),
        "photos": kw.pop("photos", []),
        "menu_url": kw.pop("menu_url", None),
        "booking_url": kw.pop("booking_url", None),
        "capacity": kw.pop("capacity", 80),
        "partner_status": kw.pop("partner_status", "none"),
        "commission_pct": kw.pop("commission_pct", 0.0),
        "promoted": kw.pop("promoted", False),
        "quality_score": kw.pop("quality_score", 0.78),
        "best_nights": kw.pop("best_nights", ["fri", "sat"]),
        "active": kw.pop("active", True),
        "admin_notes": kw.pop("admin_notes", None),
    }
    base.update(kw)  # remaining: type, address, lat, lng, neighborhood, opening_hours
    return base
