"""Flavor assistant — Claude Opus 4.7 answering cooking questions in
SavoryMind's unified voice. The persona itself lives in
claude_client.FLAVOR_PERSONA so every Claude-driven surface speaks
with the same warmth.

i18n: the persona prefix is built per-request via
claude_client.flavor_persona_for(language) so Flavor responds in the
user's language. The task instructions below stay in English (Claude
follows English meta-instructions reliably, and translating them
introduces drift) — the persona directive at the top is what shifts
Flavor's output language."""
from . import claude_client


# Task-specific instructions for the assistant. Concatenated with the
# language-aware persona at request time. Note: this string is meta
# (instructions ABOUT the response shape) so it stays English; Flavor's
# actual answer text is what shifts language per FLAVOR_LANGUAGE_DIRECTIVES.
_ASSISTANT_TASK = """The user is talking to you through the assistant chat — they're often \
in the middle of cooking and they're asking for help. Lead with the \
answer. Practical, not lecture-y. A brief "why" only when it earns \
its keep.

Useful patterns:
- For a problem the user describes (broken sauce, tough meat, dough \
  not rising), give the fix in 1-3 short steps. Mention specific \
  quantities, temperatures, and times. Both metric and imperial when \
  it applies.
- For a recommendation request (substitution, pairing, what to make \
  with X), give 2-3 concrete suggestions with one sentence on each.
- For a recipe ask, sketch the dish in a few sentences — don't write \
  out a full recipe unless asked.

Always respond as a JSON object with exactly two fields:
- "title": short label for the answer (3-7 words, sentence case, no \
  trailing punctuation)
- "answer": the full response (typically 1-3 short paragraphs, plain \
  text — no markdown headings)

If the question is unclear or completely off-topic for food / cooking, \
set title to "Quick question" and use the answer field to ask ONE \
specific clarifying question. Stay in voice — friendly, not robotic."""


def _build_system_prompt(language: str | None) -> str:
    """Compose the per-request system prompt: language-aware persona +
    fixed task instructions. Same persona as every other Flavor surface,
    just with a translation directive when needed."""
    return f"{claude_client.flavor_persona_for(language)}\n\n{_ASSISTANT_TASK}"


_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "answer": {"type": "string"},
    },
    "required": ["title", "answer"],
    "additionalProperties": False,
}


def answer(question: str, language: str | None = None) -> dict:
    """Ask Flavor a cooking question. Returns {"title": str, "answer": str}.
    Falls back to a graceful "not configured" / "try again" message rather
    than 500ing the request.

    `language` is the user's preferred i18n code (en/es/it). When non-en,
    Flavor responds natively in that language — see
    claude_client.flavor_persona_for(). The fallback strings below stay
    English; they're operational messages the user shouldn't normally see
    and translating them per-language adds maintenance for marginal value."""
    if not claude_client.is_configured():
        return {
            "title": "Flavor's not configured yet",
            "answer": "Flavor isn't wired up on this server — the admin needs to set ANTHROPIC_API_KEY. Once that's in, I'll be here.",
        }

    result = claude_client.call_json(_build_system_prompt(language), question, _RESPONSE_SCHEMA)
    if not result:
        return {
            "title": "Hit a snag",
            "answer": "Something glitched on my end. Try once more in a moment — usually that does it.",
        }
    return {"title": str(result["title"]), "answer": str(result["answer"])}
