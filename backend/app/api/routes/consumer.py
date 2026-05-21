import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel as pydantic_BaseModel
from sqlalchemy.orm import Session
from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...models.consumer import SocialConnection, BehaviorLog
from ...schemas.consumer import (
    WinePairingRequest, WinePairingResponse, WineRecommendation,
    MusicMoodRequest, MusicMoodResponse, MusicRecommendation,
    SocialConnectionUpdate, SocialConnectionResponse,
    ProfileUpdate, BehaviorLogCreate,
    PantryItemCreate, PantryItemResponse,
    MealMemoryCreate, MealMemoryResponse,
)
from ...services import wine_service, music_service, beverage_service, recipe_service, meal_plan_service, pantry_service, memory_service, delivery_service, assistant_service, conversation_service, posthog_client
from ...insights.engine import build_consumer_recommendations

router = APIRouter(prefix="/consumer", tags=["consumer"])


def _require_consumer(user: User) -> User:
    # Food Lover (consumer) and Food Explorer (diner) were unified into
    # a single shell — both are "food person" accounts with access to
    # the full consumer feature set (recipes, pairings, pantry, journal,
    # etc.). Restaurant + staff stay gated out because those features
    # don't apply to operator accounts.
    if user.account_type not in ("consumer", "diner"):
        raise HTTPException(status_code=403, detail="Consumer account required.")
    return user


def _log(db: Session, user_id: int, action_type: str, meta: dict | None = None) -> None:
    """Fire-and-forget behavior log. Silently swallows errors so it never breaks the main call."""
    try:
        log = BehaviorLog(
            user_id=user_id,
            action_type=action_type,
            action_meta=json.dumps(meta) if meta else None,
        )
        db.add(log)
        db.commit()
    except Exception:
        db.rollback()


def _safe_loads(raw: str | None, fallback):
    """Tolerate malformed/empty JSON columns instead of 500-ing the whole route."""
    if not raw:
        return fallback
    try:
        return json.loads(raw)
    except (ValueError, TypeError):
        return fallback


_MUSIC_FALLBACK = {
    "genres": [], "artists": [], "bpm_range": "", "vibe": "",
    "spotify_query": "", "emoji": "",
}


# ── Wine Pairing ──────────────────────────────────────────────────────────────

