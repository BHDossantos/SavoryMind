"""AI campaign generator — turns a "Promote X" rec into ready-to-paste copy.

The audit's quote: *"Restaurant owner clicks one button: 'Create this week's
promotion.' SavoryMind creates Instagram caption / Facebook post / WhatsApp
message / email campaign / menu promotion / offer copy. This is extremely
valuable."*

Claude generates four channel-specific bodies in the operator's language.
Sensible fallback shapes keep the UI honest when ANTHROPIC_API_KEY isn't
set — the call returns a template-shaped result so the operator still gets
*something* useful instead of an error.
"""
from __future__ import annotations

import logging
from typing import Any

from . import claude_client

logger = logging.getLogger(__name__)


CAMPAIGN_SCHEMA = {
    "type": "object",
    "properties": {
        "headline": {"type": "string"},
        "instagram_caption": {"type": "string"},
        "whatsapp_message": {"type": "string"},
        "email_subject":    {"type": "string"},
        "email_body":       {"type": "string"},
        "sms_body":         {"type": "string"},
    },
    "required": [
        "headline", "instagram_caption", "whatsapp_message",
        "email_subject", "email_body", "sms_body",
    ],
}


_SYSTEM_PROMPT = (
    "You are SavoryMind's marketing copywriter for an independent restaurant.\n"
    "Generate punchy, channel-native copy for a single promotional campaign.\n"
    "\n"
    "Rules:\n"
    "- Write in the restaurant's language (provided in the payload).\n"
    "- Instagram caption: 2–4 sentences, evocative, 3–4 hashtags max.\n"
    "- WhatsApp message: warm, personal, ≤320 chars, can include the booking link.\n"
    "- Email: subject ≤60 chars, body 4–6 short sentences, ends with CTA.\n"
    "- SMS: ≤140 chars, urgent, no link unless one is provided.\n"
    "- Never invent prices, ingredients, or claims beyond what the dish brief contains.\n"
    "- No emojis in SMS or email subject. Limited emojis in IG/WhatsApp.\n"
)


def generate(
    *,
    dish: str,
    angle: str = "promotion",
    restaurant_name: str = "the restaurant",
    cuisine: str = "",
    language: str = "en",
    booking_link: str | None = None,
    notes: str = "",
) -> dict[str, Any]:
    """Produce a four-channel campaign. Never raises — returns a hand-shaped
    fallback when Claude is unavailable so the UI flow doesn't break."""
    payload = {
        "restaurant_name": restaurant_name,
        "cuisine":         cuisine,
        "dish":            dish,
        "angle":           angle,    # promotion | new_item | comeback | event | menu_of_the_day
        "language":        language,
        "booking_link":    booking_link or "",
        "operator_notes":  notes,
    }

    result = claude_client.call_json(_SYSTEM_PROMPT, payload, CAMPAIGN_SCHEMA)
    if result and _looks_valid(result):
        return result
    # Fallback — never hand a blank screen to the operator. Localized
    # baseline so the Italian pilot doesn't see English when the key's off.
    return _fallback(payload)


def _looks_valid(c: dict) -> bool:
    return all((c.get("instagram_caption"), c.get("whatsapp_message"),
                c.get("email_subject"), c.get("email_body"), c.get("sms_body")))


def _fallback(p: dict) -> dict:
    lang = (p.get("language") or "en").lower()
    name = p.get("restaurant_name") or "the restaurant"
    dish = p.get("dish") or "today's dish"
    link = p.get("booking_link") or ""
    L = {
        "en": {
            "h":  f"Try {dish} at {name} this week",
            "ig": f"This week at {name}: {dish}. Limited tables — come hungry. #{name.replace(' ', '').lower()}",
            "wa": f"Hey! We're featuring {dish} this week at {name}. Want me to save you a table?" + (f"\n{link}" if link else ""),
            "es_sub": f"This week at {name}: {dish}",
            "eb": f"Hi,\n\nWe're putting {dish} front and centre this week at {name}. It's the kind of plate that deserves an empty calendar around it.\n\nBook a table — we'd love to see you.\n\n— The team at {name}",
            "sm": f"Featuring {dish} this week at {name}. Save us a seat?",
        },
        "it": {
            "h":  f"Prova {dish} da {name} questa settimana",
            "ig": f"Questa settimana da {name}: {dish}. Pochi tavoli — vieni affamato. #{name.replace(' ', '').lower()}",
            "wa": f"Ciao! Questa settimana da {name} c'è {dish}. Ti tengo un tavolo?" + (f"\n{link}" if link else ""),
            "es_sub": f"Questa settimana da {name}: {dish}",
            "eb": f"Ciao,\n\nQuesta settimana mettiamo {dish} al centro del menù. Un piatto da assaporare con calma.\n\nPrenota un tavolo — ti aspettiamo.\n\n— Il team di {name}",
            "sm": f"Questa settimana da {name}: {dish}. Ti tengo un tavolo?",
        },
    }
    bag = L.get(lang, L["en"])
    return {
        "headline":          bag["h"],
        "instagram_caption": bag["ig"],
        "whatsapp_message":  bag["wa"],
        "email_subject":     bag["es_sub"],
        "email_body":        bag["eb"],
        "sms_body":          bag["sm"],
    }
