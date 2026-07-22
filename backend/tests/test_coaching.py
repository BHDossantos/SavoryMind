"""Staff coaching engine v2 — incidents, plan generation, approval, recovered €.

The LLM path is unconfigured in tests, so the deterministic rules fallback
runs — which lets us assert the hard rules: every € traces to incidents,
plans always validate, and multilingual output works.
"""
from datetime import date, timedelta

from app.models.restaurant_ext import Staff, CoachingPlan
from app.models.user import User
from app.services import coaching_generator, coaching_service

from .conftest import register_user, auth_headers


def _restaurant(client, db_session, email):
    token, user = register_user(client, email=email, account_type="restaurant")
    row = db_session.query(User).filter(User.id == user["id"]).first()
    row.onboarding_completed = True
    db_session.commit()
    return token, row


def _staff(db_session, owner_id, name="Carlos Mendes", role="chef", language=None):
    s = Staff(user_id=owner_id, name=name, role=role, shift="evening", language=language)
    db_session.add(s); db_session.commit(); db_session.refresh(s)
    return s


# ── Generator (pure) ──────────────────────────────────────────────────────────

def test_generator_uses_only_real_numbers():
    incidents = [
        {"type": "waste", "euro_impact": 20.0, "quantity": 1.2, "cause_tags": ["over_portioning"]},
        {"type": "waste", "euro_impact": 16.9, "quantity": 0.5, "cause_tags": ["cooking_error"]},
    ]
    plan = coaching_generator.generate(
        staff={"name": "Carlos", "role": "chef"}, incidents=incidents,
        restaurant={"cuisine": "Italian", "seating_capacity": 40}, language="it")
    assert plan["euro_impact_total"] == 36.9
    # Recovery is conservative — never exceeds the real loss.
    assert plan["expected_recovery"] <= plan["euro_impact_total"]
    assert 3 <= len(plan["actions"]) <= 5
    assert plan["generated_by_model"] is False  # no API key in tests


def test_generator_multilingual():
    incidents = [{"type": "waste", "euro_impact": 50.0, "cause_tags": []}]
    it = coaching_generator.generate(staff={"name": "Marco", "role": "chef"},
                                     incidents=incidents, restaurant={}, language="it")
    en = coaching_generator.generate(staff={"name": "Marco", "role": "chef"},
                                     incidents=incidents, restaurant={}, language="en")
    es = coaching_generator.generate(staff={"name": "Marco", "role": "chef"},
                                     incidents=incidents, restaurant={}, language="es")
    assert "Piano di recupero" in it["title"]
    assert "Recovery plan" in en["title"]
    assert "Plan de recuperación" in es["title"]


def test_generator_clean_record_is_low_priority():
    plan = coaching_generator.generate(staff={"name": "Ana", "role": "server"},
                                       incidents=[{"type": "waste", "euro_impact": 1.0}],
                                       restaurant={}, language="en")
    assert plan["priority"] == "low"
    assert plan["expected_recovery"] == 0.0


def test_generator_priority_scales_with_loss():
    big = coaching_generator.generate(staff={"name": "X", "role": "chef"},
                                      incidents=[{"type": "waste", "euro_impact": 250.0}],
                                      restaurant={}, language="en")
    assert big["priority"] == "high"


# ── Incidents + quick-log endpoint ───────────────────────────────────────────

def test_quick_log_incident(client, db_session):
    token, owner = _restaurant(client, db_session, "coach1@example.com")
    staff = _staff(db_session, owner.id)
    res = client.post("/api/coaching/incidents", headers=auth_headers(token), json={
        "staff_id": staff.id, "type": "waste", "euro_impact": 36.9,
        "quantity": 1.7, "unit": "kg", "cause_tags": ["over_portioning"],
    })
    assert res.status_code == 201
    assert res.json()["euro_impact"] == 36.9
    assert res.json()["cause_tags"] == ["over_portioning"]


def test_incident_rejects_bad_type(client, db_session):
    token, owner = _restaurant(client, db_session, "coach2@example.com")
    staff = _staff(db_session, owner.id)
    res = client.post("/api/coaching/incidents", headers=auth_headers(token),
                      json={"staff_id": staff.id, "type": "nonsense", "euro_impact": 5})
    assert res.status_code == 400


def test_incident_rejects_foreign_staff(client, db_session):
    token, owner = _restaurant(client, db_session, "coach3@example.com")
    _, other = _restaurant(client, db_session, "coach3b@example.com")
    foreign = _staff(db_session, other.id)
    res = client.post("/api/coaching/incidents", headers=auth_headers(token),
                      json={"staff_id": foreign.id, "type": "waste", "euro_impact": 5})
    assert res.status_code == 400


# ── Plan generation + approval ───────────────────────────────────────────────

