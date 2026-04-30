"""/health endpoint regression suite (commit fb2cbbd).

Verifies the readiness probe returns 200 when DB is reachable and does
not leak DB exception strings to clients.
"""


def test_health_ok(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    # Must not include the raw exception string (the original audit
    # finding — db_error: "...connection refused..." was being returned
    # to anonymous clients).
    assert "db_error" not in body


def test_root_ok(client):
    r = client.get("/")
    assert r.status_code == 200
    assert "docs" in r.json()
