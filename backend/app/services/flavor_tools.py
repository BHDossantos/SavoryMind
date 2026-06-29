"""Flavor's tool registry — the functions Claude can call mid-conversation.

Design notes
------------

Every tool is a plain Python function: takes a ``UserContext`` dataclass
plus typed kwargs, returns a JSON-serialisable result (dict / list /
scalar). No SQLAlchemy queries leak across tool boundaries — the
context carries everything a tool needs (user_id, db session, language).

Tools are intentionally read-only in this first cut. Action tools (add
to pantry, save memory, create booking) will land in a later phase
once we trust the conversational flow.

User scoping
------------
Every per-user tool reads ``ctx.user_id`` rather than accepting a user_id
arg — Claude can't be tricked into querying another user's data by
including their ID in a tool call. The argument schema we expose to the
model never mentions user_id.

Tool schema vs. Tool function
-----------------------------
- ``TOOL_DEFINITIONS`` is the list we hand to Anthropic — name +
  description + JSON schema for inputs. Claude sees only this.
- ``_TOOLS`` is the {name → callable} dispatch table the
  ``call_with_tools`` helper uses after Claude requests a tool.

When you add a tool, add both entries. There's no other registration.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Optional

from sqlalchemy.orm import Session

from ..data import get_wines, get_beers, get_spirits
from ..models.consumer import PantryItem, MealMemory
from ..models.diner import DinerBooking, DinerVisit
from ..models.flavor import FlavorMemory
from ..models.menu import MenuItem
from ..models.restaurant_ext import Booking, CRMCustomer
from ..models.review import Review
from ..models.inventory import InventoryItem, InventoryAdjustment
from ..models.user import User
from . import recipe_service, wine_service, beverage_service, review_service


# ── Context ────────────────────────────────────────────────────────────────

@dataclass
class UserContext:
    """Per-request context handed to every tool. Tools NEVER receive
    user-supplied IDs — they read ``user_id`` from the context. This
    prevents prompt injection from making Claude query someone else's
    pantry / journal / bookings."""
    user_id: int
    account_type: str
    language: str
    db: Session


# ── Wines / Beers / Spirits search ─────────────────────────────────────────

def _search_dict_catalog(catalog: dict, query: str | None = None, **filters) -> list[dict]:
    """Generic search over a slug-keyed dict catalog (wines). Returns up
    to 20 matching entries. None values in filters are ignored."""
    items = []
    q = (query or "").lower()
    for slug, entry in catalog.items():
        # Substring search across name + style + flavor_profile.
        if q:
            haystack = " ".join([
                entry.get("name", ""),
                entry.get("style", ""),
                entry.get("flavor_profile", ""),
                " ".join(entry.get("regions", [])),
            ]).lower()
            if q not in haystack:
                continue
        # Field-specific filters (case-insensitive substring).
        ok = True
        for k, v in filters.items():
            if not v:
                continue
            if v.lower() not in (entry.get(k, "") or "").lower():
                ok = False
                break
        if ok:
            items.append({"slug": slug, **entry})
    return items[:20]


def _search_list_catalog(catalog: list[dict], query: str | None = None, **filters) -> list[dict]:
    """Generic search over a list catalog (beers, spirits). Returns up
    to 20 matching entries."""
    items = []
    q = (query or "").lower()
    for entry in catalog:
        if q:
            haystack = " ".join(str(v) for v in entry.values()).lower()
            if q not in haystack:
                continue
        ok = True
        for k, v in filters.items():
            if v is None or v == "":
                continue
            cell = entry.get(k)
            if isinstance(v, (int, float)) and isinstance(cell, (int, float)):
                # numeric filters use the convention min_X / max_X — handled
                # by the calling tool, not here.
                continue
            if isinstance(v, str) and v.lower() not in str(cell or "").lower():
                ok = False
                break
        if ok:
            items.append(entry)
    return items[:20]


def tool_search_wines(ctx: UserContext, *, query: str = "", style: str = "", region: str = "") -> dict:
    """Search the wine catalog by free-text query, style, or region."""
    results = _search_dict_catalog(get_wines(), query=query, style=style)
    if region:
        results = [
            w for w in results
            if any(region.lower() in r.lower() for r in w.get("regions", []))
        ]
    return {"count": len(results), "wines": results}


def tool_search_beers(ctx: UserContext, *, query: str = "", style: str = "",
                     min_abv: float = 0, max_abv: float = 100) -> dict:
    """Search the beer catalog by free-text query, style, or ABV range."""
    candidates = _search_list_catalog(get_beers(), query=query, style=style)
    filtered = [
        b for b in candidates
        if min_abv <= (b.get("abv") or 0) <= max_abv
    ]
    return {"count": len(filtered), "beers": filtered}


def tool_search_spirits(ctx: UserContext, *, query: str = "", spirit: str = "", region: str = "") -> dict:
    """Search the spirits catalog by free-text query, category, or region."""
    results = _search_list_catalog(get_spirits(), query=query, spirit=spirit, region=region)
    return {"count": len(results), "spirits": results}


# ── Pairings (delegate to existing services) ──────────────────────────────

def tool_get_wine_pairing(ctx: UserContext, *, dish: str) -> dict:
    """Get wine recommendations for a specific dish. Uses the existing
    rule-based pairing engine in wine_service."""
    if not dish.strip():
        return {"error": "dish is required"}
    pairings = wine_service.pair_wine(dish.strip())
    return {"dish": dish, "pairings": pairings}


def tool_get_beer_pairing(ctx: UserContext, *, dish: str) -> dict:
    if not dish.strip():
        return {"error": "dish is required"}
    result = beverage_service.get_beer_pairings(dish.strip())
    return result


def tool_get_spirits_pairing(ctx: UserContext, *, dish: str) -> dict:
    if not dish.strip():
        return {"error": "dish is required"}
    result = beverage_service.get_spirits_pairings(dish.strip())
    return result


# ── Recipes ────────────────────────────────────────────────────────────────

def tool_search_recipes(ctx: UserContext, *, cuisine: str = "", mood: str = "",
                       keywords: str = "", ingredients: str = "",
                       max_time: int = 0, difficulty: str = "") -> dict:
    """Search the recipe catalog. Uses the existing rule-based filter +
    scoring engine in recipe_service. Returns up to 12 recipes."""
    return recipe_service.get_recipe_recommendations(
        cuisine=cuisine, mood=mood, keywords=keywords,
        ingredients=ingredients, max_time=max_time, difficulty=difficulty,
    )


def tool_get_recipe(ctx: UserContext, *, recipe_id: int) -> dict:
    """Fetch the full recipe (ingredients + steps + pairings) by ID."""
    recipe = recipe_service.get_recipe_by_id(recipe_id)
    if not recipe:
        return {"error": f"recipe {recipe_id} not found"}
    return recipe


# ── User data (pantry / journal / preferences) ────────────────────────────

def tool_get_pantry(ctx: UserContext) -> dict:
    """List ingredients the current user has in their pantry."""
    rows = (
        ctx.db.query(PantryItem)
        .filter(PantryItem.user_id == ctx.user_id)
        .order_by(PantryItem.added_at.desc())
        .limit(100)
        .all()
    )
    return {
        "count": len(rows),
        "items": [
            {"ingredient": r.ingredient, "quantity": r.quantity, "category": r.category}
            for r in rows
        ],
    }


def tool_get_journal_recent(ctx: UserContext, *, limit: int = 10) -> dict:
    """Recent meal memories logged by the current user — useful when
    Flavor wants to reason about "what have you been cooking lately"."""
    rows = (
        ctx.db.query(MealMemory)
        .filter(MealMemory.user_id == ctx.user_id)
        .order_by(MealMemory.cooked_at.desc())
        .limit(max(1, min(limit, 50)))
        .all()
    )
    return {
        "count": len(rows),
        "memories": [
            {
                "dish_name":      r.dish_name,
                "emoji":          r.emoji,
                "rating":         r.rating,
                "cuisine":        r.cuisine,
                "notes":          r.notes,
                "what_id_change": r.what_id_change,
                "cooked_at":      r.cooked_at.isoformat() if r.cooked_at else None,
            }
            for r in rows
        ],
    }


def _safe_json(val: str | None, fallback):
    """Profile JSON columns are stored as text — decode best-effort."""
    if not val:
        return fallback
    try:
        return json.loads(val)
    except (json.JSONDecodeError, TypeError):
        return fallback


def tool_get_user_preferences(ctx: UserContext) -> dict:
    """Read the current user's food + cooking preferences from their
    profile. Tells Flavor what they like (cuisines, flavour profile),
    what they avoid (dislikes, allergies), and how they cook (skill,
    time budget). Critical for personalised answers."""
    u = ctx.db.query(User).filter(User.id == ctx.user_id).first()
    if not u:
        return {"error": "user not found"}
    return {
        "display_name":        u.display_name,
        "language":            u.language,
        "account_type":        u.account_type,
        "city":                u.city,
        "country":             u.country,
        "kitchen_style":       u.kitchen_style,
        "skill_level":         u.skill_level,
        "cooking_frequency":   u.cooking_frequency,
        "cooking_time_pref":   u.cooking_time_pref,
        "ingredient_budget":   u.ingredient_budget,
        "cuisine_preferences": _safe_json(u.cuisine_preferences, []),
        "cuisine_dislikes":    _safe_json(u.cuisine_dislikes, []),
        "dietary_preferences": _safe_json(u.dietary_preferences, []),
        "flavor_profile":      _safe_json(u.flavor_profile, {}),
        "cooking_goals":       _safe_json(u.cooking_goals, []),
        "meal_types":          _safe_json(u.meal_types, []),
        "kitchen_tools":       _safe_json(u.kitchen_tools, []),
        "drinking_habits":     _safe_json(u.drinking_habits, {}),
    }


# ── Diner-side tools (also available to consumer accounts via unification) ─
#
# Bookings + visits read from the diner-side tables (DinerBooking,
# DinerVisit). A unified consumer account that uses the Dine feature
# set will populate these the same way a pure diner account would.

def tool_get_my_bookings(ctx: UserContext, *, status: str = "") -> dict:
    """List the user's restaurant bookings (upcoming + past). Optionally
    filter by status ('confirmed', 'pending', 'cancelled')."""
    q = ctx.db.query(DinerBooking).filter(DinerBooking.user_id == ctx.user_id)
    if status:
        q = q.filter(DinerBooking.status == status.lower())
    rows = q.order_by(DinerBooking.booking_date.desc()).limit(20).all()
    return {
        "count": len(rows),
        "bookings": [
            {
                "id":            r.id,
                "restaurant":    r.restaurant_name,
                "date":          r.booking_date,
                "time":          r.booking_time,
                "party_size":    r.party_size,
                "status":        r.status,
                "special":       r.special_requests,
            } for r in rows
        ],
    }


def tool_get_visit_history(ctx: UserContext, *, limit: int = 10) -> dict:
    """Recent restaurant visits the user has logged — what they ordered,
    what they rated each visit, what stood out, would they return."""
    rows = (
        ctx.db.query(DinerVisit)
        .filter(DinerVisit.user_id == ctx.user_id)
        .order_by(DinerVisit.visit_date.desc())
        .limit(max(1, min(limit, 50)))
        .all()
    )
    return {
        "count": len(rows),
        "visits": [
            {
                "restaurant":    r.restaurant_name,
                "date":          r.visit_date,
                "items":         r.items_ordered,
                "rating":        r.overall_rating,
                "food_rating":   r.food_rating,
                "staff_rating":  r.staff_rating,
                "would_return":  r.would_return,
                "highlights":    r.highlights,
                "lowlights":     r.lowlights,
            } for r in rows
        ],
    }


# ── Restaurant-only tools ──────────────────────────────────────────────────
#
# These are gated to account_type='restaurant'. Read from the
# restaurant operator's own tables — menu items, incoming bookings,
# CRM customers, inventory, sentiment.

def tool_get_menu(ctx: UserContext, *, category: str = "") -> dict:
    """List the restaurant's menu items. Optionally filter by category
    ('Mains', 'Starters', 'Desserts', 'Drinks')."""
    q = ctx.db.query(MenuItem).filter(MenuItem.user_id == ctx.user_id)
    if category:
        q = q.filter(MenuItem.category == category)
    rows = q.order_by(MenuItem.category, MenuItem.name).all()
    return {
        "count": len(rows),
        "items": [
            {
                "id":          r.id,
                "name":        r.name,
                "category":    r.category,
                "price":       r.price,
                "cost":        r.cost,
                "rating":      r.rating,
                "description": r.description,
            } for r in rows
        ],
    }


def tool_get_bookings_today(ctx: UserContext, *, days: int = 1) -> dict:
    """Incoming bookings for the restaurant, today + next `days` days.
    Default = today only."""
    import datetime as _dt
    today = _dt.date.today()
    end = today + _dt.timedelta(days=max(0, days - 1))
    rows = (
        ctx.db.query(Booking)
        .filter(Booking.user_id == ctx.user_id)
        .filter(Booking.date >= today)
        .filter(Booking.date <= end)
        .filter(Booking.status.in_(["confirmed", "pending", "seated"]))
        .order_by(Booking.date, Booking.time_slot)
        .all()
    )
    return {
        "count": len(rows),
        "from":  today.isoformat(),
        "to":    end.isoformat(),
        "bookings": [
            {
                "id":         r.id,
                "customer":   r.customer_name,
                "date":       r.date.isoformat() if r.date else None,
                "time":       r.time_slot,
                "party_size": r.party_size,
                "status":     r.status,
                "notes":      r.notes,
            } for r in rows
        ],
    }


def tool_get_sentiment_summary(ctx: UserContext) -> dict:
    """Aggregate sentiment over the restaurant's reviews — total
    count, positive / neutral / negative breakdown, average rating."""
    reviews = ctx.db.query(Review).filter(Review.user_id == ctx.user_id).all()
    if not reviews:
        return {"total": 0, "positive": 0, "neutral": 0, "negative": 0, "avg_rating": None}
    pos = sum(1 for r in reviews if (r.sentiment_label or "").lower() == "positive")
    neg = sum(1 for r in reviews if (r.sentiment_label or "").lower() == "negative")
    neu = len(reviews) - pos - neg
    avg = sum((r.rating or 0) for r in reviews) / max(len(reviews), 1)
    return {
        "total":     len(reviews),
        "positive":  pos,
        "neutral":   neu,
        "negative":  neg,
        "avg_rating": round(avg, 2),
    }


def tool_get_inventory_low_stock(ctx: UserContext) -> dict:
    """List inventory items below their par level — restaurant operator
    wants to know what to reorder today."""
    rows = (
        ctx.db.query(InventoryItem)
        .filter(InventoryItem.user_id == ctx.user_id)
        .all()
    )
    # current_quantity is computed from adjustments; safe shim to derive
    # from .current_quantity attribute if available, otherwise return all.
    low = []
    for r in rows:
        try:
            current = getattr(r, "current_quantity", None)
            par = getattr(r, "par_level", None) or 0
            if current is not None and current <= par:
                low.append({
                    "id":       r.id,
                    "name":     getattr(r, "name", "?"),
                    "current":  current,
                    "par":      par,
                    "unit":     getattr(r, "unit", ""),
                })
        except Exception:
            continue
    return {"low_stock_count": len(low), "items": low[:30]}


def tool_get_top_customers(ctx: UserContext, *, limit: int = 10) -> dict:
    """Top customers by total spend — useful for marketing tools, VIP
    treatment, retention strategy."""
    rows = (
        ctx.db.query(CRMCustomer)
        .filter(CRMCustomer.user_id == ctx.user_id)
        .order_by(CRMCustomer.total_spend.desc())
        .limit(max(1, min(limit, 50)))
        .all()
    )
    return {
        "count": len(rows),
        "customers": [
            {
                "name":         r.name,
                "total_visits": r.total_visits,
                "total_spend":  r.total_spend,
                "last_visit":   r.last_visit.isoformat() if r.last_visit else None,
                "tags":         r.tags,
            } for r in rows
        ],
    }


# ── Action tools (write to DB) ─────────────────────────────────────────────
#
# Action tools mutate state on the user's behalf. They auto-execute on
# Flavor's call — no two-step confirmation round-trip — because the
# conversation makes user intent clear ("add eggs to my pantry"), and
# every action lands in BehaviorLog so the user can audit.
#
# All actions scope to ctx.user_id. Restaurant actions additionally
# verify the target row's user_id matches the caller — a restaurant
# operator can't accept another restaurant's booking even if Claude
# misroutes.

def _log_action(ctx: UserContext, action: str, meta: dict) -> None:
    """Audit-log a Flavor-initiated mutation. Mirrors the _log pattern
    in consumer routes. Best-effort: never blocks the action."""
    try:
        from ..models.consumer import BehaviorLog
        row = BehaviorLog(
            user_id=ctx.user_id,
            action_type=f"flavor_action:{action}",
            meta=json.dumps(meta, default=str)[:1000],
        )
        ctx.db.add(row)
        ctx.db.commit()
    except Exception:
        ctx.db.rollback()


def tool_add_to_pantry(ctx: UserContext, *, ingredient: str, quantity: str = "", category: str = "") -> dict:
    """Add an ingredient to the user's pantry."""
    name = (ingredient or "").strip()
    if not name:
        return {"error": "ingredient is required"}
    if len(name) > 100:
        return {"error": "ingredient name too long"}
    item = PantryItem(
        user_id=ctx.user_id,
        ingredient=name,
        quantity=quantity.strip() or None,
        category=category.strip() or None,
    )
    ctx.db.add(item)
    ctx.db.commit()
    ctx.db.refresh(item)
    _log_action(ctx, "add_to_pantry", {"ingredient": name, "quantity": quantity, "category": category})
    return {"ok": True, "id": item.id, "ingredient": item.ingredient}


