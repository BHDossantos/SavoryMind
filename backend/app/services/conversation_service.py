"""Persistence for Flavor chat threads (Phase 14).

assistant_service handles a single turn (question in, answer out).
This module handles the THREAD around it — loading prior messages
from the DB, saving the updated thread back, listing a user's
conversations, fetching a full thread, clearing one.

Messages are stored as a JSON-encoded list — the exact Anthropic
message shape (including tool_use + tool_result blocks) that
claude_client.call_with_tools consumes. No reshaping on the round
trip.

Everything is user_id-scoped. A conversation_id that doesn't belong
to the caller is treated as "not found" — never raises, never leaks
another user's thread.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime

from sqlalchemy.orm import Session

from ..models.flavor import AssistantConversation

logger = logging.getLogger(__name__)

# Cap stored history so a long-running thread can't bloat the row or
# blow the token budget on the next turn. We keep the most recent N
# messages — tool_use/tool_result blocks count individually, so this
# is generous (≈ 20-30 user-visible turns).
_MAX_STORED_MESSAGES = 80


def _safe_load(raw: str) -> list:
    try:
        data = json.loads(raw or "[]")
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, TypeError):
        return []


def get_or_create(db: Session, user_id: int, conversation_id: int | None):
    """Resolve the conversation for this turn.

    Returns (conversation_row_or_None, prior_messages_list).

    - conversation_id given + owned by user → load it
    - conversation_id given but missing / not owned → fall through to
      a fresh thread (row=None) so a stale client id can't 500 the chat
    - conversation_id None → fresh thread (row=None)

    The row is None for a brand-new thread; save() creates it.
    """
    if conversation_id is None:
        return None, []
    convo = (
        db.query(AssistantConversation)
        .filter(
            AssistantConversation.id == conversation_id,
            AssistantConversation.user_id == user_id,
        )
        .first()
    )
    if not convo:
        return None, []
    return convo, _safe_load(convo.messages)


def save(db: Session, user_id: int, convo, messages: list, first_user_message: str) -> int | None:
    """Persist the updated message list. Creates the row on first save.
    Returns the conversation id (or None if persistence failed — the
    chat still works, it just won't resume).

    `first_user_message` seeds the title on creation; ignored on update.
    """
    try:
        trimmed = messages[-_MAX_STORED_MESSAGES:]
        encoded = json.dumps(trimmed, default=str, ensure_ascii=False)
        now = datetime.utcnow()

        if convo is None:
            convo = AssistantConversation(
                user_id=user_id,
                title=(first_user_message or "New chat").strip()[:120],
                messages=encoded,
                created_at=now,
                updated_at=now,
            )
            db.add(convo)
        else:
            convo.messages = encoded
            convo.updated_at = now

        db.commit()
        db.refresh(convo)
        return convo.id
    except Exception:
        logger.exception("conversation_service.save failed")
        db.rollback()
        return None


def list_for_user(db: Session, user_id: int) -> list[dict]:
    """Conversation list for the history drawer — most recent first.
    Returns lightweight rows (no message bodies)."""
    rows = (
        db.query(AssistantConversation)
        .filter(AssistantConversation.user_id == user_id)
        .order_by(AssistantConversation.updated_at.desc())
        .limit(50)
        .all()
    )
    out = []
    for c in rows:
        msgs = _safe_load(c.messages)
        out.append({
            "id":            c.id,
            "title":         c.title or "Untitled chat",
            "message_count": len(msgs),
            "updated_at":    c.updated_at.isoformat() if c.updated_at else None,
        })
    return out


def get_thread(db: Session, user_id: int, conversation_id: int) -> dict | None:
    """Full thread for resuming a conversation. user_id-scoped — returns
    None for a conversation the caller doesn't own."""
    convo = (
        db.query(AssistantConversation)
        .filter(
            AssistantConversation.id == conversation_id,
            AssistantConversation.user_id == user_id,
        )
        .first()
    )
    if not convo:
        return None
    return {
        "id":         convo.id,
        "title":      convo.title or "Untitled chat",
        "messages":   _safe_load(convo.messages),
        "updated_at": convo.updated_at.isoformat() if convo.updated_at else None,
    }


def clear(db: Session, user_id: int, conversation_id: int) -> bool:
    """Delete a conversation. user_id-scoped. Returns True if a row was
    deleted, False if nothing matched."""
    convo = (
        db.query(AssistantConversation)
        .filter(
            AssistantConversation.id == conversation_id,
            AssistantConversation.user_id == user_id,
        )
        .first()
    )
    if not convo:
        return False
    db.delete(convo)
    db.commit()
    return True
