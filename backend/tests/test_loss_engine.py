"""Loss Estimate Engine — the money number must be honest and traceable."""
from app.services import loss_engine, sales_import_service

from .conftest import register_user, auth_headers


# ── Pure engine ───────────────────────────────────────────────────────────────

BUSY = {  # a mid-size trattoria
    "covers_per_day": 120,
    "avg_ticket_eur": 35.0,
    "staff_count": 8,
    "monthly_food_purchases_eur": 24000.0,
}

WORST_AUDIT = {q["id"]: list(q["options"].keys())[-1] for q in loss_engine.AUDIT_QUESTIONS}
BEST_AUDIT = {q["id"]: list(q["options"].keys())[0] for q in loss_engine.AUDIT_QUESTIONS}


def test_shape_and_totals_sum():
    r = loss_engine.estimate(BUSY, audit=WORST_AUDIT)
    assert set(r) >= {"total_monthly_loss_low", "total_monthly_loss_high", "breakdown", "data_path"}
    assert r["total_monthly_loss_low"] == round(sum(c["amount_low"] for c in r["breakdown"]), 2)
    assert r["total_monthly_loss_high"] == round(sum(c["amount_high"] for c in r["breakdown"]), 2)
    assert r["total_monthly_loss_high"] >= r["total_monthly_loss_low"]


def test_worse_audit_means_more_loss():
    best = loss_engine.estimate(BUSY, audit=BEST_AUDIT)
    worst = loss_engine.estimate(BUSY, audit=WORST_AUDIT)
    assert worst["total_monthly_loss_high"] > best["total_monthly_loss_high"]


def test_waste_pct_stays_in_industry_band():
    for audit in (BEST_AUDIT, WORST_AUDIT, None):
        r = loss_engine.estimate(BUSY, audit=audit)
        waste = next(c for c in r["breakdown"] if c["category"] == "food_waste")
        ev = waste["evidence"][0]
        assert loss_engine.WASTE_PCT_MIN <= ev["pct_low"] <= ev["pct_high"] <= loss_engine.WASTE_PCT_MAX


def test_every_euro_has_evidence():
    r = loss_engine.estimate(BUSY, audit=WORST_AUDIT)
    for cat in r["breakdown"]:
        assert cat["evidence"], f"{cat['category']} has no evidence"
        assert cat["confidence"] in ("low", "medium", "high")
        assert cat["amount_high"] >= cat["amount_low"] >= 0


def test_profile_only_is_lower_confidence_and_conservative():
    profile_only = loss_engine.estimate(BUSY, audit=None)
    audited = loss_engine.estimate(BUSY, audit=WORST_AUDIT)
    # No audit → every category low confidence.
    assert all(c["confidence"] == "low" for c in profile_only["breakdown"])
    # And never claims more than the worst audited case.
    assert profile_only["total_monthly_loss_high"] <= audited["total_monthly_loss_high"]


def test_missing_purchases_estimated_from_revenue():
    p = dict(BUSY); p.pop("monthly_food_purchases_eur")
    r = loss_engine.estimate(p, audit=WORST_AUDIT)
    waste = next(c for c in r["breakdown"] if c["category"] == "food_waste")
    assert waste["evidence"][0]["purchases_estimated"] is True
    assert waste["amount_high"] > 0


def test_empty_profile_produces_no_fake_number():
    r = loss_engine.estimate({}, audit=None)
    assert r["total_monthly_loss_high"] == 0.0
    assert r["breakdown"] == []


def test_staff_category_scales_with_wage():
    cheap = loss_engine.estimate({"staff_count": 5, "avg_hourly_wage_eur": 8}, audit=WORST_AUDIT)
    pricey = loss_engine.estimate({"staff_count": 5, "avg_hourly_wage_eur": 20}, audit=WORST_AUDIT)
    cs = next(c for c in cheap["breakdown"] if c["category"] == "staff_time")
    ps = next(c for c in pricey["breakdown"] if c["category"] == "staff_time")
    assert ps["amount_high"] > cs["amount_high"]


# ── Importer ──────────────────────────────────────────────────────────────────

def test_import_semicolon_italian_decimals():
    csv = (
        "Data;Prodotto;Quantita;Totale\n"
        "01/06/2026;Carbonara;3;42,00\n"
        "01/06/2026;Tiramisu;2;15,00\n"
        "02/06/2026;Carbonara;1;14,00\n"
    ).encode("utf-8")
    r = sales_import_service.parse(csv)
    assert r["rows_imported"] == 3
    assert r["summary"]["total_revenue"] == 71.0
    assert r["summary"]["day_span"] == 2
    # 71 over 2 days → ~1065/month
    assert r["summary"]["monthly_revenue"] == round(71.0 / 2 * 30, 2)
    top = r["summary"]["top_items"][0]
    assert top["item"] == "Carbonara" and top["units"] == 4


def test_import_english_comma_thousands():
    csv = (
        "date,item,qty,revenue\n"
        "2026-06-01,Steak,1,\"1,234.56\"\n"
    ).encode("utf-8")
    r = sales_import_service.parse(csv)
    assert r["rows_imported"] == 1
    assert r["summary"]["total_revenue"] == 1234.56


def test_import_quarantines_bad_rows_without_aborting():
    csv = (
        "date,item,qty,revenue\n"
        "2026-06-01,Good,1,10\n"
        "2026-06-01,,2,20\n"          # missing item → quarantined
        "2026-06-02,AlsoGood,1,5\n"
    ).encode("utf-8")
    r = sales_import_service.parse(csv)
    assert r["rows_imported"] == 2
    assert r["rows_quarantined"] == 1


