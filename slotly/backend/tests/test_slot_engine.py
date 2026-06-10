"""Unit tests for availability_engine: the heart of "available now"."""
from datetime import datetime, time, timedelta

from app.availability_engine import compute_slots, next_slot_for_provider
from app.models import (
    Appointment,
    AppointmentStatus,
    Availability,
    BlockedTime,
    PaymentStatus,
    Provider,
    Role,
    Service,
    User,
)


def _provider_with_hours(session, *, start=time(9), end=time(19)) -> Provider:
    user = User(email="p@test.io", password_hash="x", first_name="P", role=Role.provider)
    session.add(user)
    session.commit()
    provider = Provider(user_id=user.id, display_name="Shop")
    session.add(provider)
    session.commit()
    for d in range(7):
        session.add(Availability(provider_id=provider.id, day_of_week=d, start_time=start, end_time=end))
    session.commit()
    return provider


def _tomorrow(hour, minute=0):
    return datetime.combine(datetime.utcnow().date() + timedelta(days=1), time(hour, minute))


def test_slots_respect_working_hours(session):
    p = _provider_with_hours(session)
    slots = compute_slots(
        session, p.id, 30,
        window_start=_tomorrow(0), window_end=_tomorrow(23, 59), max_slots=500,
    )
    assert slots, "expected open slots"
    assert min(s for s, _ in slots).time() >= time(9)
    assert max(e for _, e in slots).time() <= time(19)


def test_slots_exclude_confirmed_bookings(session):
    p = _provider_with_hours(session)
    session.add(Appointment(
        customer_id=1, provider_id=p.id, service_id=1,
        start_at=_tomorrow(10), end_at=_tomorrow(10, 30),
        status=AppointmentStatus.confirmed, total_price_cents=2500,
    ))
    session.commit()
    slots = compute_slots(
        session, p.id, 30,
        window_start=_tomorrow(9), window_end=_tomorrow(12), max_slots=500,
    )
    starts = [s for s, _ in slots]
    assert _tomorrow(10) not in starts
    assert _tomorrow(10, 15) not in starts  # would overlap 10:00-10:30
    assert _tomorrow(10, 30) in starts      # back-to-back is fine


def test_cancelled_bookings_do_not_block(session):
    p = _provider_with_hours(session)
    session.add(Appointment(
        customer_id=1, provider_id=p.id, service_id=1,
        start_at=_tomorrow(10), end_at=_tomorrow(10, 30),
        status=AppointmentStatus.cancelled_by_customer, total_price_cents=2500,
    ))
    session.commit()
    slots = compute_slots(
        session, p.id, 30,
        window_start=_tomorrow(9), window_end=_tomorrow(12), max_slots=500,
    )
    assert _tomorrow(10) in [s for s, _ in slots]


def test_blocked_time_excluded(session):
    p = _provider_with_hours(session)
    session.add(BlockedTime(
        provider_id=p.id, start_at=_tomorrow(10), end_at=_tomorrow(12), reason="lunch"
    ))
    session.commit()
    slots = compute_slots(
        session, p.id, 30,
        window_start=_tomorrow(9), window_end=_tomorrow(13), max_slots=500,
    )
    starts = [s for s, _ in slots]
    assert _tomorrow(9) in starts
    assert _tomorrow(10) not in starts
    assert _tomorrow(11, 30) not in starts
    assert _tomorrow(12) in starts


def test_fresh_pending_payment_blocks_but_stale_releases(session):
    p = _provider_with_hours(session)
    fresh = Appointment(
        customer_id=1, provider_id=p.id, service_id=1,
        start_at=_tomorrow(10), end_at=_tomorrow(10, 30),
        status=AppointmentStatus.confirmed, total_price_cents=2500,
        payment_status=PaymentStatus.pending,
    )
    stale = Appointment(
        customer_id=1, provider_id=p.id, service_id=1,
        start_at=_tomorrow(14), end_at=_tomorrow(14, 30),
        status=AppointmentStatus.confirmed, total_price_cents=2500,
        payment_status=PaymentStatus.pending,
        created_at=datetime.utcnow() - timedelta(hours=2),  # well past the 15-min TTL
    )
    session.add(fresh)
    session.add(stale)
    session.commit()
    slots = compute_slots(
        session, p.id, 30,
        window_start=_tomorrow(9), window_end=_tomorrow(18), max_slots=500,
    )
    starts = [s for s, _ in slots]
    assert _tomorrow(10) not in starts, "fresh pending payment must hold the slot"
    assert _tomorrow(14) in starts, "stale pending payment must release the slot"


def test_no_availability_means_no_slots(session):
    user = User(email="p2@test.io", password_hash="x", first_name="P", role=Role.provider)
    session.add(user)
    session.commit()
    p = Provider(user_id=user.id, display_name="Closed Shop")
    session.add(p)
    session.commit()
    assert compute_slots(
        session, p.id, 30,
        window_start=_tomorrow(9), window_end=_tomorrow(19),
    ) == []


def test_next_slot_uses_shortest_active_service(session):
    p = _provider_with_hours(session)
    session.add(Service(provider_id=p.id, name="Long", duration_minutes=120, price_cents=9000))
    session.add(Service(provider_id=p.id, name="Short", duration_minutes=15, price_cents=1500))
    session.commit()
    nxt = next_slot_for_provider(session, p.id)
    assert nxt is not None


def test_next_slot_none_without_services(session):
    p = _provider_with_hours(session)
    assert next_slot_for_provider(session, p.id) is None
