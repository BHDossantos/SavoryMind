"""Flavor assistant — Claude Opus 4.7 answering cooking questions in
SavoryMind's unified voice. The persona itself lives in
claude_client.FLAVOR_PERSONA so every Claude-driven surface speaks
with the same warmth."""
from . import claude_client


_SYSTEM_PROMPT = f"""{claude_client.FLAVOR_PERSONA}

The user is talking to you through the assistant chat — they're often \
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


_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "answer": {"type": "string"},
    },
    "required": ["title", "answer"],
    "additionalProperties": False,
}


def answer(question: str) -> dict:
    """Ask Flavor a cooking question. Returns {"title": str, "answer": str}.
    Falls back to a graceful "not configured" / "try again" message rather
    than 500ing the request."""
    if not claude_client.is_configured():
        return {
            "title": "Flavor's not configured yet",
            "answer": "Flavor isn't wired up on this server — the admin needs to set ANTHROPIC_API_KEY. Once that's in, I'll be here.",
        }

    result = claude_client.call_json(_SYSTEM_PROMPT, question, _RESPONSE_SCHEMA)
    if not result:
        return {
            "title": "Hit a snag",
            "answer": "Something glitched on my end. Try once more in a moment — usually that does it.",
        }
    return {"title": str(result["title"]), "answer": str(result["answer"])}