def tool_remove_from_pantry(ctx: UserContext, *, ingredient: str) -> dict:
    """Remove an ingredient from the user's pantry by name (case-insensitive
    match on the most recent entry with that name)."""
    name = (ingredient or "").strip()
    if not name:
        return {"error": "ingredient is required"}
    row = (
        ctx.db.query(PantryItem)
        .filter(PantryItem.user_id == ctx.user_id)
        .filter(PantryItem.ingredient.ilike(name))
        .order_by(PantryItem.added_at.desc())
        .first()
    )
    if not row:
        return {"ok": False, "error": f"'{name}' not found in your pantry"}
    ctx.db.delete(row)
    ctx.db.commit()
    _log_action(ctx, "remove_from_pantry", {"ingredient": name})
    return {"ok": True, "removed": name}


def tool_log_meal_memory(ctx: UserContext, *, dish_name: str, rating: int = 5,
                        emoji: str = "🍽️", notes: str = "", cuisine: str = "",
                        what_to_change: str = "") -> dict:
    """Save a meal memory to the user's food journal."""
    name = (dish_name or "").strip()
    if not name:
        return {"error": "dish_name is required"}
    rating = max(1, min(int(rating or 5), 5))
    memory = MealMemory(
        user_id=ctx.user_id,
        dish_name=name[:150],
        emoji=(emoji or "🍽️")[:10],
        rating=rating,
        notes=notes.strip() or None,
        what_id_change=what_to_change.strip() or None,
        cuisine=cuisine.strip() or None,
    )
    ctx.db.add(memory)
    ctx.db.commit()
    ctx.db.refresh(memory)
    _log_action(ctx, "log_meal_memory", {"dish_name": name, "rating": rating})
    return {"ok": True, "id": memory.id, "dish_name": memory.dish_name, "rating": rating}


