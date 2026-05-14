"""Flavor's persistent memory.

Conversation history (the last ~20 messages passed per request) gives
Flavor short-term continuity within a chat. This table gives her
LONG-term memory: durable facts about the user that survive across
every conversation — "allergic to shellfish", "oven runs hot",
"prefers metric", "cooking for a date this Friday".

How it's used:
  - Flavor writes facts via the remember_fact action tool when she
    learns something durable.
  - assistant_service auto-injects every fact into the system prompt
    at the start of each conversation, so Flavor ALWAYS knows them
    without spending a tool round-trip to recall.
  - The user can audit / prune via recall_facts + forget_fact.

Categories keep the injected block organised and let the user filter:
  dietary    — allergies, intolerances, vegan/halal/etc.
  equipment  — "no food processor", "oven runs hot", "induction hob"
  preference — "loves spicy", "hates cilantro", "prefers metric"
  skill      — "beginner with knife work", "confident baker"
  context    — transient-ish but worth holding: "cooking for a date Fri"

Capped per-user (see flavor_tools.MEMORY_CAP) so a runaway agent
can't write unbounded rows.
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Index
from datetime import datetime
from ..core.database import Base


class FlavorMemory(Base):
    __tablename__ = "flavor_memories"

    id      = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    fact     = Column(Text, nullable=False)
    category = Column(String(30), nullable=False, default="context")

    created_at         = Column(DateTime, default=datetime.utcnow)
    # Bumped each time the fact is surfaced into a conversation — lets
    # the eviction policy drop stale facts (oldest last_referenced)
    # rather than oldest-created when a user hits the cap.
    last_referenced_at = Column(DateTime, nullable=True)


# Most common query: "all of this user's memories, newest first".
Index("ix_flavor_memories_user_created", FlavorMemory.user_id, FlavorMemory.created_at)


class AssistantConversation(Base):
    """A persisted Flavor chat thread (Phase 14).

    Conversation continuity used to live only in the client's
    historyRef — close the tab and it was gone. This table holds the
    full Anthropic-shape message list (tool_use + tool_result blocks
    included) so a user can reopen the chat and pick up where they
    left off, or continue on another device.

    `messages` is the JSON-encoded list passed straight back to
    claude_client.call_with_tools as conversation history. `title` is
    the first user message, truncated — good enough for a history
    list without a separate title-generation call.

    The schema supports multiple conversations per user; the v1 UI
    just uses the most recent + a "new chat" button, but the data
    model won't need a migration when we add a history drawer.
    """
    __tablename__ = "assistant_conversations"

    id      = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    title    = Column(String(120), nullable=True)
    messages = Column(Text, nullable=False, default="[]")  # JSON-encoded message list

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)


# Most common query: "this user's conversations, most-recently-updated first".
Index("ix_assistant_conversations_user_updated", AssistantConversation.user_id, AssistantConversation.updated_at)

