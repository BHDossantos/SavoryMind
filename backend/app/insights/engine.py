"""
Preference-aware recommendation engine.

Combines three signal sources ranked by recency weight:
  1. Onboarding profile  (static preferences set by user)
  2. Behavior logs       (what the user actually does over time)
  3. History records     (WinePairing, MusicMood, DinerVisit)

When ANTHROPIC_API_KEY is set, the public entrypoints
(build_consumer_recommendations / build_diner_recommendations) ask
Claude Opus 4.7 to produce contextual recommendations from the same
inputs. If Claude is unavailable (no key, network failure, schema
mismatch), the original weighted-scoring path runs as a graceful
fallback so users on a key-less deployment still get useful output.
"""
import json
from collections import defaultdict
from sqlalchemy.orm import Session
from ..models.user import User
from ..models.consumer import BehaviorLog, WinePairing, MusicMood, SocialConnection
from ..models.diner import DinerVisit
from ..services import claude_client


# ── Helpers ───────────────────────────────────────────────────────────────────

def _safe_json(value, default):
    if not value:
        return default
    try:
        return json.loads(value)
    except Exception:
        return default


def get_user_profile(user: User) -> dict:
    """Parse all JSON preference fields stored as TEXT on the User model."""
    return {
        "cuisines":  _safe_json(user.cuisine_preferences, []),
        "dietary":   _safe_json(user.dietary_preferences, []),
        "drinking":  _safe_json(user.drinking_habits, {}),
        "music":     _safe_json(user.music_genres, []),
        "recipes":   _safe_json(user.recipe_interests, []),
    }


def get_behavior_summary(db: Session, user_id: int) -> dict:
    """
    Aggregate BehaviorLog into action counts and extracted metadata.
    Returns a dict that downstream scorers can use without re-querying.
    """
    logs = db.query(BehaviorLog).filter(BehaviorLog.user_id == user_id).all()

    action_counts: dict[str, int] = defaultdict(int)
    wine_dishes: list[str] = []
    music_moods: list[str] = []
    beer_dishes: list[str] = []
    spirit_dishes: list[str] = []
    recipe_cuisines: list[str] = []

    for log in logs:
        action_counts[log.action_type] += 1
        meta: dict = {}
        if log.action_meta:
            try:
                meta = json.loads(log.action_meta)
            except Exception:
                pass

        if log.action_type == "wine_pairing" and "dish" in meta:
            wine_dishes.append(meta["dish"])
        elif log.action_type == "music_mood" and "mood" in meta:
            music_moods.append(meta["mood"])
        elif log.action_type == "beer_pairing" and "dish" in meta:
            beer_dishes.append(meta["dish"])
        elif log.action_type == "spirits_pairing" and "dish" in meta:
            spirit_dishes.append(meta["dish"])
        elif log.action_type == "recipe_view" and "cuisine" in meta:
            recipe_cuisines.append(meta["cuisine"])

    return {
        "action_counts":  dict(action_counts),
        "wine_dishes":    wine_dishes,
        "music_moods":    music_moods,
        "beer_dishes":    beer_dishes,
        "spirit_dishes":  spirit_dishes,
        "recipe_cuisines": recipe_cuisines,
        "total_actions":  len(logs),
    }


def _top_frequent(items: list[str], n: int = 3) -> list[str]:
    counts: dict[str, int] = defaultdict(int)
    for item in items:
        counts[item] += 1
    return sorted(counts, key=counts.get, reverse=True)[:n]  # type: ignore[arg-type]


def get_pairing_history(db: Session, user_id: int) -> dict:
    pairings = db.query(WinePairing).filter(WinePairing.user_id == user_id).all()
    moods = db.query(MusicMood).filter(MusicMood.user_id == user_id).all()

    top_dishes = _top_frequent([p.dish_name for p in pairings])

    mood_counts: dict[str, int] = defaultdict(int)
    for m in moods:
        mood_counts[m.mood] += 1
    fav_mood = max(mood_counts, key=mood_counts.get) if mood_counts else None  # type: ignore[arg-type]

    return {
        "top_dishes": top_dishes,
        "fav_mood": fav_mood,
        "mood_counts": dict(mood_counts),
        "total_pairings": len(pairings),
        "total_moods": len(moods),
    }


# ── Consumer Recommendations ──────────────────────────────────────────────────