# Profile fields we let Flavor write to. Excludes anything sensitive
# (email, password, account_type, employer_id) or that would mess up
# the unified shell (account_type changes route the user elsewhere).
_PROFILE_WRITABLE_FIELDS = {
    "first_name", "last_name", "city", "country", "bio",
    "kitchen_style", "skill_level", "cooking_frequency", "cooking_time_pref",
    "ingredient_budget", "language",
    # JSON-text fields — Flavor passes the list directly, we serialise.
    "cuisine_preferences", "cuisine_dislikes", "dietary_preferences",
    "cooking_goals", "meal_types", "kitchen_tools", "music_genres",
}


def tool_update_preferences_field(ctx: UserContext, *, field: str, value) -> dict:
    """Update a single profile field. JSON-text fields accept a list."""
    field = (field or "").strip()
    if field not in _PROFILE_WRITABLE_FIELDS:
        return {"error": f"field '{field}' is not writable via Flavor"}
    u = ctx.db.query(User).filter(User.id == ctx.user_id).first()
    if not u:
        return {"error": "user not found"}
    # JSON-text fields get serialised; everything else is a plain string.
    if field in {"cuisine_preferences", "cuisine_dislikes", "dietary_preferences",
                 "cooking_goals", "meal_types", "kitchen_tools", "music_genres"}:
        if not isinstance(value, list):
            return {"error": f"field '{field}' expects a list"}
        setattr(u, field, json.dumps(value))
    else:
        if not isinstance(value, (str, int, float)):
            return {"error": f"field '{field}' expects a string"}
        setattr(u, field, str(value))
    ctx.db.commit()
    _log_action(ctx, "update_preferences", {"field": field, "value": str(value)[:100]})
    return {"ok": True, "field": field}


def tool_create_booking(ctx: UserContext, *, restaurant_name: str, date: str,
                       time: str = "19:00", party_size: int = 2,
                       special_requests: str = "") -> dict:
    """Create a restaurant booking. Dates are ISO format (YYYY-MM-DD)."""
    name = (restaurant_name or "").strip()
    if not name:
        return {"error": "restaurant_name is required"}
    if not date or len(date) < 8:
        return {"error": "date is required (YYYY-MM-DD)"}
    party_size = max(1, min(int(party_size or 2), 20))
    booking = DinerBooking(
        user_id=ctx.user_id,
        restaurant_name=name[:150],
        booking_date=date.strip(),
        booking_time=(time or "19:00").strip()[:10],
        party_size=party_size,
        special_requests=special_requests.strip() or None,
        status="pending",
    )
    ctx.db.add(booking)
    ctx.db.commit()
    ctx.db.refresh(booking)
    _log_action(ctx, "create_booking", {"restaurant": name, "date": date, "time": time})
    return {
        "ok": True, "id": booking.id,
        "restaurant": booking.restaurant_name,
        "date": booking.booking_date, "time": booking.booking_time,
        "party_size": booking.party_size, "status": booking.status,
        "note": "Booking is in 'pending' status until the restaurant confirms.",
    }


