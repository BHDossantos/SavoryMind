"""Centralised data loader for the catalog files in this directory.

Why this module exists: until now the wine / beer / spirits / recipe
catalogs lived as inline Python literals at the top of their respective
service modules. That made the files long, made expansion painful
(every new recipe meant a code change + PR + redeploy), and made it
impossible to share the data with non-Python tooling.

Now the catalogs live as JSON files in this directory and load lazily
on first access. Service modules continue to import WINES / BEERS /
SPIRITS / RECIPES from here — their public API didn't change.

The JSON files are regenerated periodically via scripts/generate_data.py
(Claude-driven batch). For day-to-day development, edit the JSON
directly and the next import will pick it up.

Loading is memoised so the JSON parse happens once per process. Files
are bundled with the deploy artifact (NOT runtime-fetched) so a deploy
worker without write access still works.
"""
from __future__ import annotations

import json
import logging
from functools import lru_cache
from pathlib import Path

logger = logging.getLogger(__name__)

_DATA_DIR = Path(__file__).parent


def _load(name: str):
    path = _DATA_DIR / f"{name}.json"
    try:
        with open(path, "r", encoding="utf-8") as fp:
            return json.load(fp)
    except FileNotFoundError:
        logger.warning("data file missing: %s — returning empty catalog", path)
        return {} if name == "wines" else []
    except json.JSONDecodeError as exc:
        # Loud and proud: a malformed JSON catalog is a deploy-time bug
        # we want to fix immediately, not silently degrade.
        logger.exception("data file %s is not valid JSON: %s", path, exc)
        raise


@lru_cache(maxsize=1)
def get_wines() -> dict:
    """Wine catalog keyed by grape slug (cabernet_sauvignon, malbec, ...).
    Each entry: name, style, flavor_profile, regions, price_range,
    serving_temp, decant, decant_time."""
    return _load("wines")


@lru_cache(maxsize=1)
def get_beers() -> list[dict]:
    """Beer catalog. Each entry: name, style, brewery, abv, flavour, serve."""
    return _load("beers")


@lru_cache(maxsize=1)
def get_spirits() -> list[dict]:
    """Spirits catalog. Each entry: name, category, region, abv, flavour, serve."""
    return _load("spirits")


@lru_cache(maxsize=1)
def get_recipes() -> list[dict]:
    """Recipe catalog. Each entry: id, title, cuisine, mood, keywords (regex),
    difficulty, time_minutes, servings, image_emoji, description,
    ingredients[], steps[], wine_pairing, beer_pairing."""
    return _load("recipes")