@router.post("/wine-pairing", response_model=WinePairingResponse, status_code=201)
def create_wine_pairing(
    body: WinePairingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_consumer(current_user)
    record = wine_service.save_pairing(db, current_user.id, body.dish_name, body.dish_description)
    _log(db, current_user.id, "wine_pairing", {"dish": body.dish_name})
    recs = [WineRecommendation(**r) for r in _safe_loads(record.recommendations, [])]
    return WinePairingResponse(id=record.id, dish_name=record.dish_name, recommendations=recs, created_at=record.created_at)


@router.get("/wine-pairing", response_model=list[WinePairingResponse])
def list_wine_pairings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_consumer(current_user)
    records = wine_service.get_pairings(db, current_user.id)
    result = []
    for r in records:
        recs = [WineRecommendation(**w) for w in _safe_loads(r.recommendations, [])]
        result.append(WinePairingResponse(id=r.id, dish_name=r.dish_name, recommendations=recs, created_at=r.created_at))
    return result


# ── Music Mood ────────────────────────────────────────────────────────────────

@router.post("/music-mood", response_model=MusicMoodResponse, status_code=201)
def create_music_mood(
    body: MusicMoodRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_consumer(current_user)
    record = music_service.save_music_mood(db, current_user.id, body.mood, body.food_type, body.occasion)
    _log(db, current_user.id, "music_mood", {"mood": body.mood, "food_type": body.food_type})
    recs = MusicRecommendation(**_safe_loads(record.recommendations, _MUSIC_FALLBACK))
    return MusicMoodResponse(
        id=record.id, mood=record.mood, food_type=record.food_type,
        occasion=record.occasion, recommendations=recs, created_at=record.created_at,
    )


@router.get("/music-mood", response_model=list[MusicMoodResponse])
def list_music_moods(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_consumer(current_user)
    records = music_service.get_music_moods(db, current_user.id)
    result = []
    for r in records:
        recs = MusicRecommendation(**_safe_loads(r.recommendations, {}))
        result.append(MusicMoodResponse(
            id=r.id, mood=r.mood, food_type=r.food_type,
            occasion=r.occasion, recommendations=recs, created_at=r.created_at,
        ))
    return result


# ── Social Connections ────────────────────────────────────────────────────────

@router.get("/connections", response_model=list[SocialConnectionResponse])
def get_connections(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_consumer(current_user)
    return db.query(SocialConnection).filter(SocialConnection.user_id == current_user.id).all()


@router.patch("/connections/{platform}", response_model=SocialConnectionResponse)
def update_connection(
    platform: str,
    body: SocialConnectionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_consumer(current_user)
    conn = db.query(SocialConnection).filter(
        SocialConnection.user_id == current_user.id,
        SocialConnection.platform == platform,
    ).first()
    if not conn:
        conn = SocialConnection(user_id=current_user.id, platform=platform)
        db.add(conn)
    conn.connected = body.connected
    conn.username = body.username
    conn.profile_url = body.profile_url
    db.commit()
    db.refresh(conn)
    _log(db, current_user.id, "social_connect", {"platform": platform, "connected": body.connected})
    return conn


# ── Profile ───────────────────────────────────────────────────────────────────

@router.patch("/profile")
def update_profile(
    body: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_consumer(current_user)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return {"id": current_user.id, "display_name": current_user.display_name, "bio": current_user.bio}


# ── Manual Behavior Logging ───────────────────────────────────────────────────

@router.post("/behavior", status_code=201)
def log_behavior(
    body: BehaviorLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _log(db, current_user.id, body.action_type, body.metadata)
    return {"status": "logged"}


# ── Recommendations (Claude + rules fallback) ───────────────────────────────────────────

@router.get("/recommendations")
def get_recommendations(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_consumer(current_user)
    _log(db, current_user.id, "view_recommendations")
    recs = build_consumer_recommendations(db, current_user)
    # Funnel signal: how many users actually see recommendations + how
    # many recommendations the engine returned. If this drops vs DAU,
    # something's wrong with the engine fallback path.
    posthog_client.capture(current_user.id, "recommendation_served", {
        "surface":          "consumer",
        "recommendations_count": len(recs) if isinstance(recs, list) else 0,
    })
    return recs


# ── Beverages ─────────────────────────────────────────────────────────────────

# ── Catalog browse endpoints (Phase 8) ────────────────────────────────────
# Return the full catalog with optional client-side filterable fields.
# Pairing endpoints below are dish→wines/beers/spirits; these are
# inventory→list-with-filters for the new browse UI.

@router.get("/catalog/wines")
def catalog_wines(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Full wine catalog (grape varietals). Frontend filters
    client-side for speed — the catalog is small enough that
    server-side filtering would just add round-trips."""
    _require_consumer(current_user)
    from ...data import get_wines
    catalog = get_wines()
    # Return as a list with the slug attached so the UI can render
    # consistent keys without reshaping.
    return {
        "count": len(catalog),
        "wines": [{"slug": slug, **entry} for slug, entry in catalog.items()],
    }


@router.get("/catalog/beers")
def catalog_beers(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Full beer catalog."""
    _require_consumer(current_user)
    from ...data import get_beers
    catalog = get_beers()
    return {"count": len(catalog), "beers": catalog}


@router.get("/catalog/spirits")
def catalog_spirits(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Full spirits catalog."""
    _require_consumer(current_user)
    from ...data import get_spirits
    catalog = get_spirits()
    return {"count": len(catalog), "spirits": catalog}


@router.get("/beverages/beer")
def beer_pairing(dish: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_consumer(current_user)
    if not dish or len(dish.strip()) < 2:
        raise HTTPException(status_code=422, detail="dish query param required.")
    _log(db, current_user.id, "beer_pairing", {"dish": dish.strip()})
    return beverage_service.get_beer_pairings(dish.strip())


@router.get("/beverages/spirits")
def spirits_pairing(dish: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_consumer(current_user)
    if not dish or len(dish.strip()) < 2:
        raise HTTPException(status_code=422, detail="dish query param required.")
    _log(db, current_user.id, "spirits_pairing", {"dish": dish.strip()})
    return beverage_service.get_spirits_pairings(dish.strip())


# ── Recipes ───────────────────────────────────────────────────────────────────

@router.get("/recipes")
def get_recipes(
    mood: str = "",
    cuisine: str = "",
    keywords: str = "",
    ingredients: str = "",
    max_time: int = 0,
    difficulty: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_consumer(current_user)
    if cuisine or ingredients:
        _log(db, current_user.id, "recipe_view", {"cuisine": cuisine, "mood": mood, "ingredients": ingredients})
    return recipe_service.get_recipe_recommendations(
        mood=mood, cuisine=cuisine, keywords=keywords,
        ingredients=ingredients, max_time=max_time, difficulty=difficulty,
    )


@router.get("/recipes/{recipe_id}")
def get_recipe(recipe_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_consumer(current_user)
    recipe = recipe_service.get_recipe_by_id(recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found.")
    _log(db, current_user.id, "recipe_view", {"recipe_id": recipe_id})
    return recipe


# ── Meal Planner ──────────────────────────────────────────────────────────────

@router.get("/meal-plan")
def get_meal_plan(
    dietary: str = "",
    max_cook_minutes: int = 120,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_consumer(current_user)
    _log(db, current_user.id, "meal_plan", {"dietary": dietary})
    return meal_plan_service.generate_meal_plan(dietary=dietary, max_cook_minutes=max_cook_minutes)


@router.get("/shopping-list")
def get_shopping_list(
    dietary: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_consumer(current_user)
    _log(db, current_user.id, "shopping_list", {"dietary": dietary})
    return meal_plan_service.generate_shopping_list(dietary=dietary)


@router.get("/daily-suggestion")
def get_daily_suggestion(
    mood: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_consumer(current_user)
    _log(db, current_user.id, "daily_suggestion", {"mood": mood})
    return meal_plan_service.get_daily_suggestion(mood=mood)


# ── Pantry ────────────────────────────────────────────────────────────────────

@router.get("/pantry", response_model=list[PantryItemResponse])
def get_pantry(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_consumer(current_user)
    return pantry_service.get_pantry(db, current_user.id)


@router.post("/pantry", response_model=PantryItemResponse, status_code=201)
def add_pantry_item(
    body: PantryItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_consumer(current_user)
    return pantry_service.add_item(db, current_user.id, body.ingredient, body.quantity, body.category)


@router.delete("/pantry/{item_id}", status_code=204)
def delete_pantry_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_consumer(current_user)
    if not pantry_service.delete_item(db, current_user.id, item_id):
        raise HTTPException(status_code=404, detail="Pantry item not found.")


@router.delete("/pantry", status_code=204)
def clear_pantry(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_consumer(current_user)
    pantry_service.clear_pantry(db, current_user.id)


@router.get("/pantry/recipes")
def recipes_from_pantry(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_consumer(current_user)
    items = pantry_service.get_pantry(db, current_user.id)
    if not items:
        return {"recipes": [], "matched_ingredients": []}
    keywords = ", ".join(i.ingredient for i in items[:10])
    _log(db, current_user.id, "pantry_recipes", {"ingredients": keywords})
    result = recipe_service.get_recipe_recommendations(
        cuisine="", mood="", keywords=keywords, ingredients=keywords, max_time=0, difficulty=""
    )
    return {"recipes": result.get("recipes", []), "matched_ingredients": [i.ingredient for i in items]}


# ── Meal Memories (journal) ───────────────────────────────────────────────────

@router.get("/memories", response_model=list[MealMemoryResponse])
def get_memories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_consumer(current_user)
    return memory_service.get_memories(db, current_user.id)


@router.post("/memories", response_model=MealMemoryResponse, status_code=201)
def create_memory(
    body: MealMemoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_consumer(current_user)
    mem = memory_service.create_memory(
        db, current_user.id,
        body.dish_name, body.emoji, body.rating,
        body.notes, body.what_id_change, body.cuisine, body.recipe_id,
    )
    _log(db, current_user.id, "meal_memory", {"dish": body.dish_name, "rating": body.rating})
    return mem


@router.delete("/memories/{memory_id}", status_code=204)
def delete_memory(
    memory_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_consumer(current_user)
    if not memory_service.delete_memory(db, current_user.id, memory_id):
        raise HTTPException(status_code=404, detail="Memory not found.")


# ── Delivery ──────────────────────────────────────────────────────────────────

@router.get("/delivery/dishes")
def get_delivery_dishes(
    craving: str = "",
    budget: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_consumer(current_user)
    dishes = delivery_service.get_dishes_for_craving(craving, budget)
    _log(db, current_user.id, "delivery_dishes", {"craving": craving, "budget": budget})
    return {"dishes": dishes}


@router.get("/delivery/restaurants")
def get_delivery_restaurants(
    cuisine: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_consumer(current_user)
    return {"restaurants": delivery_service.get_restaurants_for_cuisine(cuisine)}


# ── Culinary Assistant ────────────────────────────────────────────────────────

class _AssistantRequest(pydantic_BaseModel):
    question: str
    # Phase 14 — server-side conversation persistence. The client sends
    # the conversation_id it got back from a prior turn; the server
    # loads that thread's history from the DB. Omit / null to start a
    # fresh conversation. (The old client-managed `history` field is
    # gone — the server is now the source of truth.)
    conversation_id: Optional[int] = None


@router.post("/assistant")
def ask_assistant(
    body: _AssistantRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Flavor is the unified AI voice — useful to consumers cooking at home,
    # diners thinking about pairings, AND restaurant operators looking at
    # the menu. Endpoint is open to any logged-in user (Phase 5).
    if not body.question or not body.question.strip():
        raise HTTPException(status_code=422, detail="question is required.")
    question = body.question.strip()
    _log(db, current_user.id, "assistant_query", {"question": question[:120]})

    # Load prior history from the persisted conversation (Phase 14). A
    # stale / not-owned conversation_id falls through to a fresh thread
    # rather than 500ing.
    convo, prior = conversation_service.get_or_create(db, current_user.id, body.conversation_id)

    result = assistant_service.answer(
        question,
        language=current_user.language,
        user_id=current_user.id,
        account_type=current_user.account_type or "consumer",
        db=db,
        history=prior,
    )

    # Persist the updated thread. save() returns the conversation id
    # (creating the row on first turn) — the client sends it back next
    # turn to continue. None means persistence hiccuped; the chat still
    # works, it just won't resume.
    conversation_id = conversation_service.save(
        db, current_user.id, convo, result.get("history", []), question
    )

    return {
        "title":           result["title"],
        "answer":          result["answer"],
        "tool_calls":      result["tool_calls"],
        "conversation_id": conversation_id,
    }


@router.get("/assistant/conversations")
def list_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The user's Flavor chat threads, most-recently-updated first.
    Lightweight — no message bodies, just id / title / count / time."""
    return {"conversations": conversation_service.list_for_user(db, current_user.id)}


@router.get("/assistant/conversations/{conversation_id}")
def get_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Full thread for resuming a conversation. 404 for a thread the
    caller doesn't own (or one that doesn't exist)."""
    thread = conversation_service.get_thread(db, current_user.id, conversation_id)
    if thread is None:
        raise HTTPException(status_code=404, detail="conversation not found")
    return thread


@router.delete("/assistant/conversations/{conversation_id}", status_code=204)
def delete_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a conversation thread. Idempotent-ish — 404 if it wasn't
    there (or wasn't the caller's) so the client knows nothing happened."""
    if not conversation_service.clear(db, current_user.id, conversation_id):
        raise HTTPException(status_code=404, detail="conversation not found")
