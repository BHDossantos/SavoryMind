"""Public calculator lead capture — turns funnel traffic into a prospect."""
from app.models.marketing import MarketingLead


def test_capture_lead_stores_row(client, db_session):
    res = client.post("/api/loss/lead", json={
        "email": "  Chef@Trattoria.IT ",
        "restaurant_name": "Trattoria Bella",
        "covers_per_day": 80, "avg_ticket_eur": 28,
        "staff_count": 6, "monthly_food_purchases_eur": 12000,
        "band_low": 640, "band_high": 1600,
    })
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True and body["id"]
    lead = db_session.query(MarketingLead).filter(MarketingLead.id == body["id"]).first()
    assert lead is not None
    assert lead.email == "chef@trattoria.it"          # normalized (trim + lowercase)
    assert lead.restaurant_name == "Trattoria Bella"
    assert lead.source == "calcolatore"
    assert lead.band_high == 1600
    assert lead.profile["covers_per_day"] == 80


def test_capture_lead_rejects_invalid_email(client):
    for bad in ["", "nope", "a@b", "@x.com", "x@", "x@y", "x@.com", "x@y."]:
        res = client.post("/api/loss/lead", json={"email": bad})
        assert res.status_code == 422, bad


def test_capture_lead_is_public_no_auth(client, db_session):
    # No Authorization header — anonymous visitor must be able to submit.
    before = db_session.query(MarketingLead).count()
    res = client.post("/api/loss/lead", json={"email": "diner@example.com"})
    assert res.status_code == 200
    assert db_session.query(MarketingLead).count() == before + 1


def test_capture_lead_custom_source_truncated(client, db_session):
    res = client.post("/api/loss/lead", json={"email": "a@b.com", "source": "x" * 100})
    assert res.status_code == 200
    lead = db_session.query(MarketingLead).filter(MarketingLead.id == res.json()["id"]).first()
    assert len(lead.source) <= 40
