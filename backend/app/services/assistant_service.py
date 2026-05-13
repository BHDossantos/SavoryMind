"""Flavor assistant — Claude Opus 4.7 answering cooking questions in
SavoryMind's unified voice. The persona itself lives in
claude_client.FLAVOR_PERSONA so every Claude-driven surface speaks
with the same warmth.

Phase 7 — Flavor with tools. Used to be a one-shot Q&A returning a
{title, answer} JSON. Now Flavor has a tool belt (search_wines /
search_recipes / get_pantry / get_user_preferences / …) so when the
user asks "what wine should I pair with the lamb I'm cooking?" she
actually queries the wine catalog and the pairing engine instead of
hallucinating an answer.

The legacy ``answer()`` signature is preserved — callers that don't
need conversation continuity just send the question string and get
back ``{title, answer}``. Multi-turn callers pass ``history`` (prior
messages) and receive ``tool_calls`` in the response for UI ghosting.

i18n: the persona prefix is built per-request via
claude_client.flavor_persona_for(language). Task instructions stay
in English (Claude follows English meta-instructions reliably,
translating them introduces drift) — the persona directive at the
top is what shifts Flavor's output language.
"""
from __future__ import annotations

import json
import logging

from sqlalchemy.orm import Session

from . import claude_client
from .flavor_tools import (
    UserContext,
    make_dispatcher,
    tools_for_user,
)

logger = logging.getLogger(__name__)


# Task-specific instructions concatenated with the language-aware persona
# at request time. Phase 7 rewrite teaches Flavor about her tool belt
# AND about the response shape we want back at the end. The "final
# message must be plain text" instruction is what makes the structured
# {title, answer} extraction (below) work after the tool loop ends.
_ASSISTANT_TASK = """The user is talking to you through SavoryMind's \
assistant chat — they're often in the middle of cooking, eating out, \
or planning a meal. Lead with the answer. Practical, not lecture-y. \
A brief "why" only when it earns its keep.

You have tools that query SavoryMind's catalogs and the user's own data:
- search_wines / search_beers / search_spirits — browse the catalogs
- get_wine_pairing / get_beer_pairing / get_spirits_pairing — get
  ranked recommendations for a specific dish
- search_recipes / get_recipe — find + read recipes
- get_pantry — what ingredients the user has on hand
- get_journal_recent — what they've cooked recently + their ratings
- get_user_preferences — cuisine likes/dislikes, dietary needs,
  flavour profile, skill, time budget, drinking habits

CALL TOOLS WHENEVER they'd make the answer concrete instead of generic. \
A pairing question → call get_wine_pairing. "What can I cook tonight" → \
get_pantry then search_recipes. Always prefer real data over guesses.

Stay in voice. Encouraging language, acknowledge the situation, gentle \
push-back when the user is about to make a mistake, one emoji max.

When you're done with tools, respond with a SINGLE plain-text message \
formatted as:

TITLE: <3-7 word label, sentence case, no trailing punctuation>

<the full answer — typically 1-3 short paragraphs, no markdown headings>

That's it. The "TITLE:" prefix lets the UI extract the title separately."""


def _build_system_prompt(language: str | None) -> str:
    """Compose the per-request system prompt: language-aware persona +
    fixed task instructions. Same persona as every other Flavor surface,
    plus the Phase 7 tool-belt awareness."""
    return f"{claude_client.flavor_persona_for(language)}\n\n{_ASSISTANT_TASK}"


def _parse_response(text: str) -> dict:
    """Pull the TITLE prefix off the front and treat the rest as the answer.

    Phase 6 used Claude's JSON-mode for this. Tool-use turns can't be
    combined with JSON-schema output, so we ask Claude for a TITLE: prefix
    and parse it ourselves. Falls back to a generic title if Claude
    skips the prefix."""
    if not text:
        return {"title": "Hit a snag", "answer": "Something glitched on my end. Try once more in a moment."}
    text = text.strip()
    if text.upper().startswith("TITLE:"):
        first_newline = text.find("\n")
        if first_newline > 0:
            title = text[6:first_newline].strip()
            body = text[first_newline + 1:].strip()
            if title and body:
                return {"title": title, "answer": body}
    # Fallback: model skipped the prefix. Use the first sentence as a
    # title-ish label and the rest as the answer.
    return {"title": "Flavor says", "answer": text}


def answer(
    question: str,
    *,
    language: str | None = None,
    user_id: int | None = None,
    account_type: str = "consumer",
    db: Session | None = None,
    history: list[dict] | None = None,
) -> dict:
    """Ask Flavor a cooking question. Returns:
        {
          "title":      str,         # short label for the answer
          "answer":     str,         # the answer body
          "tool_calls": [..],        # tool invocations (for UI ghosting + logs)
          "history":    [..],        # full conversation messages (for next turn)
        }

    Falls back gracefully — never raises into the route handler.

    Args:
      question:     the user's message this turn
      language:     'en' / 'es' / 'it' / 'pt' (see flavor_persona_for)
      user_id:      who's asking — gates the per-user tools
      account_type: 'consumer' / 'restaurant' / 'diner' / 'staff'
      db:           SQLAlchemy session for tool execution
      history:      optional list of prior {role, content} messages for
                    multi-turn continuity. Caller manages persistence
                    (it's just a JSON list).
    """
    if not claude_client.is_configured():
        return {
            "title":      "Flavor's not configured yet",
            "answer":     "Flavor isn't wired up on this server — the admin needs to set the AI key. Once that's in, I'll be here.",
            "tool_calls": [],
            "history":    history or [],
        }

    if user_id is None or db is None:
        # Defensive fallback — without user_id we can't run per-user tools.
        # Fall back to the legacy no-tools call_json path so the chat
        # still works for unauthenticated / smoke-test scenarios.
        result = claude_client.call_json(
            _build_system_prompt(language),
            question,
            {
                "type": "object",
                "properties": {"title": {"type": "string"}, "answer": {"type": "string"}},
                "required": ["title", "answer"],
                "additionalProperties": False,
            },
        )
        if not result:
            return _glitch(history)
        return {
            "title":      str(result["title"]),
            "answer":     str(result["answer"]),
            "tool_calls": [],
            "history":    history or [],
        }

    ctx = UserContext(
        user_id=user_id,
        account_type=account_type or "consumer",
        language=(language or "en"),
        db=db,
    )
    dispatcher = make_dispatcher(ctx)

    # Start with prior turns (if any), then append the new user question.
    messages = list(history or [])
    messages.append({"role": "user", "content": question})

    result = claude_client.call_with_tools(
        system_prompt=_build_system_prompt(language),
        messages=messages,
        tools=tools_for_user(ctx),
        dispatcher=dispatcher,
    )

    text = result.get("answer") or ""
    parsed = _parse_response(text)
    return {
        "title":      parsed["title"],
        "answer":     parsed["answer"],
        "tool_calls": result.get("tool_calls", []),
        "history":    result.get("messages", messages),
    }


def _glitch(history: list[dict] | None) -> dict:
    return {
        "title":      "Hit a snag",
        "answer":     "Something glitched on my end. Try once more in a moment — usually that does it.",
        "tool_calls": [],
        "history":    history or [],
    }
