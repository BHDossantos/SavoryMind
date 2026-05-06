"""Culinary assistant — calls Claude Opus 4.7 to answer cooking questions."""
from . import claude_client


_SYSTEM_PROMPT = """You are SavoryMind's culinary assistant — a warm, knowledgeable cook helping a home cook in the middle of preparing food.

Your job: answer cooking questions clearly and quickly. You can help with anything cooking-related — fixing problems mid-cook, recipe suggestions, ingredient substitutions, technique guidance, wine and beverage pairings, meal ideas, dietary swaps, kitchen equipment, food safety.

Style:
- Warm but concise — the user is busy at the stove. Lead with the answer.
- Practical, not lecture-y. A brief "why" only when it helps.
- Use specific quantities, temperatures, and times when applicable. Include both metric and imperial.
- For a problem the user describes, give the fix in 1-3 short steps.
- For a recommendation request, give 2-3 concrete suggestions with one sentence on each.

Always respond as a JSON object with exactly two fields:
- "title": a short label for the answer (3-7 words, sentence case, no trailing punctuation)
- "answer": the full response (typically 1-3 short paragraphs, plain text — no markdown headings)

If the question is unclear or completely off-topic for cooking, set title to "Quick question" and use the answer field to ask one specific clarifying question."""


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
    """Ask Claude a culinary question. Returns {"title": str, "answer": str}.
    Falls back to a graceful "not configured" / "try again" message rather
    than 500ing the request."""
    if not claude_client.is_configured():
        return {
            "title": "Assistant not configured",
            "answer": "The culinary assistant isn't set up yet. The site administrator needs to add an ANTHROPIC_API_KEY.",
        }

    result = claude_client.call_json(_SYSTEM_PROMPT, question, _RESPONSE_SCHEMA)
    if not result:
        return {
            "title": "Try again",
            "answer": "The assistant hit a temporary issue. Please try once more in a moment.",
        }
    return {"title": str(result["title"]), "answer": str(result["answer"])}
