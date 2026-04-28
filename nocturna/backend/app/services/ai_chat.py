"""AI concierge chat — uses Anthropic Claude when ANTHROPIC_API_KEY is set,
falls back to a deterministic templated assistant otherwise so the chat UI
works even without an API key in dev.
"""
from __future__ import annotations

import json
import os
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models import ChatMessage, ChatThread, Venue
from app.services import recommender
from app.services.recommender import PlannerInput

ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY")
MODEL = os.getenv("NOCTURNA_AI_MODEL", "claude-opus-4-7")

_client = None
if ANTHROPIC_KEY:
    try:
        from anthropic import Anthropic  # type: ignore

        _client = Anthropic(api_key=ANTHROPIC_KEY)
    except ImportError:
        _client = None


SYSTEM_PROMPT = """You are the Nocturna AI Concierge — an expert nightlife planner.
You curate perfect nights out (dinner → bar → club → late food) for users.
You should:
- Ask only ONE question at a time when info is missing.
- Once you have city + vibe + budget + group + time, call the `generate_plan` tool to produce concrete itineraries.
- When users ask "where should I go tonight", default to their saved profile or last city.
- Cities supported: rome, milan, barcelona, paris, lisbon, miami, new_york, dubai, mykonos, ibiza.
- Be concise, warm, never generic. Recommend 1–3 plans, never long lists.
- Respect dress codes, club hours, group dynamics.
"""

TOOLS = [
    {
        "name": "generate_plan",
        "description": "Generate 1-3 curated nightlife plans for a city/vibe/budget/group.",
        "input_schema": {
            "type": "object",
            "properties": {
                "city": {"type": "string"},
                "vibe_tags": {"type": "array", "items": {"type": "string"}},
                "music_pref": {"type": "array", "items": {"type": "string"}},
                "intent": {"type": "string"},
                "style": {"type": "string"},
                "group_type": {"type": "string"},
                "group_size": {"type": "integer"},
                "budget_band": {"type": "string"},
                "neighborhood_pref": {"type": "array", "items": {"type": "string"}},
                "requested_for_iso": {"type": "string"},
            },
            "required": ["city"],
        },
    }
]


def _persist(db: Session, thread: ChatThread, role: str, content: str, payload: Optional[dict] = None):
    msg = ChatMessage(thread_id=thread.id, role=role, content=content, tool_payload=payload)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


def _history(db: Session, thread: ChatThread) -> List[dict]:
    msgs = (
        db.query(ChatMessage)
        .filter(ChatMessage.thread_id == thread.id)
        .order_by(ChatMessage.id.asc())
        .all()
    )
    return [{"role": m.role, "content": m.content} for m in msgs if m.role in ("user", "assistant")]


def _fallback_reply(user_text: str) -> str:
    text = (user_text or "").lower()
    if any(w in text for w in ["plan", "where", "tonight", "go out", "club", "dinner"]):
        return (
            "Tell me three quick things and I'll plan it: which **city** are you in, "
            "what **vibe** do you want (romantic, wild, luxury, chill, latin, jazz...), "
            "and your **budget per person** (€25-50, €50-100, €100-200, €200+)?"
        )
    if "hi" in text or "hello" in text:
        return "Hi — I'm Nocturna's concierge. Ready to plan your night? Just tell me city, vibe, and budget."
    return "Got it. Want me to plan a full night (dinner → bar → club) based on your vibe and budget?"


def chat(db: Session, thread: ChatThread, user_text: str) -> dict:
    _persist(db, thread, "user", user_text)
    if not _client:
        reply = _fallback_reply(user_text)
        _persist(db, thread, "assistant", reply)
        return {"reply": reply, "plans": [], "tool_used": False}

    messages = _history(db, thread)
    response = _client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        tools=TOOLS,
        messages=messages,
    )
    plans: list = []
    reply_parts: List[str] = []
    tool_used = False
    for block in response.content:
        if getattr(block, "type", None) == "text":
            reply_parts.append(block.text)
        elif getattr(block, "type", None) == "tool_use" and block.name == "generate_plan":
            tool_used = True
            args = block.input or {}
            try:
                from datetime import datetime

                requested_for = (
                    datetime.fromisoformat(args.get("requested_for_iso"))
                    if args.get("requested_for_iso")
                    else datetime.utcnow()
                )
                inp = PlannerInput(
                    city=args.get("city", thread.city or "rome"),
                    requested_for=requested_for,
                    intent=args.get("intent", "dinner_drinks"),
                    vibe_tags=args.get("vibe_tags", []),
                    music_pref=args.get("music_pref", []),
                    style=args.get("style", "casual"),
                    group_type=args.get("group_type", "friends"),
                    group_size=int(args.get("group_size", 2)),
                    budget_band=args.get("budget_band", "50-100"),
                    neighborhood_pref=args.get("neighborhood_pref", []),
                    plan_count=2,
                )
                plans = recommender.generate_plans(db, inp)
            except Exception as e:
                reply_parts.append(f"(Couldn't generate plan: {e})")
    reply = "\n\n".join(reply_parts).strip() or "Here's what I found."
    _persist(db, thread, "assistant", reply, payload={"plans": plans} if plans else None)
    return {"reply": reply, "plans": plans, "tool_used": tool_used}
