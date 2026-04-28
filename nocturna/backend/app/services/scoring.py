"""Pure scoring helpers for the recommendation engine."""
from __future__ import annotations

import math
from datetime import datetime
from typing import Iterable, List, Optional


WEIGHTS = {
    "location": 0.20,
    "vibe": 0.25,
    "budget": 0.15,
    "time": 0.15,
    "group": 0.10,
    "quality": 0.10,
    "promoted": 0.05,
}

BUDGET_BANDS = {
    "25-50": (25, 50),
    "50-100": (50, 100),
    "100-200": (100, 200),
    "200+": (200, 500),
    "vip-500+": (500, 1000),
    "vip-1000+": (1000, 2000),
    "vip-2000+": (2000, 10000),
}

DRESS_HIERARCHY = ["streetwear", "casual", "business", "elegant", "sexy", "luxury"]

WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    )
    return 2 * R * math.asin(math.sqrt(a))


def travel_minutes(km: float, mode: str = "taxi") -> int:
    speeds = {"walk": 5, "taxi": 25, "metro": 18}
    speed = speeds.get(mode, 25)
    return max(1, int(round((km / speed) * 60)))


def jaccard(a: Iterable[str], b: Iterable[str]) -> float:
    sa = {x.lower() for x in (a or [])}
    sb = {x.lower() for x in (b or [])}
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / len(sa | sb)


def vibe_match(user_tags: List[str], venue_tags: List[str]) -> float:
    if not user_tags:
        return 0.5
    return jaccard(user_tags, venue_tags)


def budget_match(user_band: str, venue_avg_eur: int) -> float:
    lo, hi = BUDGET_BANDS.get(user_band, (0, 1_000_000))
    if lo <= venue_avg_eur <= hi:
        return 1.0
    if venue_avg_eur < lo:
        diff = (lo - venue_avg_eur) / max(lo, 1)
        return max(0.0, 1.0 - diff * 0.6)
    diff = (venue_avg_eur - hi) / max(hi, 1)
    return max(0.0, 1.0 - diff * 1.2)


def location_match(
    user_lat: Optional[float],
    user_lng: Optional[float],
    user_neighborhood: Optional[str],
    venue_lat: float,
    venue_lng: float,
    venue_neighborhood: str,
) -> float:
    score = 0.5
    if user_neighborhood and venue_neighborhood and user_neighborhood.lower() == venue_neighborhood.lower():
        score = max(score, 0.95)
    if user_lat is not None and user_lng is not None:
        km = haversine_km(user_lat, user_lng, venue_lat, venue_lng)
        if km < 0.5:
            score = max(score, 1.0)
        elif km < 1.5:
            score = max(score, 0.85)
        elif km < 3.0:
            score = max(score, 0.65)
        elif km < 6.0:
            score = max(score, 0.4)
        else:
            score = max(0.1, 0.4 - (km - 6) * 0.05)
    return min(1.0, score)


def is_open_at(opening_hours: dict, when: datetime) -> bool:
    if not opening_hours:
        return True
    today_idx = when.weekday()
    minutes = when.hour * 60 + when.minute

    today_slots = opening_hours.get(WEEKDAY_KEYS[today_idx]) or []
    for slot in today_slots:
        try:
            o = int(slot["open"][:2]) * 60 + int(slot["open"][3:5])
            c = int(slot["close"][:2]) * 60 + int(slot["close"][3:5])
        except (KeyError, ValueError, IndexError):
            continue
        if c > o and o <= minutes <= c:
            return True
        if c <= o and minutes >= o:  # opens today, wraps past midnight
            return True

    # late-night slot that opened yesterday and wraps into today (e.g. club Sat 23:30 → Sun 06:00)
    yesterday_slots = opening_hours.get(WEEKDAY_KEYS[(today_idx - 1) % 7]) or []
    for slot in yesterday_slots:
        try:
            o = int(slot["open"][:2]) * 60 + int(slot["open"][3:5])
            c = int(slot["close"][:2]) * 60 + int(slot["close"][3:5])
        except (KeyError, ValueError, IndexError):
            continue
        if c <= o and minutes <= c:
            return True
    return False


def time_match(opening_hours: dict, when: datetime, best_arrival: Optional[str]) -> float:
    if not is_open_at(opening_hours, when):
        return 0.0
    if not best_arrival:
        return 0.85
    try:
        bh, bm = [int(x) for x in best_arrival.split(":")]
    except ValueError:
        return 0.85
    target = bh * 60 + bm
    actual = when.hour * 60 + when.minute
    diff = min(abs(actual - target), 24 * 60 - abs(actual - target))
    return max(0.4, 1.0 - diff / 240)


def group_match(group_type: str, crowd_types: List[str], group_size: int, capacity: Optional[int]) -> float:
    if capacity and group_size > capacity:
        return 0.0
    crowds = {c.lower() for c in (crowd_types or [])}
    if not crowds:
        return 0.6
    mapping = {
        "date": {"date_friendly", "romantic", "couples"},
        "solo": {"singles_friendly", "social", "international"},
        "friends": {"social", "friends", "lively"},
        "mixed": {"social", "international", "mixed"},
        "bachelor": {"party", "wild", "club"},
        "bachelorette": {"party", "wild", "ladies", "club"},
        "business": {"business", "elegant", "international", "quiet"},
        "celebration": {"party", "vip", "lively", "celebration"},
        "birthday": {"party", "vip", "celebration", "lively"},
    }
    target = mapping.get((group_type or "").lower(), set())
    if not target:
        return 0.6
    if target & crowds:
        return 0.95
    return 0.4


def dress_compatible(user_style: str, venue_dress: str) -> bool:
    try:
        u = DRESS_HIERARCHY.index((user_style or "casual").lower())
        v = DRESS_HIERARCHY.index((venue_dress or "casual").lower())
    except ValueError:
        return True
    # User can over-dress slightly but should not under-dress for elegant/luxury
    return u >= v - 1


def quality(score: float) -> float:
    return max(0.0, min(1.0, score or 0.0))


def promoted_boost(promoted: bool, partner_status: str) -> float:
    if not promoted:
        return 0.0
    return {"premium": 1.0, "pro": 0.7, "basic": 0.4, "none": 0.2}.get(partner_status or "none", 0.2)


def composite_score(parts: dict) -> float:
    total = 0.0
    for key, weight in WEIGHTS.items():
        total += weight * parts.get(key, 0.0)
    return round(total, 4)
