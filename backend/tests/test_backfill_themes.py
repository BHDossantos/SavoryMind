"""Tests for scripts/backfill_themes.py.

The backfill walks every Review row whose `themes` column is null, asks
Claude for structured signal, and writes the JSON-encoded result back.
These tests exercise the loop in isolation by seeding rows directly via
the test SessionLocal and patching `extract_themes` so no real API call
is ever made.
"""
import json
from unittest.mock import patch

import pytest

from app.models.review import Review
from scripts.backfill_themes import backfill


def _seed_review(db_session, user_id: int, comment: str = "Service was slow but the food was great.") -> Review:
    r = Review(
        user_id=user_id,
        customer_name="Tester",
        menu_item="Risotto",
        rating=4,
        comment=comment,
        sentiment_score=0.0,
        sentiment_label="neutral",
        # All theme columns left null — that's the precondition the backfill targets.
    )
    db_session.add(r)
    db_session.commit()
    db_session.refresh(r)
    return r


_FAKE_THEMES = {
    "themes": ["service speed", "food quality"],
    "complaints": ["slow service"],
    "praise": ["great food"],
    "tone": "mixed",
}


@pytest.fixture
def restaurant_user(client, db_session):
    """A registered restaurant user we can attach reviews to. Restaurant
    registration seeds 15 demo reviews so the dashboard isn't empty for a
    new account — wipe them so each test has a clean slate and the
    backfill counts match what the test seeds explicitly."""
    from .conftest import register_user
    _, user = register_user(client, account_type="restaurant")
    db_session.query(Review).delete()
    db_session.commit()
    return user["id"]


def test_backfill_enriches_null_rows(client, db_session, restaurant_user):
    review = _seed_review(db_session, restaurant_user)

    with patch("scripts.backfill_themes.extract_themes", return_value=_FAKE_THEMES) as m:
        stats = backfill(progress_every=1)

    assert m.call_count >= 1, "extract_themes should be called at least once"
    db_session.refresh(review)
    assert json.loads(review.themes) == _FAKE_THEMES["themes"]
    assert json.loads(review.complaints) == _FAKE_THEMES["complaints"]
    assert json.loads(review.praise) == _FAKE_THEMES["praise"]
    assert review.tone == "mixed"
    assert stats["enriched"] >= 1
    assert stats["errors"] == 0


def test_backfill_skips_already_enriched(client, db_session, restaurant_user):
    """Idempotency check — a row that already has themes set is filtered
    out by the WHERE clause and never sent to Claude."""
    enriched = _seed_review(db_session, restaurant_user, comment="Already done.")
    enriched.themes = json.dumps(["pre-existing"])
    enriched.complaints = json.dumps([])
    enriched.praise = json.dumps([])
    enriched.tone = "positive"
    db_session.commit()

    null_row = _seed_review(db_session, restaurant_user, comment="Not done yet.")

    with patch("scripts.backfill_themes.extract_themes", return_value=_FAKE_THEMES) as m:
        stats = backfill()

    # Only the null row should have triggered a call.
    assert m.call_count == 1
    db_session.refresh(enriched)
    assert json.loads(enriched.themes) == ["pre-existing"], "existing data must not be overwritten"
    db_session.refresh(null_row)
    assert null_row.tone == "mixed"
    assert stats["scanned"] == 1


def test_backfill_dry_run_does_not_write(client, db_session, restaurant_user):
    review = _seed_review(db_session, restaurant_user)

    with patch("scripts.backfill_themes.extract_themes", return_value=_FAKE_THEMES):
        stats = backfill(dry_run=True)

    db_session.refresh(review)
    assert review.themes is None
    assert review.tone is None
    # Counted as "enriched" in stats since extract_themes returned data,
    # but the DB stayed clean.
    assert stats["enriched"] == 1


def test_backfill_skips_when_extract_returns_none(client, db_session, restaurant_user):
    """extract_themes returns None for unconfigured Claude or too-short
    comments — the script must record this as a skip, not an error, and
    must not write garbage to the row."""
    review = _seed_review(db_session, restaurant_user, comment="Hi.")

    with patch("scripts.backfill_themes.extract_themes", return_value=None):
        stats = backfill()

    db_session.refresh(review)
    assert review.themes is None
    assert stats["skipped"] >= 1
    assert stats["enriched"] == 0


def test_backfill_continues_past_per_row_exception(client, db_session, restaurant_user):
    """A transient Claude error on one row must not abort the loop —
    later rows still get processed and the failed row is left null for
    the next run to retry."""
    bad   = _seed_review(db_session, restaurant_user, comment="This one will explode.")
    good  = _seed_review(db_session, restaurant_user, comment="This one will succeed.")

    def flaky(comment):
        if "explode" in comment:
            raise RuntimeError("simulated rate-limit")
        return _FAKE_THEMES

    with patch("scripts.backfill_themes.extract_themes", side_effect=flaky):
        stats = backfill()

    db_session.refresh(bad)
    db_session.refresh(good)
    assert bad.themes is None, "errored row should be left for re-run"
    assert good.tone == "mixed"
    assert stats["errors"] == 1
    assert stats["enriched"] == 1


def test_backfill_respects_limit(client, db_session, restaurant_user):
    for _ in range(5):
        _seed_review(db_session, restaurant_user)

    with patch("scripts.backfill_themes.extract_themes", return_value=_FAKE_THEMES) as m:
        stats = backfill(limit=2)

    assert m.call_count == 2
    assert stats["scanned"] == 2


def test_backfill_scopes_to_user_id(client, db_session, restaurant_user):
    """--user-id keeps a backfill from blasting the whole table when an
    operator only wants to refresh one restaurant's data."""
    mine = _seed_review(db_session, restaurant_user, comment="Mine.")

    # A second user with their own review — should be ignored.
    from .conftest import register_user
    _, other = register_user(client, email="bob@example.com", account_type="restaurant")
    theirs = _seed_review(db_session, other["id"], comment="Theirs.")

    with patch("scripts.backfill_themes.extract_themes", return_value=_FAKE_THEMES) as m:
        stats = backfill(user_id=restaurant_user)

    assert m.call_count == 1
    db_session.refresh(mine)
    db_session.refresh(theirs)
    assert mine.tone == "mixed"
    assert theirs.tone is None
    assert stats["scanned"] == 1
