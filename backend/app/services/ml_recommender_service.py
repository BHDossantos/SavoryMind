"""ML consumer recommender — memory-based collaborative filtering.

A real, interpretable ML method (item-item k-NN CF) that learns from the
behavior SavoryMind already logs: each consumer's interactions with
cuisines / dishes / moods become an implicit-feedback signal. We compute
item-item cosine similarity over the user×item matrix, then recommend the
items most similar to what a given user has engaged with. Cold-start users
(no history) fall back to global popularity.

Pure Python — no numpy/sklearn — so it runs anywhere the app runs and the
core is unit-testable in isolation. At pilot scale (hundreds of users,
dozens of item tokens) this is fast; a vectorized/ANN upgrade is a drop-in
later if the catalog explodes.

The CF math lives in pure functions (item_item_similarity /
score_candidates) so it's tested without a database. The DB extraction
(build_interactions) turns BehaviorLog + reviews into (user, item, weight)
triples.
"""
from __future__ import annotations

import json
import math
import time
from collections import defaultdict
from typing import Any, Iterable

from sqlalchemy.orm import Session

from ..models.consumer import BehaviorLog
from ..models.user import User


# ── Pure CF core ────────────────────────────────────────────────────────────

def item_item_similarity(
    interactions: Iterable[tuple[Any, Any, float]],
) -> dict[Any, dict[Any, float]]:
    """Item-item cosine similarity from (user, item, weight) triples.

    Returns {item: {other_item: cosine_similarity}}. Cosine over the
    item's vector across users: sim(a,b) = Σ w_ua·w_ub / (||a||·||b||).
    """
    # item -> {user: weight}
    item_users: dict[Any, dict[Any, float]] = defaultdict(dict)
    for user, item, weight in interactions:
        # Keep the max weight if a (user,item) pair repeats.
        prev = item_users[item].get(user, 0.0)
        item_users[item][user] = max(prev, float(weight))

    norms = {
        item: math.sqrt(sum(w * w for w in users.values()))
        for item, users in item_users.items()
    }

    sims: dict[Any, dict[Any, float]] = defaultdict(dict)
    items = list(item_users.keys())
    for i in range(len(items)):
        a = items[i]
        if norms[a] == 0:
            continue
        for j in range(i + 1, len(items)):
            b = items[j]
            if norms[b] == 0:
                continue
            # Dot product over shared users only.
            ua, ub = item_users[a], item_users[b]
            shared = ua.keys() & ub.keys()
            if not shared:
                continue
            dot = sum(ua[u] * ub[u] for u in shared)
            sim = dot / (norms[a] * norms[b])
            if sim > 0:
                sims[a][b] = round(sim, 4)
                sims[b][a] = round(sim, 4)
    return sims


def score_candidates(
    user_items: dict[Any, float],
    sim: dict[Any, dict[Any, float]],
    *, exclude_known: bool = True,
) -> list[tuple[Any, float]]:
    """Score every candidate item for a user by summing similarity to the
    items they've already engaged with, weighted by their affinity.
    Returns [(item, score)] sorted desc."""
    scores: dict[Any, float] = defaultdict(float)
    for known_item, affinity in user_items.items():
        for other, s in sim.get(known_item, {}).items():
            if exclude_known and other in user_items:
                continue
            scores[other] += affinity * s
    return sorted(scores.items(), key=lambda kv: kv[1], reverse=True)


def popularity(interactions: Iterable[tuple[Any, Any, float]]) -> list[tuple[Any, float]]:
    """Global item popularity (Σ weights) for cold-start fallback."""
    agg: dict[Any, float] = defaultdict(float)
    for _user, item, weight in interactions:
        agg[item] += float(weight)
    return sorted(agg.items(), key=lambda kv: kv[1], reverse=True)


# ── DB extraction ───────────────────────────────────────────────────────────

# Action → implicit weight. Explicit signals (saving, booking) outrank
# passive ones (viewing).
_ACTION_WEIGHT = {
    "wine_pairing": 2.0,
    "music_mood": 1.5,
    "recommendation_served": 0.5,
    "recommendation_clicked": 2.0,
    "restaurant_saved": 3.0,
    "view_recommendation": 0.5,
}


def _tokens_from_meta(action_type: str, meta: dict) -> list[str]:
    """Extract item tokens from a behavior log's metadata. Tokens are
    coarse taste signals (cuisine / mood / dish) so the model generalises
    across the sparse consumer catalog."""
    toks: list[str] = []
    for key in ("cuisine", "mood", "dish", "food_type", "cuisine_type"):
        v = meta.get(key)
        if isinstance(v, str) and v.strip():
            toks.append(f"{key}:{v.strip().lower()}")
    if not toks and action_type:
        toks.append(f"action:{action_type}")
    return toks


def build_interactions(db: Session) -> list[tuple[int, str, float]]:
    """Turn BehaviorLog rows into (user_id, item_token, weight) triples."""
    out: list[tuple[int, str, float]] = []
    for log in db.query(BehaviorLog).all():
        weight = _ACTION_WEIGHT.get(log.action_type, 0.5)
        meta = {}
        if log.action_meta:
            try:
                meta = json.loads(log.action_meta)
            except Exception:
                meta = {}
        for tok in _tokens_from_meta(log.action_type, meta):
            out.append((log.user_id, tok, weight))
    return out


# ── Cached model (memory-based CF recomputed on a TTL) ──────────────────────

_MODEL_TTL_SECONDS = 300
_cache: dict[str, Any] = {"built_at": 0.0, "sim": {}, "pop": [], "n": 0}


def _model(db: Session, *, force: bool = False) -> dict[str, Any]:
    now = time.time()
    if not force and (now - _cache["built_at"]) < _MODEL_TTL_SECONDS and _cache["sim"]:
        return _cache
    interactions = build_interactions(db)
    _cache["sim"] = item_item_similarity(interactions)
    _cache["pop"] = popularity(interactions)
    _cache["n"] = len(interactions)
    _cache["built_at"] = now
    return _cache


def retrain(db: Session) -> dict[str, int]:
    """Force a rebuild (cron entrypoint). Returns model size stats."""
    m = _model(db, force=True)
    return {"interactions": m["n"], "items": len(m["sim"])}


def _user_items(db: Session, user_id: int) -> dict[str, float]:
    items: dict[str, float] = defaultdict(float)
    for log in db.query(BehaviorLog).filter(BehaviorLog.user_id == user_id).all():
        weight = _ACTION_WEIGHT.get(log.action_type, 0.5)
        meta = {}
        if log.action_meta:
            try:
                meta = json.loads(log.action_meta)
            except Exception:
                meta = {}
        for tok in _tokens_from_meta(log.action_type, meta):
            items[tok] = max(items[tok], weight)
    return dict(items)


def recommend_tokens(db: Session, user_id: int, *, k: int = 8) -> list[dict[str, Any]]:
    """Top-k recommended taste tokens for a user, with a `source` of
    'personalized' (from their history via CF) or 'popular' (cold start)."""
    model = _model(db)
    user_items = _user_items(db, user_id)
    if user_items and model["sim"]:
        ranked = score_candidates(user_items, model["sim"])
        if ranked:
            return [{"token": tok, "score": round(s, 4), "source": "personalized"}
                    for tok, s in ranked[:k]]
    # Cold start → popularity (excluding what they've already done).
    known = set(user_items.keys())
    return [{"token": tok, "score": round(s, 4), "source": "popular"}
            for tok, s in model["pop"] if tok not in known][:k]
