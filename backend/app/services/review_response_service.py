"""Review-response AI — drafts a polite reply for each diner review.

The audit's quote: *"What review needs response? AI should generate the
campaign and let the owner approve it."* Same principle here. We don't
auto-publish — the operator reviews, edits if needed, sends.

The draft adapts tone to the review's star rating:
  ≥4 → warm thanks, invite back
  ≤2 → empathetic acknowledgement, offer to make it right
  3   → measured, ask what could improve

Fallback: when Claude isn't configured, return a competent canned reply
in the operator's language so the flow never dead-ends.
"""
from __future__ import annotations

import logging
from typing import Any

from . import claude_client

logger = logging.getLogger(__name__)


RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "response": {"type": "string"},
        "tone":     {"type": "string"},  # warm | empathetic | measured
    },
    "required": ["response", "tone"],
}


_SYSTEM_PROMPT = (
    "You are SavoryMind's hospitality copywriter drafting a reply on behalf\n"
    "of an independent restaurant. The reply will be reviewed by the owner\n"
    "before publishing.\n"
    "\n"
    "Rules:\n"
    "- Write in the restaurant's language (provided in the payload).\n"
    "- 2–4 sentences. Warm but never gushing.\n"
    "- Use the guest's name only if it's present and looks real.\n"
    "- For 1–2 star reviews: empathetic, acknowledge the specific complaint, offer to make it right (e.g. invite the operator to follow up). Do NOT promise refunds.\n"
    "- For 3 star reviews: measured, thank them, ask what could improve next time.\n"
    "- For 4–5 star reviews: warm, thank them by mentioning what they liked, invite them back.\n"
    "- Never mention specific dishes the guest didn't mention.\n"
    "- No emojis. No links.\n"
)


def generate(
    *,
    rating: int,
    comment: str,
    guest_name: str = "",
    restaurant_name: str = "the restaurant",
    language: str = "en",
) -> dict[str, Any]:
    payload = {
        "restaurant_name": restaurant_name,
        "language":        language,
        "guest_name":      guest_name,
        "rating":          rating,
        "comment":         comment,
    }
    out = claude_client.call_json(_SYSTEM_PROMPT, payload, RESPONSE_SCHEMA)
    if out and out.get("response"):
        return out
    return _fallback(rating, language, guest_name, restaurant_name)


def _fallback(rating: int, lang: str, guest: str, rest: str) -> dict:
    lang = (lang or "en").lower()
    name = (guest or "").strip()
    addr = name if name else _generic_addr(lang)
    if rating <= 2:
        body = _bag(lang, "low", rest, addr)
        tone = "empathetic"
    elif rating == 3:
        body = _bag(lang, "mid", rest, addr)
        tone = "measured"
    else:
        body = _bag(lang, "high", rest, addr)
        tone = "warm"
    return {"response": body, "tone": tone}


def _generic_addr(lang: str) -> str:
    return {
        "en": "Hi there",
        "it": "Ciao",
        "es": "Hola",
        "pt": "Olá",
        "fr": "Bonjour",
    }.get(lang, "Hi there")


def _bag(lang: str, sev: str, rest: str, addr: str) -> str:
    L = {
        "en": {
            "low":  f"{addr}, thank you for taking the time to share this — we hear you, and we're sorry the visit fell short. We'd love the chance to make it right. Please reach out to us at {rest} and we'll follow up personally.",
            "mid":  f"{addr}, thank you for the honest feedback. We're always looking to improve — if there's anything specific you'd like us to work on for your next visit, let us know.",
            "high": f"{addr}, thank you so much for the kind words! Reviews like yours make our day at {rest}. We hope to see you back soon.",
        },
        "it": {
            "low":  f"{addr}, grazie per averci scritto — ti capiamo, e ci dispiace che la visita non sia stata all'altezza. Vorremmo poter rimediare: scrivici e ti risponderemo personalmente.",
            "mid":  f"{addr}, grazie per il riscontro onesto. Stiamo sempre cercando di migliorare — se c'è qualcosa di specifico su cui lavorare per la tua prossima visita, faccelo sapere.",
            "high": f"{addr}, grazie di cuore per le belle parole! Recensioni come la tua ci fanno la giornata. Ti aspettiamo presto da {rest}.",
        },
    }
    return L.get(lang, L["en"])[sev]
