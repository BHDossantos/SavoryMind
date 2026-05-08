"""Shared Anthropic Claude client.

Goal: every backend feature that wants to use Claude calls a single helper
that handles the SDK setup, prompt caching, JSON-schema output, refusal
detection, and timeout/error handling. Returns None on any failure so
callers can fall back to a rules-based path without crashing the request.

Why this exists:
  - assistant_service.py was the first feature to use Claude; the
    recommendation, trends, marketing, training, and review-enrichment
    features all want the same call shape.
  - Keeping the SDK boilerplate (output_config, cache_control,
    refusal-handling) in one place means a future model upgrade or API
    change touches one file, not six.

Configuration:
  ANTHROPIC_API_KEY env var. If unset, is_configured() returns False and
  every call_json() returns None — features cleanly degrade to their
  pre-Claude implementation.
"""
import json
import logging
import os
from typing import Any, Optional

logger = logging.getLogger(__name__)

# Default model — single source of truth so we don't have "claude-opus-4-7"
# hardcoded in five different services.
DEFAULT_MODEL = "claude-opus-4-7"

# Faster/cheaper model for batch enrichment work (e.g. per-review theme
# extraction) where Opus would be overkill.
BATCH_MODEL = "claude-haiku-4-5-20251001"


# ── Flavor — SavoryMind's unified AI voice ────────────────────────────────
#
# Every Claude call across the backend is "Flavor speaking". Same warm,
# food-loving personality whether the user is asking the assistant a
# question, reading a wine pairing rationale, or seeing a marketing
# insight on the restaurant dashboard. Single source of truth so the
# voice doesn't drift between services.
#
# When a service has a JSON-schema-constrained response, the persona
# shapes free-text fields (rationale, body, tip, answer) but leaves
# structured fields (categories, counts, enums) alone — that's the
# whole point of the schema.

FLAVOR_PERSONA = """You are Flavor — SavoryMind's warm, food-loving voice. \
You talk like a friend who genuinely loves food and genuinely wants the \
person you're talking to to enjoy theirs. Confident without being smug. \
Second person, contractions, everyday words. Encouraging language \
("good call", "you've got this", "try this — you'll see"). Acknowledge \
the situation before answering ("Sauce broke? Easy fix —"). Push back \
gently when someone's about to make a mistake, framed as a question \
("Wait — that lamb has a lot of fat. Want to try a tannic red instead?"). \
One emoji per response, max — pick the right one. Short by default; \
expand only when the question genuinely needs it. Never say "I'm an AI" \
or "as a language model" — just answer.

Don't moralize about food choices ("healthy", "guilty pleasure", \
"indulgent"). Food is food. No food snobbery — never start with "well, \
technically...". No medical claims; if asked about specific diets, \
allergies, or nutritional needs, defer to a professional and say so \
plainly. When unsure, say so and suggest how to figure it out \
("Hard to say without seeing the dish — what does the texture look like?").

Stay in this voice across every response, including the free-text \
fields inside JSON responses (rationale, body, tip, answer, summary). \
Structured fields (categories, counts, enums) stay strict and are not \
shaped by personality."""


_client = None


def is_configured() -> bool:
    """Cheap precheck so route handlers can skip building the prompt
    payload at all when the API key isn't set."""
    return bool(os.getenv("ANTHROPIC_API_KEY"))


def _get_client():
    global _client
    if _client is None:
        from anthropic import Anthropic
        _client = Anthropic()
    return _client


def call_json(
    system_prompt: str,
    user_payload: Any,
    schema: dict,
    *,
    model: str = DEFAULT_MODEL,
    max_tokens: int = 2048,
    cache_system: bool = True,
) -> Optional[dict]:
    """Call Claude with `system_prompt` + `user_payload` and expect a JSON
    response matching `schema`. Returns the parsed dict, or None on any
    failure (no API key, network error, refusal, schema mismatch).

    user_payload accepts a string or a dict — dicts are JSON-encoded so
    callers can hand over structured data (user history, sales logs)
    without having to format strings.

    cache_system=True (default) wraps the system prompt with ephemeral
    cache control so repeated calls with the same prompt skip prompt-
    processing cost. Set False if you're inlining per-request data into
    the system prompt — caching it would be pointless.
    """
    if not is_configured():
        return None

    if not isinstance(user_payload, str):
        try:
            user_payload = json.dumps(user_payload, default=str, ensure_ascii=False)
        except Exception:
            logger.exception("claude_client: failed to serialize user_payload")
            return None

    try:
        client = _get_client()
        system_blocks = [{"type": "text", "text": system_prompt}]
        if cache_system:
            system_blocks[0]["cache_control"] = {"type": "ephemeral"}

        response = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system_blocks,
            messages=[{"role": "user", "content": user_payload}],
            output_config={
                "format": {"type": "json_schema", "schema": schema}
            },
        )

        if getattr(response, "stop_reason", None) == "refusal":
            logger.warning("claude_client: model refused the request")
            return None

        text = next((b.text for b in response.content if getattr(b, "type", None) == "text"), "")
        if not text:
            return None

        return json.loads(text)
    except Exception:
        logger.exception("claude_client.call_json failed")
        return None
