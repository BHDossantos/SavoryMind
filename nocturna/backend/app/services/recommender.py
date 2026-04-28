"""Rule-based recommendation engine for Nocturna plans."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models import Venue
from . import scoring


@dataclass
class PlannerInput:
    city: str = "rome"
    requested_for: datetime = field(default_factory=datetime.utcnow)
    intent: str = "dinner_drinks"  # see Plan.intent enum
    vibe_tags: List[str] = field(default_factory=list)
    music_pref: List[str] = field(default_factory=list)
    cuisine_pref: List[str] = field(default_factory=list)
    style: str = "casual"
    group_type: str = "friends"
    group_size: int = 2
    budget_band: str = "50-100"
    budget_per_person: int = 75
    neighborhood_pref: List[str] = field(default_factory=list)
    user_lat: Optional[float] = None
    user_lng: Optional[float] = None
    accept_long_route: bool = False
    plan_count: int = 3


# Intent to itinerary template (slot list + relative time offsets in minutes from start)
INTENT_TEMPLATES = {
    "dinner_drinks": [
        ("dinner", ["restaurant"], 0, 120),
        ("bar", ["bar", "lounge", "speakeasy", "rooftop"], 130, 90),
    ],
    "dinner": [
        ("dinner", ["restaurant"], 0, 120),
    ],
    "drinks": [
        ("bar", ["bar", "lounge", "speakeasy", "rooftop"], 0, 120),
    ],
    "dancing": [
        ("club", ["club"], 0, 180),
    ],
    "date_night": [
        ("dinner", ["restaurant"], 0, 120),
        ("bar", ["bar", "lounge", "speakeasy", "rooftop"], 130, 90),
    ],
    "vip_table": [
        ("dinner", ["restaurant"], 0, 120),
        ("bar", ["lounge", "rooftop"], 130, 60),
        ("club", ["club"], 200, 240),
    ],
    "live_music": [
        ("live", ["live_music", "lounge"], 0, 150),
    ],
    "aperitivo": [
        ("aperitivo", ["bar", "lounge", "rooftop", "restaurant"], 0, 90),
    ],
    "meet_people": [
        ("bar", ["bar", "lounge"], 0, 90),
        ("club", ["club"], 100, 180),
    ],
    "luxury": [
        ("dinner", ["restaurant"], 0, 120),
        ("bar", ["lounge", "rooftop"], 130, 90),
        ("club", ["club"], 230, 180),
    ],
    "budget": [
        ("dinner", ["restaurant"], 0, 90),
        ("bar", ["bar"], 100, 90),
    ],
    "surprise": [
        ("dinner", ["restaurant"], 0, 120),
        ("bar", ["bar", "lounge", "speakeasy"], 130, 90),
        ("club", ["club"], 230, 180),
    ],
}


CLUB_HOURS_MIN = 23 * 60 + 30  # 23:30


def _hard_filter(venue: Venue, when: datetime, inp: PlannerInput, slot_role: str, types: List[str]) -> bool:
    if not venue.active:
        return False
    if (venue.city or "rome").lower() != inp.city.lower():
        return False
    if venue.type not in types:
        return False

    # Club hour rule
    if slot_role == "club" or venue.type == "club":
        local_minutes = when.hour * 60 + when.minute
        if local_minutes < CLUB_HOURS_MIN:
            return False

    if not scoring.is_open_at(venue.opening_hours or {}, when):
        return False

    if not scoring.dress_compatible(inp.style, venue.dress_code or "casual"):
        return False

    # Don't recommend high-end (price_level 4) when budget is the lowest band
    if venue.price_level >= 4 and inp.budget_band == "25-50":
        return False
    # Don't recommend casual venues for luxury intents
    if inp.intent in ("luxury", "vip_table") and venue.price_level <= 1:
        return False

    if venue.capacity and inp.group_size > venue.capacity:
        return False

    return True


def _score_venue(venue: Venue, when: datetime, inp: PlannerInput) -> dict:
    parts = {
        "location": scoring.location_match(
            inp.user_lat,
            inp.user_lng,
            (inp.neighborhood_pref or [None])[0],
            venue.lat,
            venue.lng,
            venue.neighborhood,
        ),
        "vibe": scoring.vibe_match(inp.vibe_tags, venue.vibe_tags or []),
        "budget": scoring.budget_match(inp.budget_band, venue.avg_price_eur or 50),
        "time": scoring.time_match(venue.opening_hours or {}, when, venue.best_arrival_time),
        "group": scoring.group_match(inp.group_type, venue.crowd_types or [], inp.group_size, venue.capacity),
        "quality": scoring.quality(venue.quality_score or 0.7),
        "promoted": scoring.promoted_boost(bool(venue.promoted), venue.partner_status or "none"),
    }
    # Music match nudges vibe
    if inp.music_pref:
        m = scoring.jaccard(inp.music_pref, venue.music_types or [])
        parts["vibe"] = max(parts["vibe"], (parts["vibe"] + m) / 2)
    return parts


def _slot_when(start: datetime, offset_min: int) -> datetime:
    return start + timedelta(minutes=offset_min)


def generate_plans(db: Session, inp: PlannerInput) -> List[dict]:
    template = INTENT_TEMPLATES.get(inp.intent, INTENT_TEMPLATES["dinner_drinks"])

    base_query = db.query(Venue).filter(Venue.city == inp.city, Venue.active == True)  # noqa: E712
    candidates = base_query.all()

    slot_pools: List[List[dict]] = []
    for slot_role, types, offset_min, duration_min in template:
        when = _slot_when(inp.requested_for, offset_min)
        scored = []
        for v in candidates:
            if not _hard_filter(v, when, inp, slot_role, types):
                continue
            parts = _score_venue(v, when, inp)
            score = scoring.composite_score(parts)
            scored.append({
                "venue": v,
                "slot_role": slot_role,
                "slot_start": when,
                "slot_end": when + timedelta(minutes=duration_min),
                "score": score,
                "score_parts": parts,
                "duration_min": duration_min,
            })
        scored.sort(key=lambda x: x["score"], reverse=True)
        slot_pools.append(scored[:8])

    if any(not p for p in slot_pools):
        return []

    # Build up to N plans by combining top picks across slots, ensuring travel constraints + variety.
    plans: List[dict] = []
    used_venue_ids: set[int] = set()
    promoted_count_per_plan_cap = 1

    for plan_idx in range(inp.plan_count):
        chosen: List[dict] = []
        prev: Optional[dict] = None
        promoted_used = 0
        plan_venue_ids: set[int] = set()
        for pool in slot_pools:
            pick = None
            for cand in pool:
                v = cand["venue"]
                if v.id in plan_venue_ids:
                    continue
                # Variety across plans
                if v.id in used_venue_ids and plan_idx < len(slot_pools):
                    continue
                # Promoted cap per plan
                if v.promoted and promoted_used >= promoted_count_per_plan_cap:
                    continue
                # Travel time constraint
                if prev:
                    km = scoring.haversine_km(
                        prev["venue"].lat, prev["venue"].lng, v.lat, v.lng
                    )
                    travel_min = scoring.travel_minutes(km)
                    if travel_min > 25 and not inp.accept_long_route:
                        continue
                pick = cand
                break
            if not pick:
                # Allow venue reuse across plans if pool exhausted
                for cand in pool:
                    v = cand["venue"]
                    if v.id in plan_venue_ids:
                        continue
                    if v.promoted and promoted_used >= promoted_count_per_plan_cap:
                        continue
                    pick = cand
                    break
            if not pick:
                break
            v = pick["venue"]
            plan_venue_ids.add(v.id)
            used_venue_ids.add(v.id)
            if v.promoted:
                promoted_used += 1
            travel_to_next = 0
            if prev:
                km = scoring.haversine_km(prev["venue"].lat, prev["venue"].lng, v.lat, v.lng)
                travel_to_next_prev = scoring.travel_minutes(km)
                chosen[-1]["travel_to_next_min"] = travel_to_next_prev
            chosen.append({
                "venue_id": v.id,
                "slug": v.slug,
                "name": v.name,
                "type": v.type,
                "neighborhood": v.neighborhood,
                "slot_role": pick["slot_role"],
                "slot_start": pick["slot_start"].isoformat(),
                "slot_end": pick["slot_end"].isoformat(),
                "score": pick["score"],
                "score_parts": pick["score_parts"],
                "promoted": v.promoted,
                "summary": _venue_summary(v),
                "lat": v.lat,
                "lng": v.lng,
                "travel_to_next_min": 0,
            })
            prev = pick
        if len(chosen) < len(template):
            continue
        total_travel = sum(s.get("travel_to_next_min", 0) for s in chosen)
        if total_travel > 30 and not inp.accept_long_route:
            continue
        cost = sum(_estimate_cost(p["venue_id"], db) for p in chosen)
        vibe_score = round(sum(s["score"] for s in chosen) / len(chosen), 3)
        plans.append({
            "label": _plan_label(plan_idx, inp, chosen),
            "stops": chosen,
            "estimated_cost_eur": cost,
            "total_travel_min": total_travel,
            "vibe_score": vibe_score,
            "dress_code": _aggregate_dress(chosen, db),
            "rationale": _rationale(inp, chosen),
        })
    return plans


def _venue_summary(v: Venue) -> str:
    bits = [v.neighborhood]
    if v.vibe_tags:
        bits.append(", ".join(v.vibe_tags[:3]))
    bits.append(f"~€{v.avg_price_eur}")
    return " · ".join(bits)


def _estimate_cost(venue_id: int, db: Session) -> int:
    v = db.query(Venue).get(venue_id)
    return v.avg_price_eur if v else 0


def _aggregate_dress(stops: List[dict], db: Session) -> str:
    levels: List[int] = []
    for s in stops:
        v = db.query(Venue).get(s["venue_id"])
        if not v:
            continue
        try:
            levels.append(scoring.DRESS_HIERARCHY.index((v.dress_code or "casual").lower()))
        except ValueError:
            continue
    if not levels:
        return "casual"
    return scoring.DRESS_HIERARCHY[max(levels)]


def _plan_label(idx: int, inp: PlannerInput, stops: List[dict]) -> str:
    moods = {
        "date_night": "Romantic Roman Night",
        "luxury": "Luxury Night Out",
        "vip_table": "VIP Table Experience",
        "dancing": "Dance Floor Night",
        "live_music": "Live Music Night",
        "aperitivo": "Aperitivo Hour",
        "meet_people": "Singles & Social",
        "budget": "Smart Budget Night",
        "surprise": "Surprise Me Night",
        "drinks": "Cocktail Crawl",
        "dinner": "Dinner Tonight",
        "dinner_drinks": "Dinner & Drinks",
    }
    base = moods.get(inp.intent, "Tonight's Plan")
    suffixes = ["", " — Plan B", " — Plan C", " — Alt"]
    return f"{base}{suffixes[min(idx, len(suffixes) - 1)]}"


def _rationale(inp: PlannerInput, stops: List[dict]) -> str:
    vibe = ", ".join(inp.vibe_tags[:3]) if inp.vibe_tags else "your vibe"
    return (
        f"Curated for {inp.group_type} of {inp.group_size}, {vibe}, "
        f"around €{inp.budget_per_person}/person. {len(stops)} stops, "
        f"{sum(s.get('travel_to_next_min', 0) for s in stops)} min total travel."
    )
