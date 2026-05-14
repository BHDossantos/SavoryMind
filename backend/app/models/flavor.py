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