def tool_log_visit(ctx: UserContext, *, restaurant_name: str, visit_date: str,
                  rating: float = 5.0, items: str = "",
                  highlights: str = "", lowlights: str = "",
                  would_return: bool = True) -> dict:
    """Log a past restaurant visit to the diner's history."""
    name = (restaurant_name or "").strip()
    if not name:
        return {"error": "restaurant_name is required"}
    if not visit_date:
        return {"error": "visit_date is required (YYYY-MM-DD)"}
    visit = DinerVisit(
        user_id=ctx.user_id,
        restaurant_name=name[:150],
        visit_date=visit_date.strip(),
        items_ordered=items.strip() or None,
        overall_rating=max(0.0, min(float(rating or 5.0), 5.0)),
        food_rating=max(0.0, min(float(rating or 5.0), 5.0)),
        staff_rating=max(0.0, min(float(rating or 5.0), 5.0)),
        highlights=highlights.strip() or None,
        lowlights=lowlights.strip() or None,
        would_return=bool(would_return),
    )
    ctx.db.add(visit)
    ctx.db.commit()
    ctx.db.refresh(visit)
    _log_action(ctx, "log_visit", {"restaurant": name, "date": visit_date, "rating": rating})
    return {"ok": True, "id": visit.id, "restaurant": visit.restaurant_name, "rating": visit.overall_rating}


# ── Restaurant action tools ────────────────────────────────────────────────

def tool_add_menu_item(ctx: UserContext, *, name: str, category: str, price: float,
                     cost: float = 0.0, description: str = "") -> dict:
    """Add a new item to the restaurant's menu."""
    n = (name or "").strip()
    if not n:
        return {"error": "name is required"}
    if not category:
        return {"error": "category is required"}
    if price is None or price <= 0:
        return {"error": "price must be > 0"}
    item = MenuItem(
        user_id=ctx.user_id,
        name=n[:150],
        category=category.strip(),
        price=float(price),
        cost=max(0.0, float(cost or 0)),
        description=description.strip()[:500],
    )
    ctx.db.add(item)
    ctx.db.commit()
    ctx.db.refresh(item)
    _log_action(ctx, "add_menu_item", {"name": n, "category": category, "price": price})
    return {"ok": True, "id": item.id, "name": item.name}


def tool_update_menu_item(ctx: UserContext, *, item_id: int, name: str = "",
                        category: str = "", price: float = None,
                        cost: float = None, description: str = None) -> dict:
    """Update fields on a menu item the restaurant operator owns."""
    item = (
        ctx.db.query(MenuItem)
        .filter(MenuItem.id == item_id, MenuItem.user_id == ctx.user_id)
        .first()
    )
    if not item:
        return {"error": f"menu item {item_id} not found in your menu"}
    if name:        item.name = name.strip()[:150]
    if category:    item.category = category.strip()
    if price is not None and price > 0:  item.price = float(price)
    if cost is not None and cost >= 0:   item.cost = float(cost)
    if description is not None:          item.description = description.strip()[:500]
    ctx.db.commit()
    _log_action(ctx, "update_menu_item", {"item_id": item_id})
    return {"ok": True, "id": item.id, "name": item.name}


def tool_accept_booking(ctx: UserContext, *, booking_id: int) -> dict:
    """Mark an incoming booking as confirmed."""
    booking = (
        ctx.db.query(Booking)
        .filter(Booking.id == booking_id, Booking.user_id == ctx.user_id)
        .first()
    )
    if not booking:
        return {"error": f"booking {booking_id} not found"}
    booking.status = "confirmed"
    ctx.db.commit()
    _log_action(ctx, "accept_booking", {"booking_id": booking_id})
    return {"ok": True, "id": booking_id, "status": "confirmed"}


def tool_decline_booking(ctx: UserContext, *, booking_id: int, reason: str) -> dict:
    """Mark an incoming booking as declined. A reason is required so the
    audit log captures why; the reason can be surfaced to the customer
    in a follow-up touch-point."""
    if not (reason or "").strip():
        return {"error": "reason is required to decline a booking"}
    booking = (
        ctx.db.query(Booking)
        .filter(Booking.id == booking_id, Booking.user_id == ctx.user_id)
        .first()
    )
    if not booking:
        return {"error": f"booking {booking_id} not found"}
    booking.status = "declined"
    booking.notes = (booking.notes or "") + f"\n[declined] {reason.strip()}"
    ctx.db.commit()
    _log_action(ctx, "decline_booking", {"booking_id": booking_id, "reason": reason.strip()[:200]})
    return {"ok": True, "id": booking_id, "status": "declined"}


# ── Phase 9b action tools ──────────────────────────────────────────────────

def tool_add_pantry_bulk(ctx: UserContext, *, items: list) -> dict:
    """Add several pantry ingredients in one call — for parsing a
    shopping list the user pasted. Each item is {ingredient, quantity?,
    category?}. Skips blank / overlong names rather than failing the
    whole batch."""
    if not isinstance(items, list) or not items:
        return {"error": "items must be a non-empty list"}
    added, skipped = [], []
    for raw in items[:50]:  # cap so a giant paste can't hammer the DB
        if isinstance(raw, str):
            name, qty, cat = raw.strip(), "", ""
        elif isinstance(raw, dict):
            name = str(raw.get("ingredient", "")).strip()
            qty = str(raw.get("quantity", "") or "").strip()
            cat = str(raw.get("category", "") or "").strip()
        else:
            skipped.append(str(raw)[:40]); continue
        if not name or len(name) > 100:
            skipped.append(name[:40] or "(blank)"); continue
        ctx.db.add(PantryItem(
            user_id=ctx.user_id, ingredient=name,
            quantity=qty or None, category=cat or None,
        ))
        added.append(name)
    ctx.db.commit()
    _log_action(ctx, "add_pantry_bulk", {"added": len(added), "skipped": len(skipped)})
    return {"ok": True, "added": added, "added_count": len(added), "skipped": skipped}


def tool_cancel_booking(ctx: UserContext, *, booking_id: int) -> dict:
    """Cancel one of the user's own restaurant bookings (diner side)."""
    booking = (
        ctx.db.query(DinerBooking)
        .filter(DinerBooking.id == booking_id, DinerBooking.user_id == ctx.user_id)
        .first()
    )
    if not booking:
        return {"error": f"booking {booking_id} not found in your bookings"}
    if booking.status == "cancelled":
        return {"ok": True, "id": booking_id, "status": "cancelled", "note": "already cancelled"}
    booking.status = "cancelled"
    ctx.db.commit()
    _log_action(ctx, "cancel_booking", {"booking_id": booking_id})
    return {"ok": True, "id": booking_id, "status": "cancelled"}


def tool_add_crm_customer(ctx: UserContext, *, name: str, email: str = "",
                         phone: str = "", tags: str = "", notes: str = "") -> dict:
    """Add a customer to the restaurant's CRM."""
    n = (name or "").strip()
    if not n:
        return {"error": "name is required"}
    customer = CRMCustomer(
        user_id=ctx.user_id,
        name=n[:150],
        email=email.strip() or None,
        phone=phone.strip() or None,
        tags=tags.strip() or None,
        notes=notes.strip() or None,
    )
    ctx.db.add(customer)
    ctx.db.commit()
    ctx.db.refresh(customer)
    _log_action(ctx, "add_crm_customer", {"name": n})
    return {"ok": True, "id": customer.id, "name": customer.name}