def test_import_unreadable_file_reports_reason():
    r = sales_import_service.parse(b"just some prose with no columns")
    assert r["rows_imported"] == 0
    assert r["quarantine"]


def test_import_latin1_encoding():
    csv = "date,item,qty,revenue\n2026-06-01,Caff\xe8,2,3\n".encode("latin-1")
    r = sales_import_service.parse(csv)
    assert r["rows_imported"] == 1


# ── Endpoints + guarantee + versioning ───────────────────────────────────────

def _onboard(client, db_session, email, **fields):
    from app.models.user import User
    token, user = register_user(client, email=email, account_type="restaurant")
    row = db_session.query(User).filter(User.id == user["id"]).first()
    row.onboarding_completed = True
    for k, v in fields.items():
        setattr(row, k, v)
    db_session.commit()
    return token, user["id"]


def test_estimate_endpoint_persists_and_reveals(client, db_session):
    token, _ = _onboard(client, db_session, "loss1@example.com", **BUSY)
    res = client.post("/api/loss/estimate", headers=auth_headers(token),
                      json={"audit": WORST_AUDIT})
    assert res.status_code == 200
    body = res.json()
    assert body["version"] == 1
    assert body["total_monthly_loss_high"] > 0
    assert body["data_path"] == "audit"
    # latest reflects it
    latest = client.get("/api/loss/latest", headers=auth_headers(token)).json()
    assert latest["id"] == body["id"]


def test_estimate_versions_increment(client, db_session):
    token, _ = _onboard(client, db_session, "loss2@example.com", **BUSY)
    client.post("/api/loss/estimate", headers=auth_headers(token), json={})
    second = client.post("/api/loss/estimate", headers=auth_headers(token),
                         json={"audit": WORST_AUDIT}).json()
    assert second["version"] == 2


def test_guarantee_triggers_for_efficient_kitchen(client, db_session):
    # Tiny, disciplined kitchen → high estimate under €500.
    token, _ = _onboard(client, db_session, "loss3@example.com",
                        covers_per_day=15, avg_ticket_eur=12.0, staff_count=1,
                        monthly_food_purchases_eur=1500.0)
    body = client.post("/api/loss/estimate", headers=auth_headers(token),
                       json={"audit": BEST_AUDIT}).json()
    assert body["total_monthly_loss_high"] < 500
    assert body["guarantee_triggered"] is True


def test_guarantee_not_triggered_for_lossy_kitchen(client, db_session):
    token, _ = _onboard(client, db_session, "loss4@example.com", **BUSY)
    body = client.post("/api/loss/estimate", headers=auth_headers(token),
                       json={"audit": WORST_AUDIT}).json()
    assert body["total_monthly_loss_high"] >= 500
    assert body["guarantee_triggered"] is False


def test_import_endpoint_end_to_end(client, db_session):
    token, _ = _onboard(client, db_session, "loss5@example.com", staff_count=8)
    csv = ("date,item,qty,revenue\n" +
           "\n".join(f"2026-06-0{d},Dish{d},2,{200+d}" for d in range(1, 6))).encode()
    res = client.post("/api/loss/import", headers=auth_headers(token),
                      files={"file": ("sales.csv", csv, "text/csv")})
    assert res.status_code == 200
    body = res.json()
    assert body["import"]["rows_imported"] == 5
    assert body["estimate"]["data_path"] == "import"


def test_import_unreadable_returns_no_estimate(client, db_session):
    token, _ = _onboard(client, db_session, "loss6@example.com")
    res = client.post("/api/loss/import", headers=auth_headers(token),
                      files={"file": ("x.csv", b"garbage no columns here", "text/csv")})
    assert res.status_code == 200
    assert res.json()["estimate"] is None


def test_loss_endpoints_require_restaurant(client):
    token, _ = register_user(client, email="consumer-loss@example.com", account_type="consumer")
    assert client.post("/api/loss/estimate", headers=auth_headers(token), json={}).status_code == 403
    assert client.get("/api/loss/latest", headers=auth_headers(token)).status_code == 403


def test_audit_questions_endpoint(client):
    token, _ = register_user(client, email="aq@example.com", account_type="restaurant")
    res = client.get("/api/loss/audit-questions", headers=auth_headers(token))
    assert res.status_code == 200
    assert len(res.json()["questions"]) == 12


def test_public_estimate_no_auth_matches_engine(client):
    # The public calculator (lead magnet) needs no account and returns the
    # same shape/number as onboarding for identical inputs.
    body = {"covers_per_day": 120, "avg_ticket_eur": 35.0, "staff_count": 8,
            "monthly_food_purchases_eur": 24000.0, "audit": WORST_AUDIT}
    res = client.post("/api/loss/public-estimate", json=body)
    assert res.status_code == 200
    data = res.json()
    assert data["total_monthly_loss_high"] > 0
    engine = loss_engine.estimate(
        {"covers_per_day": 120, "avg_ticket_eur": 35.0, "staff_count": 8,
         "monthly_food_purchases_eur": 24000.0}, audit=WORST_AUDIT)
    assert data["total_monthly_loss_high"] == engine["total_monthly_loss_high"]


def test_public_estimate_empty_is_honest_zero(client):
    res = client.post("/api/loss/public-estimate", json={})
    assert res.status_code == 200
    assert res.json()["total_monthly_loss_high"] == 0.0
