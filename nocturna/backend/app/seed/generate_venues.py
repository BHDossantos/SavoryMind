"""Helper that emits venue seed JSON files programmatically.

Run: `python -m app.seed.generate_venues` (writes rome_venues.json + international_venues.json next to this file).
Also imported by `seed_venues` to ensure JSON exists at startup.
"""
from __future__ import annotations

import json
from pathlib import Path

HERE = Path(__file__).parent

WEEK = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def _hours(open_close_per_day: dict) -> dict:
    out = {}
    for d in WEEK:
        slots = open_close_per_day.get(d)
        out[d] = [{"open": s[0], "close": s[1]} for s in slots] if slots else []
    return out


def restaurant(slots=("19:30", "00:00")):
    return _hours({d: [slots] for d in WEEK})


def bar(slots=("18:30", "02:00")):
    return _hours({d: [slots] for d in ("tue", "wed", "thu", "fri", "sat", "sun")})


def club(slots=("23:30", "05:00")):
    return _hours({d: [slots] for d in ("thu", "fri", "sat")})


def rooftop(slots=("18:00", "01:30")):
    return _hours({d: [slots] for d in ("tue", "wed", "thu", "fri", "sat", "sun")})


def late_food(slots=("00:00", "05:00")):
    return _hours({d: [slots] for d in WEEK})


def speakeasy(slots=("20:00", "02:30")):
    return _hours({d: [slots] for d in ("wed", "thu", "fri", "sat")})


def live_music(slots=("20:30", "02:00")):
    return _hours({d: [slots] for d in ("wed", "thu", "fri", "sat", "sun")})


def lounge(slots=("19:00", "02:00")):
    return _hours({d: [slots] for d in ("tue", "wed", "thu", "fri", "sat", "sun")})


def slugify(name: str) -> str:
    import re

    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s[:60]
