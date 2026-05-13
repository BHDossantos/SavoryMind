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
from typing import Any, Optional

from sqlalchemy.orm import Session

from ..data import get_wines, get_beers, get_spirits
from ..models.consumer import PantryItem, MealMemory
from ..models.diner import DinerBooking, DinerVisit
from ..models.menu import MenuItem
from ..models.restaurant_ext import Booking, CRMCustomer
from ..models.review import Review
from ..models.inventory import InventoryItem
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
    # Diner / consumer (unified) tools — bookings + visit history.
    "get_my_bookings":       tool_get_my_bookings,
    "get_visit_history":     tool_get_visit_history,
    # Restaurant-only tools.
    "get_menu":              tool_get_menu,
    "get_bookings_today":    tool_get_bookings_today,
    "get_sentiment_summary": tool_get_sentiment_summary,
    "get_inventory_low_stock": tool_get_inventory_low_stock,
    "get_top_customers":     tool_get_top_customers,
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
