"""Snap-a-Menu — the consumer wedge, second surface.

Same brain as mood_to_meal_service, different input modality: instead
of a mood, the user snaps a photo of a menu. We send the image to
Claude vision with the user's taste profile and a "pick one dish from
this menu" instruction. Out comes a confident recommendation.

The wedge positioning: "Order like a local, anywhere." Works for
tourists in Italy who can't read the menu, expense-account diners who
want value, and indecisive locals who want one less decision.
"""
from __future__ import annotations

import base64
import logging
import os
from typing import Optional

from . import claude_client

logger = logging.getLogger(__name__)


DEFAULT_VISION_MODEL = "claude-haiku-4-5"
MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5MB — clients should compress to <1MB before upload
ALLOWED_MEDIA_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


_SCHEMA = {
    "type": "object",
    "properties": {
        "dish":         {"type": "string", "description": "The single dish you would order off this menu — name it exactly as it appears."},
        "why":          {"type": "string", "description": "One or two sentences justifying the pick. Reference the menu and the user's taste."},
        "alternatives": {"type": "array", "items": {"type": "string"}, "description": "Up to 2 backup picks if the first doesn't appeal."},
        "warnings":     {"type": "array", "items": {"type": "string"}, "description": "Any dietary risks you spotted on the menu (e.g. 'no gluten-free pasta listed')."},
        "share_title":  {"type": "string", "description": "Shareable one-line summary, e.g. 'Tonight: Tagliata di manzo. The menu's best value.'"},
    },
    "required": ["dish", "why", "alternatives", "warnings", "share_title"],
}


def _system_prompt(language: str) -> str:
    base = claude_client.flavor_persona_for(language)
    task = """
You are SavoryMind's Order Like a Local engine. The user just photographed
a restaurant menu and wants to know what to order.

Given their taste profile and the menu image, return ONE confident pick
as JSON:
  - dish: exact name as printed on the menu
  - why: one or two sentences. Reference both the menu's actual offering
    and the user's taste (cuisines they love, dietary, spice tolerance).
  - alternatives: up to 2 runner-up dishes from the menu.
  - warnings: dietary risks you spotted (e.g. "no vegan options" if user is
    vegan, or "spice level not marked" if user is sensitive). Empty array
    when nothing is risky.
  - share_title: a one-line phrase suitable for sharing socially, e.g.
    "Tonight: Tagliata di manzo. The menu's best value."

Rules:
  - Respect dietary restrictions strictly. Never recommend something
    they listed as a dislike or allergy.
  - If the image isn't a menu (or unreadable), set dish to "Can't read
    the menu" with a friendly warning explaining what went wrong.
  - Be confident. No "you could try" — say what they should order.
  - Respond in the user's language end-to-end, including the dish name
    if it's printed in the menu's original language (don't translate
    the dish name itself).
"""
    return f"{base}\n\n{task.strip()}"


def recommend_from_image(
    *,
    image_bytes: bytes,
    media_type: str,
    language: str = "en",
    cuisines: Optional[list[str]] = None,
    dietary: Optional[list[str]] = None,
    dislikes: Optional[list[str]] = None,
    spice: Optional[str] = None,
    budget: Optional[str] = None,
    non_alcoholic: bool = False,
) -> Optional[dict]:
    """Send the menu image + taste profile to Claude vision. Returns the
    parsed recommendation dict, or None if Claude isn't configured /
    refused / returned malformed JSON."""
    if not claude_client.is_configured():
        return None
    if not image_bytes or len(image_bytes) > MAX_IMAGE_BYTES:
        return None
    if media_type not in ALLOWED_MEDIA_TYPES:
        return None

    b64 = base64.b64encode(image_bytes).decode("ascii")
    taste_blob = {
        "cuisines": cuisines or [],
        "dietary":  dietary  or [],
        "dislikes": dislikes or [],
        "spice":    spice,
        "budget":   budget,
        "non_alcoholic": non_alcoholic,
        "language": language,
    }
    try:
        import json
        client = claude_client._get_client()
        system_blocks = [{
            "type": "text",
            "text": _system_prompt(language),
            "cache_control": {"type": "ephemeral"},
        }]
        user_content = [
            {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
            {"type": "text", "text": "Taste profile:\n" + json.dumps(taste_blob, ensure_ascii=False)},
        ]
        # We don't have call_json's schema-validation here because it
        # doesn't support vision — instead the response is parsed below
        # and validated manually against the required keys.
        resp = client.messages.create(
            model=os.getenv("CLAUDE_VISION_MODEL", DEFAULT_VISION_MODEL),
            max_tokens=600,
            system=system_blocks,
            messages=[{"role": "user", "content": user_content}],
        )
        text = "".join(b.text for b in resp.content if getattr(b, "type", None) == "text")
        # Claude sometimes wraps JSON in markdown fences; strip them.
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```", 2)[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
            cleaned = cleaned.rsplit("```", 1)[0]
        parsed = json.loads(cleaned)
        # Verify required keys; reject anything missing so the route can
        # fall back to a stub instead of returning garbage.
        for key in ("dish", "why", "alternatives", "warnings", "share_title"):
            if key not in parsed:
                logger.warning("menu_snap: missing key %r in claude response", key)
                return None
        return parsed
    except Exception as exc:
        logger.warning("menu_snap: claude call failed: %s", type(exc).__name__)
        return None
