"""Venue CSV / JSON parsing + idempotent upsert."""
from __future__ import annotations

import csv
import io
import json
import re
from typing import Any, Iterable

from sqlalchemy.orm import Session

from app.models import Venue


TEMPLATE_COLUMNS: list[dict] = [
    {"name": "slug", "required": False, "help": "URL-safe id; auto-derived from name if blank"},
    {"name": "name", "required": True},
    {"name": "type", "required": True, "help": "restaurant|bar|club|lounge|rooftop|live_music|speakeasy|late_food"},
    {"name": "description", "required": False},
    {"name": "address", "required": True},
    {"name": "lat", "required": True, "help": "decimal latitude"},
    {"name": "lng", "required": True, "help": "decimal longitude"},
    {"name": "neighborhood", "required": True},
    {"name": "city", "required": False, "help": "default 'rome'"},
    {"name": "country", "required": False, "help": "ISO-2; default IT"},
    {"name": "opening_hours", "required": False, "help": "JSON object keyed by mon..sun"},
    {"name": "best_arrival_time", "required": False},
    {"name": "price_level", "required": False, "help": "1..4"},
    {"name": "avg_price_eur", "required": False},
    {"name": "dress_code", "required": False, "help": "streetwear|casual|business|elegant|sexy|luxury"},
    {"name": "music_types", "required": False, "help": "comma|pipe-separated or JSON array"},
    {"name": "crowd_types", "required": False},
    {"name": "vibe_tags", "required": False},
    {"name": "cuisine_tags", "required": False},
    {"name": "reservation_required", "required": False, "help": "true/false"},
    {"name": "walk_in_ok", "required": False},
    {"name": "vip_available", "required": False},
    {"name": "guestlist_required", "required": False},
    {"name": "phone", "required": False},
    {"name": "whatsapp", "required": False},
    {"name": "email", "required": False},
    {"name": "instagram", "required": False},
    {"name": "website", "required": False},
    {"name": "photos", "required": False, "help": "comma|pipe-separated URLs"},
    {"name": "menu_url", "required": False},
    {"name": "booking_url", "required": False},
    {"name": "capacity", "required": False},
    {"name": "partner_status", "required": False, "help": "none|basic|pro|premium"},
    {"name": "promoted", "required": False},
    {"name": "quality_score", "required": False, "help": "0..1"},
    {"name": "best_nights", "required": False},
    {"name": "active", "required": False},
    {"name": "admin_notes", "required": False},
]

LIST_COLUMNS = {"music_types", "crowd_types", "vibe_tags", "cuisine_tags", "best_nights", "photos"}
JSON_COLUMNS = {"opening_hours"}
BOOL_COLUMNS = {
    "reservation_required", "walk_in_ok", "vip_available", "guestlist_required",
    "promoted", "active",
}
INT_COLUMNS = {"price_level", "avg_price_eur", "capacity"}
FLOAT_COLUMNS = {"lat", "lng", "quality_score"}
CONTACT_COLUMNS = {"phone", "whatsapp", "email", "instagram", "website"}


def _slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (name or "").lower()).strip("-")
    return s[:60]


def _to_list(v: Any) -> list[str]:
    if v is None or v == "":
        return []
    if isinstance(v, list):
        return [str(x).strip() for x in v if str(x).strip()]
    s = str(v).strip()
    if s.startswith("["):
        try:
            arr = json.loads(s)
            return [str(x).strip() for x in arr if str(x).strip()]
        except json.JSONDecodeError:
            pass
    parts = re.split(r"[|,]", s)
    return [p.strip() for p in parts if p.strip()]


def _to_bool(v: Any) -> bool:
    if isinstance(v, bool):
        return v
    return str(v).strip().lower() in ("1", "true", "yes", "y", "t")


def _to_json(v: Any) -> dict:
    if isinstance(v, dict):
        return v
    if v is None or v == "":
        return {}
    try:
        return json.loads(v)
    except (TypeError, json.JSONDecodeError):
        return {}


