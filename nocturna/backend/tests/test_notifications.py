from app.models import Booking, NotificationLog, User, Venue
from app.services import notifications


def _hours():
    return {d: [{"open": "00:00", "close": "23:59"}] for d in ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]}


def _venue(db, dress="elegant"):
    v = Venue(slug="v", name="Test Venue", type="restaurant", address="X",
              lat=41.9, lng=12.5, neighborhood="Centro", city="rome", country="IT",
              opening_hours=_hours(), avg_price_eur=60, price_level=2, dress_code=dress,
              music_types=[], crowd_types=[], vibe_tags=[], cuisine_tags=[],
              contact={}, photos=[], best_nights=[], active=True, quality_score=0.9)
    db.add(v); db.commit(); db.refresh(v); return v


def _booking(db, venue, status="confirmed"):
    b = Booking(venue_id=venue.id, contact_name="A", contact_phone="+39 1",
                contact_email="user@example.com", date="2026-05-02", time="21:00",
                group_size=2, request_type="dinner", status=status,
                venue_response="See you at 21:00")
    db.add(b); db.commit(); db.refresh(b); return b


def test_booking_received_uses_template(db):
    v = _venue(db)
    b = _booking(db, v, status="new")
    notifications.notify_booking_received(
        db, b, v, user_email="user@example.com", user_phone="+39 1",
        whatsapp=None, expo_token=None,
    )
    emails = db.query(NotificationLog).filter_by(channel="email").all()
    assert any("we received your booking at Test Venue" in (e.subject or "") for e in emails)
    sms = db.query(NotificationLog).filter_by(channel="sms").all()
    assert any("Booking ref: #" in (e.body or "") for e in sms)


def test_status_change_confirmed_emails(db):
    v = _venue(db)
    b = _booking(db, v, status="confirmed")
    notifications.notify_booking_status_change(
        db, b, v, user_email="user@example.com", user_phone="+39 1",
    )
    emails = db.query(NotificationLog).filter_by(channel="email").all()
    assert any("confirmed at Test Venue" in (e.subject or "") for e in emails)
    assert any("Dress code: elegant" in (e.body or "") for e in emails)


def test_status_change_rejected_includes_reason(db):
    v = _venue(db)
    b = _booking(db, v, status="rejected")
    b.venue_response = "fully booked tonight"
    notifications.notify_booking_status_change(
        db, b, v, user_email="user@example.com", user_phone=None,
    )
    emails = db.query(NotificationLog).filter_by(channel="email").all()
    assert any("fully booked tonight" in (e.body or "") for e in emails)


def test_unknown_status_change_is_noop(db):
    v = _venue(db)
    b = _booking(db, v, status="pending")
    notifications.notify_booking_status_change(
        db, b, v, user_email="user@example.com", user_phone=None,
    )
    assert db.query(NotificationLog).count() == 0