def test_generate_and_approve_plan(client, db_session):
    token, owner = _restaurant(client, db_session, "coach4@example.com")
    staff = _staff(db_session, owner.id, language="it")
    for _ in range(3):
        coaching_service.log_incident(db_session, owner.id, staff_id=staff.id,
                                      type="waste", euro_impact=20.0)
    gen = client.post("/api/coaching/plans/generate", headers=auth_headers(token)).json()
    assert len(gen["plans"]) == 1
    plan = gen["plans"][0]
    assert plan["euro_impact_total"] == 60.0
    assert plan["status"] == "draft"
    assert plan["language"] == "it"

    ap = client.post(f"/api/coaching/plans/{plan['id']}/approve", headers=auth_headers(token))
    assert ap.status_code == 200
    assert ap.json()["status"] == "active"
    assert ap.json()["reviewed_by_owner"] is True


def test_no_incidents_no_plan(client, db_session):
    token, owner = _restaurant(client, db_session, "coach5@example.com")
    _staff(db_session, owner.id)
    gen = client.post("/api/coaching/plans/generate", headers=auth_headers(token)).json()
    assert gen["plans"] == []


def test_bulk_approve(client, db_session):
    token, owner = _restaurant(client, db_session, "coach6@example.com")
    for n in range(3):
        s = _staff(db_session, owner.id, name=f"S{n}")
        coaching_service.log_incident(db_session, owner.id, staff_id=s.id,
                                      type="waste", euro_impact=30.0)
    client.post("/api/coaching/plans/generate", headers=auth_headers(token))
    res = client.post("/api/coaching/plans/approve-all", headers=auth_headers(token))
    assert res.json()["approved"] == 3
    active = client.get("/api/coaching/plans?status=active", headers=auth_headers(token)).json()
    assert len(active["plans"]) == 3


def test_regenerate_replaces_draft_not_duplicate(client, db_session):
    token, owner = _restaurant(client, db_session, "coach7@example.com")
    staff = _staff(db_session, owner.id)
    coaching_service.log_incident(db_session, owner.id, staff_id=staff.id,
                                  type="waste", euro_impact=10.0)
    client.post("/api/coaching/plans/generate", headers=auth_headers(token))
    client.post("/api/coaching/plans/generate", headers=auth_headers(token))
    n = db_session.query(CoachingPlan).filter(CoachingPlan.staff_id == staff.id).count()
    assert n == 1  # regeneration replaced the draft, didn't stack


# ── Recovered-€ counter ──────────────────────────────────────────────────────

def test_recovered_counter_rewards_improvement(client, db_session):
    token, owner = _restaurant(client, db_session, "coach8@example.com")
    staff = _staff(db_session, owner.id)
    today = date.today()
    prev_month_day = today.replace(day=1) - timedelta(days=5)
    # Prior month: €100 lost. This month: €30 lost → €70 recovered.
    coaching_service.log_incident(db_session, owner.id, staff_id=staff.id,
                                  type="waste", euro_impact=100.0, occurred_at=prev_month_day)
    coaching_service.log_incident(db_session, owner.id, staff_id=staff.id,
                                  type="waste", euro_impact=30.0, occurred_at=today)
    res = client.get("/api/coaching/recovered", headers=auth_headers(token)).json()
    assert res["recovered_this_month"] == 70.0


def test_recovered_never_negative(client, db_session):
    token, owner = _restaurant(client, db_session, "coach9@example.com")
    staff = _staff(db_session, owner.id)
    today = date.today()
    prev = today.replace(day=1) - timedelta(days=5)
    # Losses grew — recovered must clamp to 0, never negative.
    coaching_service.log_incident(db_session, owner.id, staff_id=staff.id,
                                  type="waste", euro_impact=10.0, occurred_at=prev)
    coaching_service.log_incident(db_session, owner.id, staff_id=staff.id,
                                  type="waste", euro_impact=90.0, occurred_at=today)
    res = client.get("/api/coaching/recovered", headers=auth_headers(token)).json()
    assert res["recovered_this_month"] == 0.0


# ── WhatsApp consent (GDPR) ──────────────────────────────────────────────────

def test_whatsapp_consent_records_timestamp(client, db_session):
    token, owner = _restaurant(client, db_session, "coach10@example.com")
    staff = _staff(db_session, owner.id)
    res = client.post(f"/api/coaching/staff/{staff.id}/whatsapp",
                      headers=auth_headers(token), json={"whatsapp_number": "+393331234567"})
    assert res.json()["consented"] is True
    # Opt-out clears both.
    res = client.post(f"/api/coaching/staff/{staff.id}/whatsapp",
                      headers=auth_headers(token), json={"whatsapp_number": ""})
    assert res.json()["consented"] is False
    assert res.json()["whatsapp_number"] is None


def test_coaching_requires_restaurant(client):
    token, _ = register_user(client, email="coach-consumer@example.com", account_type="consumer")
    assert client.get("/api/coaching/recovered", headers=auth_headers(token)).status_code == 403
