"""Employee QR-survey end-to-end tests.

Covers:
  - Owner creates an employee → qr_token comes back in the response.
  - Public GET /employee-survey/{qr_token} returns the survey + names.
  - POST submit happy path stores a row.
  - Validation: missing required, out-of-range rating, bad boolean.
  - Owner can list employees + tokens, view aggregated results.
  - Cross-tenant: owner B can't read owner A's employee results.
  - Lazy backfill: an existing staff row without qr_token gets one on
    the first owner list call.
"""
from .conftest import register_user, auth_headers


def _create_owner_and_employee(client):
    """Returns (owner_access, employee_id, qr_token, employee_email)."""
    owner_access, _ = register_user(client, email="owner@x.com", account_type="restaurant")
    r = client.post(
        "/api/staff/employees",
        headers=auth_headers(owner_access),
        json={
            "display_name": "Jane Server",
            "email": "jane@x.com",
            "password": "password123",
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["qr_token"], "create_employee should return a qr_token"
    return owner_access, body["id"], body["qr_token"], body["email"]


# ── Public survey fetch ──────────────────────────────────────────────────────

def test_create_employee_returns_qr_token(client):
    _create_owner_and_employee(client)


def test_public_survey_lookup_returns_definition_and_names(client):
    _, emp_id, qr_token, _ = _create_owner_and_employee(client)
    r = client.get(f"/api/employee-survey/{qr_token}")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["employee"]["id"] == emp_id
    assert body["employee"]["display_name"] == "Jane Server"
    assert body["restaurant"]["id"]
    questions = body["survey"]["questions"]
    qids = [q["id"] for q in questions]
    assert "overall_experience" in qids
    assert "employee_service" in qids
    assert "would_return" in qids


def test_invalid_qr_token_returns_404(client):
    register_user(client)
    r = client.get("/api/employee-survey/not-a-real-token")
    assert r.status_code == 404


# ── Submission happy path + validation ──────────────────────────────────────

def _valid_payload(device_id="dev-abc-123"):
    return {
        "device_id": device_id,
        "answers": {
            "overall_experience": 5,
            "employee_service": 4,
            "employee_attentive": 5,
            "employee_knowledgeable": 4,
            "would_return": True,
            "comment": "Lovely evening, thanks!",
        },
    }


def test_submit_survey_persists_and_returns_id(client):
    _, _, qr_token, _ = _create_owner_and_employee(client)
    r = client.post(f"/api/employee-survey/{qr_token}/submit", json=_valid_payload())
    assert r.status_code == 201, r.text
    assert r.json()["id"] > 0


def test_submit_survey_missing_required_field_rejected(client):
    _, _, qr_token, _ = _create_owner_and_employee(client)
    payload = _valid_payload()
    del payload["answers"]["overall_experience"]
    r = client.post(f"/api/employee-survey/{qr_token}/submit", json=payload)
    assert r.status_code == 422
    assert "overall_experience" in r.json()["detail"]


def test_submit_survey_rating_out_of_range_rejected(client):
    _, _, qr_token, _ = _create_owner_and_employee(client)
    payload = _valid_payload()
    payload["answers"]["employee_service"] = 9
    r = client.post(f"/api/employee-survey/{qr_token}/submit", json=payload)
    assert r.status_code == 422


def test_submit_survey_accepts_string_boolean_for_yes_no(client):
    """Mobile form submits "yes" / "no" strings — the service coerces them."""
    _, _, qr_token, _ = _create_owner_and_employee(client)
    payload = _valid_payload()
    payload["answers"]["would_return"] = "no"
    r = client.post(f"/api/employee-survey/{qr_token}/submit", json=payload)
    assert r.status_code == 201


def test_submit_survey_invalid_qr_token_404(client):
    register_user(client)
    r = client.post("/api/employee-survey/bogus/submit", json=_valid_payload())
    assert r.status_code == 404


# ── Owner-side endpoints ────────────────────────────────────────────────────

def test_owner_can_list_employees_with_qr_tokens(client):
    owner_access, emp_id, qr_token, _ = _create_owner_and_employee(client)
    r = client.get(
        "/api/employee-survey/owner/employees",
        headers=auth_headers(owner_access),
    )
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 1
    assert rows[0]["id"] == emp_id
    assert rows[0]["qr_token"] == qr_token


def test_owner_results_aggregates_responses(client):
    owner_access, emp_id, qr_token, _ = _create_owner_and_employee(client)
    # Submit 3 responses with varied ratings to exercise the average.
    for rating in (5, 4, 3):
        payload = _valid_payload(device_id=f"dev-{rating}")
        payload["answers"]["overall_experience"] = rating
        payload["answers"]["would_return"] = (rating >= 4)
        r = client.post(f"/api/employee-survey/{qr_token}/submit", json=payload)
        assert r.status_code == 201

    r = client.get(
        f"/api/employee-survey/owner/employees/{emp_id}/results",
        headers=auth_headers(owner_access),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["stats"]["total_responses"] == 3
    assert body["stats"]["unique_devices"] == 3
    assert body["stats"]["ratings"]["overall_experience"]["count"] == 3
    assert body["stats"]["ratings"]["overall_experience"]["average"] == 4.0
    assert body["stats"]["booleans"]["would_return"]["yes_count"] == 2
    assert body["stats"]["booleans"]["would_return"]["no_count"] == 1
    # Free-text comments surfaced.
    assert any("Lovely evening" in c["text"] for c in body["stats"]["comments"])


def test_owner_cannot_read_another_owners_employee_results(client):
    # Owner A creates an employee.
    _, emp_id, _, _ = _create_owner_and_employee(client)
    # Owner B (different restaurant) tries to read it.
    other_access, _ = register_user(client, email="other-owner@x.com", account_type="restaurant")
    r = client.get(
        f"/api/employee-survey/owner/employees/{emp_id}/results",
        headers=auth_headers(other_access),
    )
    assert r.status_code == 404, "cross-tenant read must 404, not leak existence"


def test_consumer_account_blocked_from_owner_endpoints(client):
    consumer_access, _ = register_user(client)  # default account_type=consumer
    r = client.get(
        "/api/employee-survey/owner/employees",
        headers=auth_headers(consumer_access),
    )
    assert r.status_code == 403


def test_lazy_qr_token_backfill_via_owner_list(client):
    """A staff row that pre-dates the qr_token column should pick up a
    token the first time the owner views the employee list."""
    owner_access, _ = register_user(client, email="owner@x.com", account_type="restaurant")
    # Create an employee through the API (it gets a token), then nuke the
    # token to simulate a pre-existing row.
    from app.core.database import SessionLocal
    from app.models.user import User as UserModel

    r = client.post(
        "/api/staff/employees",
        headers=auth_headers(owner_access),
        json={"display_name": "Old Staff", "email": "old@x.com", "password": "password123"},
    )
    assert r.status_code == 201
    emp_id = r.json()["id"]

    db = SessionLocal()
    try:
        u = db.query(UserModel).filter(UserModel.id == emp_id).first()
        u.qr_token = None
        db.commit()
    finally:
        db.close()

    r2 = client.get(
        "/api/employee-survey/owner/employees",
        headers=auth_headers(owner_access),
    )
    assert r2.status_code == 200
    rows = r2.json()
    [row] = [r for r in rows if r["id"] == emp_id]
    assert row["qr_token"], "ensure_qr_token should have lazy-set a token"