_ADJUSTMENT_TYPES = ("delivery", "usage", "waste", "count_correction")


def tool_log_inventory_adjustment(ctx: UserContext, *, item_id: int,
                                 adjustment_type: str, delta: float,
                                 note: str = "") -> dict:
    """Append an inventory ledger entry — a delivery, usage, waste, or
    count correction. delta is positive for stock-in (delivery,
    upward correction), negative for stock-out (usage, waste)."""
    atype = (adjustment_type or "").strip().lower()
    if atype not in _ADJUSTMENT_TYPES:
        return {"error": f"adjustment_type must be one of {_ADJUSTMENT_TYPES}"}
    # Verify the item belongs to this operator before writing the ledger row.
    item = (
        ctx.db.query(InventoryItem)
        .filter(InventoryItem.id == item_id, InventoryItem.user_id == ctx.user_id)
        .first()
    )
    if not item:
        return {"error": f"inventory item {item_id} not found in your inventory"}
    try:
        delta_f = float(delta)
    except (TypeError, ValueError):
        return {"error": "delta must be a number"}
    adj = InventoryAdjustment(
        item_id=item_id,
        user_id=ctx.user_id,
        adjustment_type=atype,
        delta=delta_f,
        note=note.strip() or None,
    )
    ctx.db.add(adj)
    ctx.db.commit()
    ctx.db.refresh(adj)
    _log_action(ctx, "log_inventory_adjustment", {
        "item_id": item_id, "type": atype, "delta": delta_f,
    })
    return {
        "ok": True, "id": adj.id, "item": item.name,
        "type": atype, "delta": delta_f,
    }


def tool_respond_to_review(ctx: UserContext, *, review_id: int, response_text: str) -> dict:
    """Post a public operator reply to a guest review. Overwrites any
    existing reply (operators can revise). user_id-scoped so an operator
    can only respond to their own restaurant's reviews."""
    import datetime as _dt
    text = (response_text or "").strip()
    if not text:
        return {"error": "response_text is required"}
    if len(text) > 2000:
        return {"error": "response is too long (2000 char max)"}
    review = (
        ctx.db.query(Review)
        .filter(Review.id == review_id, Review.user_id == ctx.user_id)
        .first()
    )
    if not review:
        return {"error": f"review {review_id} not found in your reviews"}
    review.response = text
    review.responded_at = _dt.datetime.utcnow()
    ctx.db.commit()
    _log_action(ctx, "respond_to_review", {"review_id": review_id})
    return {
        "ok": True, "review_id": review_id,
        "customer": review.customer_name,
        "your_response": text,
    }


# ── Flavor memory (Phase 10) ───────────────────────────────────────────────
#
# Persistent per-user facts. remember_fact writes them; they get
# auto-injected into the system prompt by assistant_service via
# load_user_memories() below, so Flavor always has them without a
# tool round-trip. recall_facts + forget_fact let the user audit
# and prune.

MEMORY_CAP = 60  # max durable facts per user — eviction kicks in past this

_MEMORY_CATEGORIES = ("dietary", "equipment", "preference", "skill", "context")


def tool_remember_fact(ctx: UserContext, *, fact: str, category: str = "context") -> dict:
    """Save a durable fact about the user. Use for things that stay
    true across conversations — allergies, kitchen equipment, strong
    preferences, skill level, ongoing context. NOT for transient
    stuff ('making pasta tonight')."""
    text = (fact or "").strip()
    if not text:
        return {"error": "fact is required"}
    if len(text) > 300:
        return {"error": "fact too long (300 char max) — keep it a single crisp statement"}
    cat = (category or "context").strip().lower()
    if cat not in _MEMORY_CATEGORIES:
        cat = "context"

    # De-dupe: if a near-identical fact already exists, skip silently.
    existing = (
        ctx.db.query(FlavorMemory)
        .filter(FlavorMemory.user_id == ctx.user_id)
        .all()
    )
    if any(text.lower() == (m.fact or "").lower() for m in existing):
        return {"ok": True, "note": "already remembered", "fact": text}

    # Eviction: at the cap, drop the least-recently-referenced fact so
    # the agent can't write unbounded rows.
    if len(existing) >= MEMORY_CAP:
        victim = sorted(
            existing,
            key=lambda m: (m.last_referenced_at or m.created_at or datetime.min),
        )[0]
        ctx.db.delete(victim)

    mem = FlavorMemory(user_id=ctx.user_id, fact=text, category=cat)
    ctx.db.add(mem)
    ctx.db.commit()
    ctx.db.refresh(mem)
    _log_action(ctx, "remember_fact", {"category": cat, "fact": text[:120]})
    return {"ok": True, "id": mem.id, "fact": text, "category": cat}


def tool_recall_facts(ctx: UserContext, *, category: str = "") -> dict:
    """List what Flavor remembers about the user. Optionally filter by
    category. Mostly for 'what do you know about me?' questions —
    facts are already auto-injected into the system prompt."""
    q = ctx.db.query(FlavorMemory).filter(FlavorMemory.user_id == ctx.user_id)
    if category:
        q = q.filter(FlavorMemory.category == category.strip().lower())
    rows = q.order_by(FlavorMemory.created_at.desc()).all()
    return {
        "count": len(rows),
        "facts": [
            {"id": m.id, "fact": m.fact, "category": m.category}
            for m in rows
        ],
    }


def tool_forget_fact(ctx: UserContext, *, fact: str) -> dict:
    """Remove a remembered fact by fuzzy match (case-insensitive
    substring). Use when the user says something is no longer true."""
    needle = (fact or "").strip().lower()
    if not needle:
        return {"error": "fact is required"}
    rows = (
        ctx.db.query(FlavorMemory)
        .filter(FlavorMemory.user_id == ctx.user_id)
        .all()
    )
    match = next((m for m in rows if needle in (m.fact or "").lower()), None)
    if not match:
        return {"ok": False, "error": f"no remembered fact matching '{fact}'"}
    forgotten = match.fact
    ctx.db.delete(match)
    ctx.db.commit()
    _log_action(ctx, "forget_fact", {"fact": forgotten[:120]})
    return {"ok": True, "forgotten": forgotten}


def load_user_memories(db: Session, user_id: int) -> list[dict]:
    """Read every remembered fact for a user — called by assistant_service
    to auto-inject into the system prompt. Bumps last_referenced_at on
    everything it returns so the eviction policy favours genuinely
    stale facts. Returns [] on any error (memory is a nice-to-have,
    never blocks the chat)."""
    try:
        rows = (
            db.query(FlavorMemory)
            .filter(FlavorMemory.user_id == user_id)
            .order_by(FlavorMemory.category, FlavorMemory.created_at)
            .all()
        )
        if rows:
            now = datetime.utcnow()
            for m in rows:
                m.last_referenced_at = now
            db.commit()
        return [{"fact": m.fact, "category": m.category} for m in rows]
    except Exception:
        db.rollback()
        return []


# ── Composite tools ────────────────────────────────────────────────────────
#
# These bundle a common multi-step workflow into one deterministic call
# so Flavor doesn't burn 3-4 tool-call round-trips orchestrating it
# herself. They're plain Python — no nested Claude call — so they're
# cheap + predictable.

