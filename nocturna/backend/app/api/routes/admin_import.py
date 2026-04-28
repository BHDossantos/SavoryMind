"""CSV / JSON venue importer.

Accepts:
- text/csv with the columns documented in /api/admin/import/template
- application/json with a list of venue dicts (same shape as VenueCreate)

Returns a per-row result so the admin UI can show what's about to change before
committing (dry-run mode) and what actually changed after commit.
"""
from __future__ import annotations

import csv
import io
import json
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import require_admin
from app.models import Venue
from app.services.importer import import_rows, parse_csv, parse_json, TEMPLATE_COLUMNS

router = APIRouter(prefix="/api/admin/import", tags=["admin"])


@router.get("/template")
def template():
    """Return the CSV column spec so the admin UI can render help text."""
    return {
        "columns": TEMPLATE_COLUMNS,
        "csv_header": ",".join(c["name"] for c in TEMPLATE_COLUMNS),
        "list_columns": [
            "music_types", "vibe_tags", "crowd_types", "cuisine_tags", "best_nights", "photos",
        ],
        "json_columns": ["opening_hours", "contact"],
        "notes": [
            "Lists may be either JSON arrays or pipe-separated values.",
            "opening_hours is a JSON object keyed by mon..sun, each a list of {open, close}.",
            "Slug is auto-derived from name if blank; existing slugs are upsert-updated.",
        ],
    }


@router.post("/venues")
async def import_venues(
    file: Optional[UploadFile] = File(default=None),
    raw: Optional[str] = Form(default=None),
    dry_run: bool = Form(default=True),
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    """Upload venues. Send a CSV or JSON file as `file`, or paste the raw
    text in `raw`. Set `dry_run=true` to preview without committing.
    """
    if not file and not raw:
        raise HTTPException(400, "Provide a file or 'raw' body")

    body: bytes
    name: str
    if file:
        body = await file.read()
        name = (file.filename or "").lower()
        ctype = (file.content_type or "").lower()
    else:
        body = (raw or "").encode("utf-8")
        name = ""
        ctype = ""

    text = body.decode("utf-8-sig", errors="replace")

    try:
        if name.endswith(".json") or ctype == "application/json" or text.lstrip().startswith(("[", "{")):
            rows = parse_json(text)
        else:
            rows = parse_csv(text)
    except ValueError as e:
        raise HTTPException(400, f"Could not parse upload: {e}")

    if not rows:
        raise HTTPException(400, "Upload contained no rows")

    summary = import_rows(db, rows, dry_run=dry_run)
    return summary
