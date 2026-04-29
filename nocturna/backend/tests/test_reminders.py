from datetime import datetime, timedelta

from app.models import Booking, NotificationLog, Venue
from app.services import reminders


def _hours_all_day():
    return {d: [{"open": "00:00", "close": "23:59"}] for d in ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]}


def _venue(db):
    v = Venue(slug="v", name="Test Venue", type="restaurant", address="123 Via",
              lat=41.9, lng=12.5, neighborhood="Centro", city="rome", country="IT",
              opening_hours=_hours_all_day(), avg_price_eur=60, price_level=2,
              dress_code="elegant", music_types=[], crowd_types=[], vibe_tags=[],
              cuisine_tags=[], contact={}, photos=[], best_nights=[], active=True,
              quality_score=0.9)
    db.add(v); db.commit(); db.refresh(v); return v


def _get_or_make_venue(db):
    v = db.query(Venue).filter(Venue.slug == "v").first()
    return v or _venue(db)


def _make(db, when: datetime, status: str = "confirmed"):
    v = _get_or_make_venue(db)
    b = Booking(
        venue_id=v.id, contact_name="A", contact_phone="+39 1",
        contact_email="user@example.com",
        date=when.strftime("%Y-%m-%d"), time=when.strftime("%H:%M"),
        group_size=2, request_type="dinner", status=status,
    )
    db.add(b); db.commit(); db.refresh(b); return b, v


def test_due_window_picks_up_45min_out(db):
    now = datetime(2026, 5, 2, 20, 0)
    b, _ = _make(db, when=now + timedelta(minutes=45), status="confirmed")
    due = reminders.find_due_bookings(db, now=now, lookahead_min=60, window_min=30)
    assert [x.id for x in due] == [b.id]


def test_skips_far_future(db):
    now = datetime(2026, 5, 2, 20, 0)
    _make(db, when=now + timedelta(hours=4), status="confirmed")
    assert reminders.find_due_bookings(db, now=now) == []


def test_skips_past(db):
    now = datetime(2026, 5, 2, 20, 0)
    _make(db, when=now - timedelta(minutes=30), status="confirmed")
    assert reminders.find_due_bookings(db, now=now) == []


def test_skips_rejected_and_cancelled(db):
    now = datetime(2026, 5, 2, 20, 0)
    _make(db, when=now + timedelta(minutes=45), status="rejected")
    _make(db, when=now + timedelta(minutes=45), status="cancelled")
    assert reminders.find_due_bookings(db, now=now) == []


def test_run_due_is_idempotent(db):
    now = datetime(2026, 5, 2, 20, 0)
    b, _ = _make(db, when=now + timedelta(minutes=45))

    out1 = reminders.run_due(db, now=now)
    assert out1["sent_count"] == 1

    out2 = reminders.run_due(db, now=now)
    assert out2["sent_count"] == 0  # already reminded — no double-send

    db.refresh(b)
    assert b.reminder_sent_at is not None


def test_reminder_sends_email_and_sms(db):
    now = datetime(2026, 5, 2, 20, 0)
    _make(db, when=now + timedelta(minutes=45))
    reminders.run_due(db, now=now)
    rows = db.query(NotificationLog).all()
    assert any(r.channel == "email" and "Test Venue" in (r.subject or "") for r in rows)
    assert any(r.channel == "sms" and "1 hour" in (r.body or "") for r in rows)