def tool_build_shopping_list(ctx: UserContext, *, recipe_id: int) -> dict:
    """Given a recipe, return what the user still needs to buy: the
    recipe's ingredients minus whatever's already in their pantry.
    Composite of get_recipe + get_pantry, diffed."""
    recipe = recipe_service.get_recipe_by_id(recipe_id)
    if not recipe:
        return {"error": f"recipe {recipe_id} not found"}
    recipe_ings = recipe.get("ingredients", []) or []

    pantry_rows = (
        ctx.db.query(PantryItem)
        .filter(PantryItem.user_id == ctx.user_id)
        .all()
    )
    # Pantry match is fuzzy-ish: an ingredient line "400g spaghetti"
    # counts as covered if the pantry has an entry whose name appears
    # as a word in the line. Cheap + good enough — Flavor can refine
    # in conversation if it gets it wrong.
    pantry_names = [(p.ingredient or "").lower().strip() for p in pantry_rows if p.ingredient]

    have, need = [], []
    for line in recipe_ings:
        line_l = str(line).lower()
        matched = next((pn for pn in pantry_names if pn and pn in line_l), None)
        (have if matched else need).append(line)

    return {
        "recipe":      recipe.get("title"),
        "recipe_id":   recipe_id,
        "need_to_buy": need,
        "already_have": have,
        "need_count":  len(need),
    }


def tool_suggest_tonight(ctx: UserContext) -> dict:
    """One-shot 'what should I cook tonight' — composites the user's
    pantry + preferences + recent journal into a single recipe search,
    returns the top pick + a couple of runners-up. Saves Flavor from
    chaining get_pantry → get_user_preferences → search_recipes by
    hand on a question she gets constantly."""
    # Pantry → ingredients string for the recipe search.
    pantry_rows = (
        ctx.db.query(PantryItem)
        .filter(PantryItem.user_id == ctx.user_id)
        .limit(50).all()
    )
    ingredients = ",".join(p.ingredient for p in pantry_rows if p.ingredient)

    # Preferences → bias the search toward a liked cuisine, away from
    # disliked ones (the recipe engine doesn't do negative filters, so
    # we just post-filter dislikes out).
    u = ctx.db.query(User).filter(User.id == ctx.user_id).first()
    liked = _safe_json(u.cuisine_preferences, []) if u else []
    disliked = {c.lower() for c in (_safe_json(u.cuisine_dislikes, []) if u else [])}
    cuisine = liked[0] if liked else ""

    # Recent journal → don't re-suggest something cooked in the last 5 entries.
    recent = (
        ctx.db.query(MealMemory)
        .filter(MealMemory.user_id == ctx.user_id)
        .order_by(MealMemory.cooked_at.desc())
        .limit(5).all()
    )
    recent_dishes = {(m.dish_name or "").lower() for m in recent}

    result = recipe_service.get_recipe_recommendations(
        cuisine=cuisine, ingredients=ingredients,
    )
    picks = [
        r for r in result.get("recipes", [])
        if r.get("cuisine", "").lower() not in disliked
        and r.get("title", "").lower() not in recent_dishes
    ]
    return {
        "based_on": {
            "pantry_items":     len(pantry_rows),
            "preferred_cuisine": cuisine or None,
            "avoided_cuisines": sorted(disliked) or None,
            "skipped_recent":   sorted(recent_dishes) or None,
        },
        "top_pick":    picks[0] if picks else None,
        "runners_up":  picks[1:4],
    }


# ── Anthropic tool definitions ─────────────────────────────────────────────
#
# Schema format follows https://docs.anthropic.com/en/docs/build-with-claude/tool-use.
# Descriptions are aggressively concrete — Claude routes tool calls based
# almost entirely on these. Vague descriptions = worse routing.

TOOL_DEFINITIONS = [
    {
        "name": "search_wines",
        "description": (
            "Search SavoryMind's wine catalog. Returns matching grape varietals "
            "with style, flavour profile, regions, price range, serving "
            "temperature, and decanting guidance. Use when the user asks "
            "about specific wines, wants to browse, or asks for wines "
            "matching a style/region."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query":  {"type": "string", "description": "Free-text search (grape name, flavour word, region)."},
                "style":  {"type": "string", "description": "Style filter, e.g. 'Full-bodied Red', 'Sparkling'."},
                "region": {"type": "string", "description": "Region filter, e.g. 'Burgundy', 'Argentina'."},
            },
        },
    },
    {
        "name": "search_beers",
        "description": (
            "Search the beer catalog. Returns matching beers with style, "
            "brewery, ABV, flavour notes, and serving guidance."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query":   {"type": "string"},
                "style":   {"type": "string", "description": "e.g. 'IPA', 'Stout'."},
                "min_abv": {"type": "number"},
                "max_abv": {"type": "number"},
            },
        },
    },
    {
        "name": "search_spirits",
        "description": (
            "Search the spirits catalog (whisky, tequila, rum, gin, etc.). "
            "Returns matching spirits with category, region, ABV, flavour."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query":  {"type": "string"},
                "spirit": {"type": "string", "description": "e.g. 'Whisky', 'Tequila'."},
                "region": {"type": "string"},
            },
        },
    },
    {
        "name": "get_wine_pairing",
        "description": (
            "Get specific wine recommendations for a dish. Returns 1-3 "
            "wines ranked by confidence with rationale. Use when the user "
            "asks 'what wine with X' or 'what pairs with X'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"dish": {"type": "string", "description": "Dish name + brief description."}},
            "required": ["dish"],
        },
    },
    {
        "name": "get_beer_pairing",
        "description": "Get beer pairing recommendations for a dish.",
        "input_schema": {
            "type": "object",
            "properties": {"dish": {"type": "string"}},
            "required": ["dish"],
        },
    },
    {
        "name": "get_spirits_pairing",
        "description": "Get spirits / cocktail pairing recommendations for a dish.",
        "input_schema": {
            "type": "object",
            "properties": {"dish": {"type": "string"}},
            "required": ["dish"],
        },
    },
    {
        "name": "search_recipes",
        "description": (
            "Search SavoryMind's recipe catalog by cuisine, mood, "
            "keywords, ingredients on hand, max prep time, or difficulty. "
            "Returns up to 12 recipes ranked by relevance."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "cuisine":     {"type": "string", "description": "Cuisine filter, e.g. 'Italian', 'Thai'."},
                "mood":        {"type": "string", "description": "Mood filter, e.g. 'cozy', 'quick'."},
                "keywords":    {"type": "string", "description": "Free-text keywords."},
                "ingredients": {"type": "string", "description": "Comma-separated ingredients on hand."},
                "max_time":    {"type": "integer", "description": "Max prep+cook time in minutes."},
                "difficulty":  {"type": "string", "description": "'Easy', 'Medium', or 'Hard'."},
            },
        },
    },
    {
        "name": "get_recipe",
        "description": "Fetch full ingredients + steps for a specific recipe by ID.",
        "input_schema": {
            "type": "object",
            "properties": {"recipe_id": {"type": "integer"}},
            "required": ["recipe_id"],
        },
    },
    {
        "name": "get_pantry",
        "description": (
            "List ingredients the current user has in their pantry. "
            "Useful before suggesting recipes — match against what they "
            "actually have on hand."
        ),
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "get_journal_recent",
        "description": (
            "Recent meals the current user has logged in their food journal. "
            "Useful for understanding their recent cooking, repeats, and "
            "what they enjoyed (rating)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"limit": {"type": "integer", "default": 10, "minimum": 1, "maximum": 50}},
        },
    },
    {
        "name": "get_user_preferences",
        "description": (
            "Read the current user's food + cooking preferences from their "
            "profile: kitchen style, skill, time budget, cuisine likes/"
            "dislikes, dietary restrictions, flavour profile, cooking "
            "goals, drinking habits. Call this when an answer would be "
            "noticeably better with personal context."
        ),
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "build_shopping_list",
        "description": (
            "Given a recipe ID, return what the user still needs to buy — "
            "the recipe's ingredients minus what's already in their "
            "pantry. One call instead of get_recipe + get_pantry + a "
            "manual diff."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"recipe_id": {"type": "integer"}},
            "required": ["recipe_id"],
        },
    },
    {
        "name": "suggest_tonight",
        "description": (
            "One-shot 'what should I cook tonight?' — composites the "
            "user's pantry + cuisine preferences + recent journal into a "
            "single ranked recipe pick (+ a couple runners-up). Avoids "
            "disliked cuisines and dishes cooked in the last few days. "
            "Prefer this over chaining get_pantry → get_user_preferences "
            "→ search_recipes by hand."
        ),
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "remember_fact",
        "description": (
            "Save a DURABLE fact about the user — something that stays "
            "true across conversations. Good: allergies/intolerances, "
            "kitchen equipment ('no food processor', 'oven runs hot'), "
            "strong tastes ('hates cilantro', 'prefers metric'), skill "
            "level, ongoing context ('cooking for a date this Friday'). "
            "Do NOT remember transient things ('making pasta tonight'). "
            "Remembered facts are auto-loaded into your context every "
            "future conversation — so only save what's worth carrying. "
            "category is one of: dietary, equipment, preference, skill, "
            "context."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "fact":     {"type": "string", "description": "One crisp statement, ≤300 chars."},
                "category": {"type": "string", "enum": ["dietary", "equipment", "preference", "skill", "context"]},
            },
            "required": ["fact"],
        },
    },
    {
        "name": "recall_facts",
        "description": (
            "List what you remember about the user. Optionally filter by "
            "category. You already have these facts in your context — "
            "use this tool mainly for 'what do you know about me?' "
            "questions or to find a fact's exact wording before "
            "forgetting it."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"category": {"type": "string"}},
        },
    },
    {
        "name": "forget_fact",
        "description": (
            "Remove a remembered fact (fuzzy substring match). Use when "
            "the user says something is no longer true ('I'm not vegan "
            "anymore', 'I got a new oven')."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"fact": {"type": "string"}},
            "required": ["fact"],
        },
    },
]


