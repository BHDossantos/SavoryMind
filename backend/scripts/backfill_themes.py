"""Retroactively populate themes/complaints/praise/tone on existing reviews.

Stage-2 theme extraction (sentiment_service.extract_themes) only runs at
review-create time, so reviews that landed before the Claude integration
shipped have null theme columns. This script walks `Review.themes IS NULL`
rows and backfills them. Existing data is never overwritten.

Idempotent + resumable: each row commits independently. If the script
crashes / hits a rate limit / loses network half-way through, re-running
picks up exactly where it left off.

Usage (run from repo root or backend/):

    python -m scripts.backfill_themes              # process every null row
    python -m scripts.backfill_themes --dry-run    # log what would change, no DB writes
    python -m scripts.backfill_themes --limit 50   # cap rows for testing
    python -m scripts.backfill_themes --user-id 7  # scope to one restaurant

Prereqs: ANTHROPIC_API_KEY set, DATABASE_URL pointing at the target DB.
Without ANTHROPIC_API_KEY every call returns None and the script will
report 0 enriched / N skipped — exactly the same as before, no harm done.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.database import SessionLocal  # noqa: E402
from app.models.review import Review  # noqa: E402
from app.services.sentiment_service import extract_themes  # noqa: E402


def _apply_themes(review: Review, themes: dict) -> None:
    """Mutate the row with the JSON-encoded shape `create_review` writes."""
    review.themes     = json.dumps(themes["themes"])
    review.complaints = json.dumps(themes["complaints"])
    review.praise     = json.dumps(themes["praise"])
    review.tone       = themes["tone"]


def backfill(
    *,
    dry_run: bool = False,
    limit: int | None = None,
    user_id: int | None = None,
    progress_every: int = 25,
) -> dict:
    """Returns a stats dict: {scanned, enriched, skipped, errors}."""
    db = SessionLocal()
    stats = {"scanned": 0, "enriched": 0, "skipped": 0, "errors": 0}
    try:
        q = db.query(Review).filter(Review.themes.is_(None))
        if user_id is not None:
            q = q.filter(Review.user_id == user_id)
        q = q.order_by(Review.id.asc())
        if limit is not None:
            q = q.limit(limit)
        rows = q.all()

        total = len(rows)
        print(f"→ {total} review(s) with null themes to process"
              + (f" (user_id={user_id})" if user_id is not None else "")
              + (" — DRY RUN, no DB writes" if dry_run else ""))

        for i, review in enumerate(rows, start=1):
            stats["scanned"] += 1
            try:
                themes = extract_themes(review.comment or "")
            except Exception as exc:
                # Network blip / rate limit / unexpected schema — don't poison
                # the loop, just log and move on. Re-run picks it up later.
                stats["errors"] += 1
                print(f"  ! review {review.id}: extract_themes raised {type(exc).__name__}: {exc}")
                continue

            if not themes:
                # Claude unavailable, comment too short, or returned nothing.
                stats["skipped"] += 1
            else:
                if not dry_run:
                    _apply_themes(review, themes)
                    db.commit()
                stats["enriched"] += 1

            if i % progress_every == 0 or i == total:
                print(f"  …{i}/{total}  enriched={stats['enriched']}"
                      f"  skipped={stats['skipped']}  errors={stats['errors']}")

        print(f"✓ Done. {stats}")
        return stats
    finally:
        db.close()


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--dry-run", action="store_true", help="Run extract_themes but don't write to DB.")
    p.add_argument("--limit", type=int, default=None, help="Max rows to process (default: all).")
    p.add_argument("--user-id", type=int, default=None, help="Scope to a single restaurant's reviews.")
    p.add_argument("--progress-every", type=int, default=25, help="Print a progress line every N rows.")
    args = p.parse_args()

    stats = backfill(
        dry_run=args.dry_run,
        limit=args.limit,
        user_id=args.user_id,
        progress_every=args.progress_every,
    )
    # Non-zero exit only if every row errored — useful for CI smoke-tests
    # but otherwise treat partial enrichment as success (re-run picks up rest).
    if stats["scanned"] > 0 and stats["errors"] == stats["scanned"]:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
