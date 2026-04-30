"""Two-stage review analysis:

  Stage 1: VADER polarity score. Lexicon-based, sub-millisecond, runs
           always — the result feeds the existing sentiment_score /
           sentiment_label columns and the dashboard charts.

  Stage 2: Claude theme extraction. When ANTHROPIC_API_KEY is set,
           pulls structured signal from the comment text — themes the
           guest is talking about (service, wait time, value), specific
           complaints, specific praise, and an overall tone. Best-effort:
           a Claude failure leaves the columns null; the review still
           saves and the dashboard still works.

VADER alone gave a number and a label. Themes give the restaurant
something to act on: "12 reviews mention 'wait time' as a complaint"
beats "average sentiment is 0.3 across 47 reviews".
"""
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

from . import claude_client

_analyzer = SentimentIntensityAnalyzer()


def analyze_sentiment(text: str) -> tuple[float, str]:
    """Stage 1: VADER polarity. Returns (score, label)."""
    scores = _analyzer.polarity_scores(text)
    compound = round(scores["compound"], 3)  # -1.0 to 1.0

    if compound >= 0.05:
        label = "positive"
    elif compound <= -0.05:
        label = "negative"
    else:
        label = "neutral"

    return compound, label


# ── Stage 2: Claude theme extraction --------------------------------------


_THEMES_SCHEMA = {
    "type": "object",
    "properties": {
        "themes": {
            "type": "array",
            "minItems": 0,
            "maxItems": 5,
            "items": {"type": "string"},
        },
        "complaints": {
            "type": "array",
            "minItems": 0,
            "maxItems": 3,
            "items": {"type": "string"},
        },
        "praise": {
            "type": "array",
            "minItems": 0,
            "maxItems": 3,
            "items": {"type": "string"},
        },
        "tone": {
            "type": "string",
            "enum": ["positive", "neutral", "mixed", "frustrated", "angry"],
        },
    },
    "required": ["themes", "complaints", "praise", "tone"],
    "additionalProperties": False,
}


_THEMES_SYSTEM = """You are an analyst extracting structured signal from one
restaurant review at a time.

Return EXACTLY this shape:
- "themes": 1-5 short noun phrases the guest is talking about. Use lowercase,
  2-4 words each. Examples: "wait time", "portion size", "service speed",
  "value for money", "ambience", "dietary options". Pick whatever the
  reviewer actually mentions, not generic categories.
- "complaints": 0-3 specific gripes phrased as the issue, lowercase.
  e.g. "overcooked steak", "rude waiter", "tiny portion". Empty list if none.
- "praise": 0-3 specific positives, same format. e.g. "fresh ingredients",
  "attentive service", "creative pairings". Empty list if none.
- "tone": ONE of positive | neutral | mixed | frustrated | angry. "frustrated"
  for disappointed-but-restrained complaints; "angry" for hostile ones.

If the comment is too short or vague to extract anything useful, return empty
lists for themes/complaints/praise and tone="neutral".
"""


def extract_themes(comment: str) -> dict | None:
    """Returns {themes, complaints, praise, tone} or None if Claude is
    unavailable or the call fails. Callers store the dict's fields on the
    Review row; None means the review is saved with theme columns null."""
    if not comment or len(comment.strip()) < 8:
        return None
    return claude_client.call_json(
        _THEMES_SYSTEM,
        comment,
        _THEMES_SCHEMA,
        # Reviews are short — use the cheaper/faster Haiku model.
        model=claude_client.BATCH_MODEL,
        max_tokens=512,
    )