# ── Per-role tool definitions (appended via tools_for_user) ────────────────

_DINER_TOOL_DEFINITIONS = [
    {
        "name": "get_my_bookings",
        "description": (
            "List the current user's restaurant bookings (upcoming + past). "
            "Optionally filter by status."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "status": {"type": "string", "description": "'confirmed', 'pending', or 'cancelled'."},
            },
        },
    },
    {
        "name": "get_visit_history",
        "description": (
            "Recent restaurant visits the user has logged — what they "
            "ordered, ratings, highlights / lowlights, would-return."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"limit": {"type": "integer", "default": 10, "minimum": 1, "maximum": 50}},
        },
    },
    # ── Action tools (write) ──
    {
        "name": "add_to_pantry",
        "description": (
            "Add an ingredient to the user's pantry. ONLY call when the user "
            "EXPLICITLY says to add something (e.g. 'add eggs to my pantry'). "
            "Do NOT call when the user is just talking about ingredients or "
            "asking what to cook with X."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "ingredient": {"type": "string"},
                "quantity":   {"type": "string", "description": "Optional, e.g. '2 lb'"},
                "category":   {"type": "string", "description": "Optional, e.g. 'produce'"},
            },
            "required": ["ingredient"],
        },
    },
    {
        "name": "remove_from_pantry",
        "description": "Remove an ingredient from the user's pantry by name. Only call on explicit 'remove' / 'used up'.",
        "input_schema": {
            "type": "object",
            "properties": {"ingredient": {"type": "string"}},
            "required": ["ingredient"],
        },
    },
    {
        "name": "log_meal_memory",
        "description": (
            "Save a meal to the user's food journal. Call after the user "
            "confirms they cooked + want it logged (e.g. 'log that I made "
            "the carbonara, 5 stars')."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "dish_name":      {"type": "string"},
                "rating":         {"type": "integer", "minimum": 1, "maximum": 5, "default": 5},
                "emoji":          {"type": "string"},
                "notes":          {"type": "string"},
                "cuisine":        {"type": "string"},
                "what_to_change": {"type": "string"},
            },
            "required": ["dish_name"],
        },
    },
    {
        "name": "update_preferences_field",
        "description": (
            "Update a single profile preference field. Use when the user "
            "tells you about a preference change ('I'm vegetarian now', "
            "'I prefer Italian food'). Writable fields: first_name, "
            "last_name, city, country, bio, kitchen_style, skill_level, "
            "cooking_frequency, cooking_time_pref, ingredient_budget, "
            "language, and the list fields cuisine_preferences, "
            "cuisine_dislikes, dietary_preferences, cooking_goals, "
            "meal_types, kitchen_tools, music_genres."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "field": {"type": "string"},
                "value": {"description": "String for scalar fields; array for list fields."},
            },
            "required": ["field", "value"],
        },
    },
    {
        "name": "create_booking",
        "description": (
            "Create a restaurant booking for the user. Lands as 'pending' "
            "until the restaurant confirms. Confirm date + time + party "
            "size with the user before calling — bookings touch real "
            "restaurants and are mildly irreversible."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "restaurant_name":  {"type": "string"},
                "date":             {"type": "string", "description": "ISO date YYYY-MM-DD"},
                "time":             {"type": "string", "description": "HH:MM (24h)", "default": "19:00"},
                "party_size":       {"type": "integer", "minimum": 1, "maximum": 20, "default": 2},
                "special_requests": {"type": "string"},
            },
            "required": ["restaurant_name", "date"],
        },
    },
    {
        "name": "log_visit",
        "description": "Log a past restaurant visit to the diner's history.",
        "input_schema": {
            "type": "object",
            "properties": {
                "restaurant_name": {"type": "string"},
                "visit_date":      {"type": "string", "description": "ISO date YYYY-MM-DD"},
                "rating":          {"type": "number", "minimum": 0, "maximum": 5, "default": 5},
                "items":           {"type": "string", "description": "Comma-separated dishes"},
                "highlights":      {"type": "string"},
                "lowlights":       {"type": "string"},
                "would_return":    {"type": "boolean", "default": True},
            },
            "required": ["restaurant_name", "visit_date"],
        },
    },
    {
        "name": "add_pantry_bulk",
        "description": (
            "Add several pantry ingredients at once — use when the user "
            "pastes or dictates a shopping list. Each item is an object "
            "{ingredient, quantity?, category?} (or a plain ingredient "
            "string). Capped at 50 items per call."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "ingredient": {"type": "string"},
                            "quantity":   {"type": "string"},
                            "category":   {"type": "string"},
                        },
                        "required": ["ingredient"],
                    },
                },
            },
            "required": ["items"],
        },
    },
    {
        "name": "cancel_booking",
        "description": (
            "Cancel one of the user's OWN restaurant bookings. Only call "
            "on explicit 'cancel my booking' instruction."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"booking_id": {"type": "integer"}},
            "required": ["booking_id"],
        },
    },
]

