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


# Per-language directive appended to FLAVOR_PERSONA when the caller
# specifies a non-English target language. Each maps a supported ISO
# 639-1 code to a "respond in this language, sound native" instruction.
# We tell Claude to respond AS A NATIVE SPEAKER, not a literal
# translator — that's the difference between "Hola, soy Flavor 👋" and
# the awkward "I am Flavor, food-lover" word-for-word translation.
FLAVOR_LANGUAGE_DIRECTIVES = {
    "en": "",  # default — no extra instruction
    "es": " Responde en español como un hablante nativo. Mantén el mismo "
          "tono cálido y amigable, pero usa modismos naturales del español "
          "(no traducciones literales del inglés). Tutea al usuario.",
    "it": " Rispondi in italiano come madrelingua. Mantieni lo stesso "
          "tono caldo e amichevole, ma usa espressioni naturali italiane "
          "(non traduzioni letterali dall'inglese). Dai del tu all'utente.",
    "pt": " Responde em português como um falante nativo. Mantém o mesmo "
          "tom caloroso e amigável, mas usa expressões naturais portuguesas "
          "(não traduções literais do inglês). Trata o utilizador por tu.",
}


def flavor_persona_for(language: str | None) -> str:
    """Return the FLAVOR_PERSONA prompt with per-language directive
    appended. Unknown / unsupported languages fall back to English.
    Used by every Claude system-prompt builder so language plumbing
    threads through cleanly without each service redeclaring the same
    if/elif ladder."""
    code = (language or "en").lower().strip()
    directive = FLAVOR_LANGUAGE_DIRECTIVES.get(code, "")
    return FLAVOR_PERSONA + directive


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


# ── Tool-calling layer ─────────────────────────────────────────────────────
#
# Used by Phase 7 — Flavor with tools. The caller registers a list of
# tool definitions (Anthropic schema format) and a dispatcher function.
# This helper handles the multi-turn loop: Claude requests a tool →
# dispatcher runs it → result fed back → Claude either calls another
# tool or returns a final answer.
#
# Why this lives here (not in flavor_tools.py): keeps the SDK-specific
# message-shape transformations in one place. Tool implementations
# stay pure Python — they take a dict of args, return JSON-serialisable
# output. The dispatcher only knows {name → callable}.


# Safety cap so a runaway loop can't burn unbounded tokens. Real Flavor
# usage rarely needs more than 2-3 tool calls per turn.
_MAX_TOOL_ITERATIONS = 8


def call_with_tools(
    system_prompt: str,
    messages: list[dict],
    tools: list[dict],
    dispatcher,
    *,
    model: str = DEFAULT_MODEL,
    max_tokens: int = 4096,
):
    """Multi-turn Claude call with tool execution.

    Args:
      system_prompt:  the system message (FLAVOR_PERSONA + task instructions)
      messages:       starting conversation [{"role": "user"|"assistant", "content": ...}, ...]
                      Mutated in-place to record assistant/tool exchanges.
      tools:          Anthropic-format tool definitions (name, description,
                      input_schema). See flavor_tools.TOOL_DEFINITIONS.
      dispatcher:     callable(name: str, args: dict) → JSON-serialisable result
                      OR raises. Wrap exceptions in the dispatcher; we'll
                      report failure to Claude so it can recover gracefully.

    Returns:
      {
        "answer":     final assistant text, or None on failure
        "tool_calls": list of {"name", "args", "result"} for UI / logging
        "messages":   the full conversation (handy for the next turn)
      }
    """
    if not is_configured():
        return {"answer": None, "tool_calls": [], "messages": messages}

    tool_calls_log: list[dict] = []

    try:
        client = _get_client()
        system_blocks = [{"type": "text", "text": system_prompt, "cache_control": {"type": "ephemeral"}}]

        for _ in range(_MAX_TOOL_ITERATIONS):
            response = client.messages.create(
                model=model,
                max_tokens=max_tokens,
                system=system_blocks,
                tools=tools,
                messages=messages,
            )

            if getattr(response, "stop_reason", None) == "refusal":
                logger.warning("claude_client: model refused the tool-calling turn")
                return {"answer": None, "tool_calls": tool_calls_log, "messages": messages}

            # Record the assistant turn so subsequent iterations see the
            # tool-use blocks. The SDK returns content as a list of typed
            # blocks; we preserve that shape exactly.
            assistant_blocks = [
                _block_to_dict(b) for b in response.content
            ]
            messages.append({"role": "assistant", "content": assistant_blocks})

            if response.stop_reason == "end_turn":
                # No more tool calls — extract the final text answer.
                text = next(
                    (b.text for b in response.content if getattr(b, "type", None) == "text"),
                    "",
                )
                return {"answer": text, "tool_calls": tool_calls_log, "messages": messages}

            if response.stop_reason != "tool_use":
                logger.warning("claude_client: unexpected stop_reason %r", response.stop_reason)
                return {"answer": None, "tool_calls": tool_calls_log, "messages": messages}

            # Execute every requested tool and add tool_result blocks.
            tool_results = []
            for block in response.content:
                if getattr(block, "type", None) != "tool_use":
                    continue
                name = block.name
                args = block.input or {}
                try:
                    result = dispatcher(name, args)
                    is_error = False
                except Exception as exc:
                    logger.exception("tool %s raised", name)
                    result = {"error": f"{type(exc).__name__}: {exc}"}
                    is_error = True

                tool_calls_log.append({"name": name, "args": args, "result": result})
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": json.dumps(result, default=str, ensure_ascii=False),
                    **({"is_error": True} if is_error else {}),
                })

            messages.append({"role": "user", "content": tool_results})

        logger.warning("claude_client: hit _MAX_TOOL_ITERATIONS=%d without end_turn", _MAX_TOOL_ITERATIONS)
        return {"answer": None, "tool_calls": tool_calls_log, "messages": messages}

    except Exception:
        logger.exception("claude_client.call_with_tools failed")
        return {"answer": None, "tool_calls": tool_calls_log, "messages": messages}


def _block_to_dict(block) -> dict:
    """Convert an Anthropic SDK content block back into the dict shape the
    API expects on the next turn. The SDK gives us typed objects but
    `messages.create` accepts dicts on input, so we round-trip carefully."""
    t = getattr(block, "type", None)
    if t == "text":
        return {"type": "text", "text": block.text}
    if t == "tool_use":
        return {"type": "tool_use", "id": block.id, "name": block.name, "input": block.input}
    # Fallback: best-effort dump. Unknown block types are rare and will
    # log as a warning when Claude tries to consume them on the next turn.
    return getattr(block, "model_dump", lambda: {})()