# Fixed schema — keeps Claude's output compatible with the existing frontend
# rendering (icon emoji, deep-link `action` strings) and prevents the model
# from inventing wild fields the UI can't handle.
_CONSUMER_REC_SCHEMA = {
    "type": "object",
    "properties": {
        "recommendations": {
            "type": "array",
            "minItems": 1,
            "maxItems": 5,
            "items": {
                "type": "object",
                "properties": {
                    "type":       {"type": "string", "enum": [
                        "wine_pairing", "beer_pairing", "spirits_pairing", "cocktails_pairing",
                        "music", "recipe", "connect", "insight",
                    ]},
                    "title":      {"type": "string"},
                    "body":       {"type": "string"},
                    "icon":       {"type": "string"},
                    "action":     {"type": "string"},
                    "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                },
                "required": ["type", "title", "body", "icon", "action", "confidence"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["recommendations"],
    "additionalProperties": False,
}


_CONSUMER_REC_SYSTEM = f"""{claude_client.FLAVOR_PERSONA}

Right now you're talking to a home cook on their dashboard. Given \
their onboarding profile, recent behaviour and pairing history, \
produce 3–5 genuinely useful, *specific* recommendations that pull \
them into the next thing worth doing.

Rules for the output:
- Mix recommendation types — don't return five wine pairings.
- Each `body` must reference at least one concrete signal from the \
  input data (a dish they paired before, a mood they set N times, a \
  cuisine they listed). Stay in voice — talk to them, not at them.
- `action` is a deep-link the frontend opens. Use one of these \
  patterns exactly:
    wine_pairing?dish=<dish>
    pairings?type=<wine|beer|spirits|cocktails>
    music?mood=<mood>      or just  music
    explore_recipes?cuisine=<cuisine>     or  explore_recipes?diet=<diet>
    connections
- `icon` is a single emoji matching the type (🍷 wine, 🍺 beer, \
  🥃 spirits, 🍸 cocktails, 🎵 music, 🍳 recipe, 🥗 dietary, \
  🔗 connection, 💡 insight).
- `confidence` reflects how strong the signal is (0.5 weak, 0.8 \
  strong, 0.95 explicit history match).
- If signals are thin, still produce 3 reasonable recommendations \
  rather than refusing.
- If a `spotify_listening` field is present, treat it as the strongest \
  taste signal — reference a specific top artist or genre in at least \
  one body when relevant (e.g. "Your heavy Rosalía rotation pairs \
  well with Spanish reds — try this Rioja with paella"). Don't force \
  it if no food/wine connection makes sense.

Title + body fields: warm, second-person, sentence case. Title ≤ 8 \
words. Body ≤ 25 words. The structured fields (action, icon, \
confidence) stay strict."""


def build_consumer_recommendations(db: Session, user: User) -> list[dict]:
    """Top-level entrypoint. Tries Claude; falls back to weighted scoring."""
    profile  = get_user_profile(user)
    behavior = get_behavior_summary(db, user.id)
    history  = get_pairing_history(db, user.id)

    if claude_client.is_configured():
        # Trim the payload — Claude doesn't need defaultdicts or sets.
        payload = {
            "profile":  profile,
            "behavior": {
                "action_counts":   dict(behavior.get("action_counts", {})),
                "recipe_cuisines": list(behavior.get("recipe_cuisines", []))[:20],
                "total_actions":   behavior.get("total_actions", 0),
            },
            "history": {
                "top_dishes":  history.get("top_dishes", [])[:5],
                "fav_mood":    history.get("fav_mood"),
                "mood_counts": dict(history.get("mood_counts", {})),
                "total_pairings": history.get("total_pairings", 0),
                "total_moods":    history.get("total_moods", 0),
            },
        }

        # Opportunistic Spotify listening signal — when the user has
        # connected Spotify with the user-top-read scope, drop their top
        # artists / genres / tracks into the prompt so recommendations
        # can reference real listening taste ("you've been on heavy
        # rotation with Bad Bunny — try this Latin pairing"). Wrapped in
        # try/except because the SocialConnection model is in a sibling
        # subpackage and we never want a Spotify error to break a recs
        # request.
        try:
            from ..models.consumer import SocialConnection
            from ..services.spotify_service import get_listening_signal
            spotify_conn = (
                db.query(SocialConnection)
                .filter(SocialConnection.user_id == user.id, SocialConnection.platform == "spotify")
                .first()
            )
            signal = get_listening_signal(db, spotify_conn)
            if signal:
                payload["spotify_listening"] = signal
        except Exception:  # noqa: BLE001 — recs is read-only; never fail it
            pass

        result = claude_client.call_json(_CONSUMER_REC_SYSTEM, payload, _CONSUMER_REC_SCHEMA)
        if result and isinstance(result.get("recommendations"), list) and result["recommendations"]:
            return result["recommendations"]

    return _build_consumer_recommendations_rules(profile, behavior, history, db, user)


def _build_consumer_recommendations_rules(profile, behavior, history, db, user) -> list[dict]:
    """Original rules-based engine — used when Claude is unavailable."""
    recs: list[dict] = []

    # ── Signal: repeat favorite dish ─────────────────────────────────────────
    if history["top_dishes"]:
        dish = history["top_dishes"][0]
        recs.append({
            "type": "wine_pairing",
            "title": f"More pairings for {dish}",
            "body": f"You've asked about {dish} before — here are fresh wine picks you haven't tried.",
            "icon": "🍷",
            "action": f"wine_pairing?dish={dish}",
            "confidence": 0.92,
        })

    # ── Signal: favourite music mood ──────────────────────────────────────────
    if history["fav_mood"]:
        mood = history["fav_mood"]
        count = history["mood_counts"][mood]
        recs.append({
            "type": "music",
            "title": f"Your signature vibe: {mood.title()}",
            "body": f"You've set {mood} {count} time{'s' if count != 1 else ''} — we've curated a new playlist.",
            "icon": "🎵",
            "action": f"music?mood={mood}",
            "confidence": 0.88,
        })
    elif profile["music"]:
        genre = profile["music"][0]
        recs.append({
            "type": "music",
            "title": f"Start your first {genre} dining playlist",
            "body": f"You said you love {genre} — try the music mood tool to set the perfect dining atmosphere.",
            "icon": "🎵",
            "action": "music",
            "confidence": 0.65,
        })

    # ── Signal: onboarding cuisine preference → recipe ────────────────────────
    if profile["cuisines"]:
        # Prefer a cuisine the user logged but hasn't paired yet
        explored = set(_top_frequent(behavior["recipe_cuisines"]))
        unexplored = [c for c in profile["cuisines"] if c not in explored]
        cuisine = unexplored[0] if unexplored else profile["cuisines"][0]
        recs.append({
            "type": "recipe",
            "title": f"New {cuisine} recipe waiting for you",
            "body": f"Based on your taste profile, we found {cuisine} dishes that match your style.",
            "icon": "🍳",
            "action": f"explore_recipes?cuisine={cuisine}",
            "confidence": 0.82,
        })

    # ── Signal: drinking habit → beverage pairing ─────────────────────────────
    drinking = profile["drinking"]
    if isinstance(drinking, dict):
        freq_score = {"often": 4, "regularly": 3, "occasionally": 2, "never": 0}
        candidates = [(k, v) for k, v in drinking.items() if v and v != "never"]
        if candidates:
            best_drink, freq = max(candidates, key=lambda x: freq_score.get(x[1], 0))
            drink_icon = {"wine": "🍷", "beer": "🍺", "spirits": "🥃", "cocktails": "🍸"}.get(best_drink, "🥂")
            recs.append({
                "type": f"{best_drink}_pairing",
                "title": f"Perfect {best_drink} pairings for tonight",
                "body": f"You enjoy {best_drink} {freq} — try a pairing for whatever you're cooking.",
                "icon": drink_icon,
                "action": f"pairings?type={best_drink}",
                "confidence": 0.78,
            })

    # ── Signal: dietary preferences → filtered recipes ───────────────────────
    dietary = profile["dietary"]
    restricted = [d for d in dietary if d and d.lower() not in ("no restrictions", "none")]
    if restricted:
        label = restricted[0].replace("-", " ")
        recs.append({
            "type": "recipe",
            "title": f"{label.title()} recipes picked for you",
            "body": f"Filtered specifically for your {label} preference — no label-checking needed.",
            "icon": "🥗",
            "action": f"explore_recipes?diet={restricted[0]}",
            "confidence": 0.72,
        })

    # ── Signal: nudge toward Spotify if heavy music user but not connected ────
    if behavior["action_counts"].get("music_mood", 0) >= 3:
        connected = db.query(SocialConnection).filter(
            SocialConnection.user_id == user.id,
            SocialConnection.connected == True,
        ).count()
        if connected == 0:
            n = behavior["action_counts"]["music_mood"]
            recs.append({
                "type": "connect",
                "title": "Connect Spotify for real playlists",
                "body": f"You've set {n} moods — link Spotify to turn them into actual playlists automatically.",
                "icon": "🔗",
                "action": "connections",
                "confidence": 0.60,
            })

    # Sort by confidence, deduplicate by type, return top 5
    seen_types: set[str] = set()
    deduped: list[dict] = []
    for rec in sorted(recs, key=lambda r: r.get("confidence", 0), reverse=True):
        if rec["type"] not in seen_types:
            seen_types.add(rec["type"])
            deduped.append(rec)

    return deduped[:5]


# ── Diner Recommendations ─────────────────────────────────────────────────────

def get_diner_insights(db: Session, user_id: int) -> dict:
    """Analyse DinerVisit history for a diner user."""
    visits = db.query(DinerVisit).filter(DinerVisit.user_id == user_id).all()
    if not visits:
        return {
            "top_restaurants": [],
            "avg_rating": 0.0,
            "would_return_pct": 0.0,
            "favorite_items": [],
            "total_visits": 0,
        }

    restaurant_ratings: dict[str, list[float]] = defaultdict(list)
    restaurant_visits: dict[str, int] = defaultdict(int)
    all_items: list[str] = []
    would_return_count = 0

    for v in visits:
        restaurant_ratings[v.restaurant_name].append(v.overall_rating)
        restaurant_visits[v.restaurant_name] += 1
        if v.items_ordered:
            all_items.extend([i.strip() for i in v.items_ordered.split(",") if i.strip()])
        if v.would_return:
            would_return_count += 1

    top_restaurants = sorted(
        [
            {
                "name": name,
                "avg_rating": round(sum(ratings) / len(ratings), 1),
                "visits": restaurant_visits[name],
            }
            for name, ratings in restaurant_ratings.items()
        ],
        key=lambda x: (x["avg_rating"], x["visits"]),
        reverse=True,
    )[:5]

    favorite_items = _top_frequent(all_items, n=5)
    avg_rating = round(sum(v.overall_rating for v in visits) / len(visits), 1)
    would_return_pct = round(would_return_count / len(visits) * 100, 0)

    return {
        "top_restaurants": top_restaurants,
        "avg_rating": avg_rating,
        "would_return_pct": would_return_pct,
        "favorite_items": favorite_items,
        "total_visits": len(visits),
    }


_DINER_REC_SCHEMA = {
    "type": "object",
    "properties": {
        "recommendations": {
            "type": "array",
            "minItems": 1,
            "maxItems": 5,
            "items": {
                "type": "object",
                "properties": {
                    "type":       {"type": "string", "enum": [
                        "restaurant", "discovery", "dish", "wine", "insight", "onboarding",
                    ]},
                    "title":      {"type": "string"},
                    "body":       {"type": "string"},
                    "icon":       {"type": "string"},
                    "action":     {"type": "string"},
                    "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                },
                "required": ["type", "title", "body", "icon", "action", "confidence"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["recommendations"],
    "additionalProperties": False,
}


_DINER_REC_SYSTEM = f"""{claude_client.FLAVOR_PERSONA}

You're talking to a diner about where to eat next. Given their \
onboarding profile and visit history, produce 3–5 useful, specific \
recommendations.

Rules:
- Mix types: rebooking, discovery of new cuisines, chasing a favourite \
  dish, wine-list filters, insights.
- Each `body` must reference at least one concrete signal (a \
  restaurant name, a cuisine they listed, their would-return \
  percentage, visit count). Stay in voice.
- `action` patterns:
    book?restaurant=<name>
    discover?cuisine=<cuisine>     or  discover?filter=wine_list
    search?dish=<dish>
    visits/new
- `icon` matches the type (🍽️ restaurant, 🗺️ discovery, ⭐ dish, \
  🍷 wine, 💡 insight, 📝 onboarding).
- `confidence`: 0.95 explicit history (favourite dish, top \
  restaurant), 0.7 cuisine prefs, 0.6 inferred.
- Cold-start (zero visits): suggest logging the first visit + a \
  discovery pick from their cuisines — keep it inviting, not \
  demanding.

Title + body fields: warm, second-person, sentence case. Title ≤ 8 \
words, body ≤ 25 words."""


def build_diner_recommendations(db: Session, user: User) -> list[dict]:
    """Top-level entrypoint. Tries Claude; falls back to rules."""
    profile  = get_user_profile(user)
    insights = get_diner_insights(db, user.id)

    if claude_client.is_configured():
        payload = {
            "profile": profile,
            "insights": {
                "top_restaurants":    insights.get("top_restaurants", [])[:5],
                "favorite_items":     insights.get("favorite_items", [])[:5],
                "would_return_pct":   insights.get("would_return_pct", 0),
                "total_visits":       insights.get("total_visits", 0),
            },
        }
        result = claude_client.call_json(_DINER_REC_SYSTEM, payload, _DINER_REC_SCHEMA)
        if result and isinstance(result.get("recommendations"), list) and result["recommendations"]:
            return result["recommendations"]

    return _build_diner_recommendations_rules(profile, insights)


def _build_diner_recommendations_rules(profile, insights) -> list[dict]:
    """Original rules-based engine — used when Claude is unavailable."""
    recs: list[dict] = []

    # ── Return to top-rated spot ──────────────────────────────────────────────
    if insights["top_restaurants"]:
        top = insights["top_restaurants"][0]
        visits_str = f"{top['visits']} visit{'s' if top['visits'] != 1 else ''}"
        recs.append({
            "type": "restaurant",
            "title": f"Book {top['name']} again",
            "body": f"Your highest-rated spot ({top['avg_rating']}★ across {visits_str}). You always love it.",
            "icon": "🍽️",
            "action": f"book?restaurant={top['name']}",
            "confidence": 0.90,
        })

    # ── Explore a preferred cuisine not yet visited ───────────────────────────
    if profile["cuisines"]:
        visited_names = {r["name"].lower() for r in insights["top_restaurants"]}
        for cuisine in profile["cuisines"]:
            recs.append({
                "type": "discovery",
                "title": f"Find a great {cuisine} restaurant",
                "body": f"You listed {cuisine} as a top preference — let's find the best spot near you.",
                "icon": "🗺️",
                "action": f"discover?cuisine={cuisine}",
                "confidence": 0.78,
            })
            break  # one cuisine suggestion is enough

    # ── Favourite dish across restaurants ────────────────────────────────────
    if insights["favorite_items"]:
        item = insights["favorite_items"][0]
        recs.append({
            "type": "dish",
            "title": f"Chase down the best {item}",
            "body": f"It's your most ordered dish — let's find who makes it best in your area.",
            "icon": "⭐",
            "action": f"search?dish={item}",
            "confidence": 0.85,
        })

    # ── Low would-return signal → curated suggestion ──────────────────────────
    if insights["total_visits"] >= 3 and insights["would_return_pct"] < 70:
        recs.append({
            "type": "insight",
            "title": "You've been mixed on recent restaurants",
            "body": f"Only {int(insights['would_return_pct'])}% of your visits earned a 'would return'. Time for a curated pick.",
            "icon": "💡",
            "action": "discover",
            "confidence": 0.70,
        })

    # ── Wine drinker → check wine lists before booking ────────────────────────
    drinking = profile["drinking"]
    if isinstance(drinking, dict) and drinking.get("wine") in ("regularly", "often"):
        recs.append({
            "type": "wine",
            "title": "Check wine lists before you book",
            "body": "You drink wine regularly — find restaurants with strong wine lists in your area.",
            "icon": "🍷",
            "action": "discover?filter=wine_list",
            "confidence": 0.68,
        })

    # ── Cold-start: no visits yet ─────────────────────────────────────────────
    if insights["total_visits"] == 0:
        recs.append({
            "type": "onboarding",
            "title": "Log your first restaurant visit",
            "body": "The more visits you track, the smarter your recommendations become. Start with last week.",
            "icon": "📝",
            "action": "visits/new",
            "confidence": 0.95,
        })
        if profile["cuisines"]:
            recs.append({
                "type": "discovery",
                "title": f"Find a {profile['cuisines'][0]} restaurant near you",
                "body": "Based on your food preferences, here's where to start exploring.",
                "icon": "🗺️",
                "action": f"discover?cuisine={profile['cuisines'][0]}",
                "confidence": 0.80,
            })

    recs.sort(key=lambda r: r.get("confidence", 0), reverse=True)
    return recs[:5]
