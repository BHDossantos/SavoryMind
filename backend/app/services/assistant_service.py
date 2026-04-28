"""
Culinary assistant — calls Claude Opus 4.7 to answer arbitrary cooking questions.

Returns the same {"title": str, "answer": str} contract the route already expects,
so /api/consumer/assistant doesn't need to change.

Requires ANTHROPIC_API_KEY in the environment. Without it, returns a graceful
"setup needed" response instead of crashing the request.
"""
import json
import logging
import os

logger = logging.getLogger(__name__)

_client = None


def _get_client():
    global _client
    if _client is None:
        from anthropic import Anthropic
        _client = Anthropic()
    return _client


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
    """Ask Claude a culinary question. Returns {"title": str, "answer": str}."""
    if not os.getenv("ANTHROPIC_API_KEY"):
        return {
            "title": "Assistant not configured",
            "answer": "The culinary assistant isn't set up yet. The site administrator needs to add an ANTHROPIC_API_KEY.",
        }

    try:
        client = _get_client()
        response = client.messages.create(
            model="claude-opus-4-7",
            max_tokens=2048,
            system=[
                {
                    "type": "text",
                    "text": _SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[{"role": "user", "content": question}],
            output_config={
                "format": {"type": "json_schema", "schema": _RESPONSE_SCHEMA}
            },
        )

        if response.stop_reason == "refusal":
            return {
                "title": "Can't help with that",
                "answer": "I can't answer that one — try a different cooking question.",
            }

        text = next((b.text for b in response.content if b.type == "text"), "")
        if not text:
            raise ValueError("empty response from model")

        data = json.loads(text)
        return {"title": str(data["title"]), "answer": str(data["answer"])}

    except Exception:
        logger.exception("assistant_service.answer failed")
        return {
            "title": "Try again",
            "answer": "The assistant hit a temporary issue. Please try once more in a moment.",
        }