def _coerce(row: dict) -> tuple[dict, list[str]]:
    """Convert a raw input row into Venue kwargs. Returns (clean_row, errors)."""
    errors: list[str] = []
    out: dict[str, Any] = {}

    def _grab(k: str, default=None):
        if k in row and row[k] not in (None, ""):
            return row[k]
        return default

    name = _grab("name")
    if not name:
        errors.append("missing 'name'")
    out["name"] = (name or "").strip()
    out["slug"] = (_grab("slug") or _slugify(out["name"])).strip()

    out["type"] = (_grab("type") or "").strip()
    if not out["type"]:
        errors.append("missing 'type'")

    out["address"] = (_grab("address") or "").strip()
    if not out["address"]:
        errors.append("missing 'address'")

    out["neighborhood"] = (_grab("neighborhood") or "Centro").strip()
    out["city"] = (_grab("city") or "rome").strip().lower()
    out["country"] = (_grab("country") or "IT").strip().upper()
    out["description"] = _grab("description")
    out["best_arrival_time"] = _grab("best_arrival_time")
    out["dress_code"] = (_grab("dress_code") or "casual").strip()
    out["partner_status"] = (_grab("partner_status") or "none").strip()
    out["admin_notes"] = _grab("admin_notes")
    out["menu_url"] = _grab("menu_url")
    out["booking_url"] = _grab("booking_url")

    for k in FLOAT_COLUMNS:
        v = _grab(k)
        if v is None:
            if k in ("lat", "lng"):
                errors.append(f"missing '{k}'")
                out[k] = 0.0
            else:
                out[k] = 0.7 if k == "quality_score" else 0.0
        else:
            try:
                out[k] = float(v)
            except (TypeError, ValueError):
                errors.append(f"'{k}' must be a number, got {v!r}")
                out[k] = 0.0

    for k in INT_COLUMNS:
        v = _grab(k)
        if v is None or v == "":
            out[k] = None if k == "capacity" else (50 if k == "avg_price_eur" else 2)
        else:
            try:
                out[k] = int(float(v))
            except (TypeError, ValueError):
                errors.append(f"'{k}' must be integer-ish, got {v!r}")
                out[k] = None

    for k in BOOL_COLUMNS:
        v = _grab(k)
        if v is None or v == "":
            out[k] = {"walk_in_ok": True, "active": True}.get(k, False)
        else:
            out[k] = _to_bool(v)

    for k in LIST_COLUMNS:
        out[k] = _to_list(_grab(k))

    for k in JSON_COLUMNS:
        out[k] = _to_json(_grab(k))

    contact = {c: _grab(c) for c in CONTACT_COLUMNS if _grab(c)}
    out["contact"] = contact

    if not out["best_nights"]:
        out["best_nights"] = ["fri", "sat"]

    return out, errors


def parse_csv(text: str) -> list[dict]:
    reader = csv.DictReader(io.StringIO(text))
    rows = []
    for r in reader:
        rows.append({k: (v.strip() if isinstance(v, str) else v) for k, v in r.items() if k})
    return rows


def parse_json(text: str) -> list[dict]:
    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        raise ValueError(f"invalid JSON: {e}") from e
    if isinstance(data, dict):
        data = [data]
    if not isinstance(data, list):
        raise ValueError("JSON must be a list of venue objects")
    return data


def import_rows(db: Session, rows: Iterable[dict], dry_run: bool = True) -> dict:
    """Upsert venue rows. Returns a per-row summary."""
    results = []
    counts = {"created": 0, "updated": 0, "errors": 0, "unchanged": 0}

    for idx, raw in enumerate(rows, start=1):
        clean, errors = _coerce(raw or {})
        slug = clean.get("slug") or ""
        existing = db.query(Venue).filter(Venue.slug == slug).first() if slug else None

        if errors:
            counts["errors"] += 1
            results.append({
                "row": idx, "slug": slug, "name": clean.get("name"),
                "action": "error", "errors": errors,
            })
            continue

        venue_kwargs = {k: v for k, v in clean.items() if hasattr(Venue, k)}

        if existing:
            changes = {}
            for k, v in venue_kwargs.items():
                if k in ("slug",):
                    continue
                old = getattr(existing, k)
                if old != v:
                    changes[k] = {"from": _safe(old), "to": _safe(v)}
                    if not dry_run:
                        setattr(existing, k, v)
            if not changes:
                counts["unchanged"] += 1
                results.append({
                    "row": idx, "slug": slug, "name": clean["name"],
                    "action": "unchanged",
                })
            else:
                counts["updated"] += 1
                results.append({
                    "row": idx, "slug": slug, "name": clean["name"],
                    "action": "update", "changes": changes,
                })
        else:
            counts["created"] += 1
            results.append({
                "row": idx, "slug": slug, "name": clean["name"],
                "action": "create",
            })
            if not dry_run:
                db.add(Venue(**venue_kwargs))

    if not dry_run:
        db.commit()
    return {"dry_run": dry_run, "counts": counts, "results": results}


def _safe(v: Any) -> Any:
    """JSON-safe scalar/list/dict for the diff payload."""
    if v is None or isinstance(v, (str, int, float, bool, list, dict)):
        return v
    return str(v)