_RESTAURANT_TOOL_DEFINITIONS = [
    {
        "name": "get_menu",
        "description": (
            "List the restaurant's menu items. Optionally filter by "
            "category ('Mains', 'Starters', 'Desserts', 'Drinks')."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"category": {"type": "string"}},
        },
    },
    {
        "name": "get_bookings_today",
        "description": (
            "Incoming bookings for the restaurant, today + next `days` "
            "days. Default = today only."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"days": {"type": "integer", "default": 1, "minimum": 1, "maximum": 14}},
        },
    },
    {
        "name": "get_sentiment_summary",
        "description": (
            "Aggregate review sentiment for the restaurant — total count, "
            "positive / neutral / negative breakdown, average rating."
        ),
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "get_inventory_low_stock",
        "description": (
            "Inventory items currently at or below par level — what "
            "the operator needs to reorder."
        ),
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "get_top_customers",
        "description": (
            "Top CRM customers by total spend — useful for retention + "
            "VIP outreach questions."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"limit": {"type": "integer", "default": 10, "minimum": 1, "maximum": 50}},
        },
    },
    # ── Restaurant action tools (write) ──
    {
        "name": "add_menu_item",
        "description": "Add a new item to the restaurant's menu.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name":        {"type": "string"},
                "category":    {"type": "string", "description": "'Mains' / 'Starters' / 'Desserts' / 'Drinks'"},
                "price":       {"type": "number", "exclusiveMinimum": 0},
                "cost":        {"type": "number", "minimum": 0, "default": 0},
                "description": {"type": "string"},
            },
            "required": ["name", "category", "price"],
        },
    },
    {
        "name": "update_menu_item",
        "description": "Update fields on an existing menu item. Pass only the fields you want to change.",
        "input_schema": {
            "type": "object",
            "properties": {
                "item_id":     {"type": "integer"},
                "name":        {"type": "string"},
                "category":    {"type": "string"},
                "price":       {"type": "number"},
                "cost":        {"type": "number"},
                "description": {"type": "string"},
            },
            "required": ["item_id"],
        },
    },
    {
        "name": "accept_booking",
        "description": "Confirm an incoming booking. Only call on explicit operator instruction.",
        "input_schema": {
            "type": "object",
            "properties": {"booking_id": {"type": "integer"}},
            "required": ["booking_id"],
        },
    },
    {
        "name": "decline_booking",
        "description": (
            "Decline an incoming booking. A reason is required (used in "
            "the audit log + can be surfaced to the customer)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "booking_id": {"type": "integer"},
                "reason":     {"type": "string"},
            },
            "required": ["booking_id", "reason"],
        },
    },
    {
        "name": "add_crm_customer",
        "description": "Add a customer to the restaurant's CRM.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name":  {"type": "string"},
                "email": {"type": "string"},
                "phone": {"type": "string"},
                "tags":  {"type": "string", "description": "Comma-separated, e.g. 'vip,regular'"},
                "notes": {"type": "string"},
            },
            "required": ["name"],
        },
    },
    {
        "name": "log_inventory_adjustment",
        "description": (
            "Append an inventory ledger entry. adjustment_type is one of "
            "'delivery' / 'usage' / 'waste' / 'count_correction'. delta is "
            "positive for stock-in (delivery, upward correction), negative "
            "for stock-out (usage, waste). The ledger is append-only — "
            "there is no edit / delete."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "item_id":         {"type": "integer"},
                "adjustment_type": {"type": "string", "enum": ["delivery", "usage", "waste", "count_correction"]},
                "delta":           {"type": "number"},
                "note":            {"type": "string"},
            },
            "required": ["item_id", "adjustment_type", "delta"],
        },
    },
    {
        "name": "respond_to_review",
        "description": (
            "Post a public operator reply to a guest review. Overwrites "
            "any existing reply (operators can revise). Keep replies "
            "warm, specific, and brief — acknowledge the guest, address "
            "the point, invite them back."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "review_id":     {"type": "integer"},
                "response_text": {"type": "string"},
            },
            "required": ["review_id", "response_text"],
        },
    },
]


# ── Dispatch table ─────────────────────────────────────────────────────────

_TOOLS = {
    # Universal — every authenticated user can call these.
    "search_wines":          tool_search_wines,
    "search_beers":          tool_search_beers,
    "search_spirits":        tool_search_spirits,
    "get_wine_pairing":      tool_get_wine_pairing,
    "get_beer_pairing":      tool_get_beer_pairing,
    "get_spirits_pairing":   tool_get_spirits_pairing,
    "search_recipes":        tool_search_recipes,
    "get_recipe":            tool_get_recipe,
    "get_pantry":            tool_get_pantry,
    "get_journal_recent":    tool_get_journal_recent,
    "get_user_preferences":  tool_get_user_preferences,
    "build_shopping_list":   tool_build_shopping_list,
    "suggest_tonight":       tool_suggest_tonight,
    "remember_fact":         tool_remember_fact,
    "recall_facts":          tool_recall_facts,
    "forget_fact":           tool_forget_fact,
    # Diner / consumer (unified) read tools.
    "get_my_bookings":       tool_get_my_bookings,
    "get_visit_history":     tool_get_visit_history,
    # Diner / consumer action tools (writes).
    "add_to_pantry":            tool_add_to_pantry,
    "remove_from_pantry":       tool_remove_from_pantry,
    "add_pantry_bulk":          tool_add_pantry_bulk,
    "log_meal_memory":          tool_log_meal_memory,
    "update_preferences_field": tool_update_preferences_field,
    "create_booking":           tool_create_booking,
    "cancel_booking":           tool_cancel_booking,
    "log_visit":                tool_log_visit,
    # Restaurant read tools.
    "get_menu":              tool_get_menu,
    "get_bookings_today":    tool_get_bookings_today,
    "get_sentiment_summary": tool_get_sentiment_summary,
    "get_inventory_low_stock": tool_get_inventory_low_stock,
    "get_top_customers":     tool_get_top_customers,
    # Restaurant action tools.
    "add_menu_item":            tool_add_menu_item,
    "update_menu_item":         tool_update_menu_item,
    "accept_booking":           tool_accept_booking,
    "decline_booking":          tool_decline_booking,
    "add_crm_customer":         tool_add_crm_customer,
    "log_inventory_adjustment": tool_log_inventory_adjustment,
    "respond_to_review":        tool_respond_to_review,
}


# Tools available to each role. Restaurant operators don't see the
# diner tools (their bookings table is different) and vice versa.
_ROLE_TOOLS = {
    "consumer":   _DINER_TOOL_DEFINITIONS,
    "diner":      _DINER_TOOL_DEFINITIONS,
    "restaurant": _RESTAURANT_TOOL_DEFINITIONS,
    "staff":      [],
}


def tools_for_user(ctx: UserContext) -> list[dict]:
    """Return the tool list to advertise to Claude for this user. Always
    includes the universal tools; role-specific tools layered on top."""
    return TOOL_DEFINITIONS + _ROLE_TOOLS.get((ctx.account_type or "").lower(), [])


def make_dispatcher(ctx: UserContext):
    """Build a closure-bound dispatcher for the conversation. The
    claude_client.call_with_tools loop calls dispatcher(name, args)
    when Claude requests a tool — we route to the right function with
    ctx injected.

    Role-gated: a restaurant operator can't accidentally call diner
    tools (and vice versa) even if Claude misroutes — the gate returns
    a clean error so the model can recover."""
    allowed_role_tools = {t["name"] for t in _ROLE_TOOLS.get((ctx.account_type or "").lower(), [])}
    universal_names = {t["name"] for t in TOOL_DEFINITIONS}

    def dispatch(name: str, args: dict[str, Any]):
        fn = _TOOLS.get(name)
        if fn is None:
            return {"error": f"unknown tool: {name}"}
        if name not in universal_names and name not in allowed_role_tools:
            return {"error": f"tool '{name}' not available for account_type='{ctx.account_type}'"}
        # Defensive copy — never pass mutable args from the SDK directly
        # into our typed kwargs.
        return fn(ctx, **dict(args or {}))
    return dispatch
