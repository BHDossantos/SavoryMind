"""Live table ordering + kitchen display — full flow, routing, tenant isolation."""
from app.models.menu import MenuItem
from app.models.user import User

from .conftest import register_user, auth_headers


def _restaurant(client, db_session, email):
    token, user = register_user(client, email=email, account_type="restaurant")
    row = db_session.query(User).filter(User.id == user["id"]).first()
    row.onboarding_completed = True
    db_session.commit()
    return token, row


def _menu_item(db_session, uid, name, category, price):
    mi = MenuItem(user_id=uid, name=name, category=category, price=price, cost=price * 0.3)
    db_session.add(mi); db_session.commit(); db_session.refresh(mi)
    return mi


def test_create_order_routes_items_to_station_from_category(client, db_session):
    token, owner = _restaurant(client, db_session, "ord1@example.com")
    salad = _menu_item(db_session, owner.id, "Insalata Cesare", "Insalate", 9.0)
    main = _menu_item(db_session, owner.id, "Filetto", "Secondi", 24.0)
    res = client.post("/api/orders", headers=auth_headers(token), json={
        "table_number": 5, "server_name": "Joseph",
        "items": [
            {"menu_item_id": salad.id, "quantity": 2},
            {"menu_item_id": main.id, "quantity": 1, "notes": "ben cotto"},
        ],
    })
    assert res.status_code == 200, res.text
    o = res.json()
    assert o["table_number"] == 5 and o["status"] == "open" and o["item_count"] == 3  # 2 salads + 1 main
    stations = {i["name"]: i["station"] for i in o["items"]}
    assert stations["Insalata Cesare"] == "insalate"   # routed from category
    assert stations["Filetto"] == "secondi"
    assert o["total"] == 2 * 9.0 + 24.0


def test_ad_hoc_item_and_default_station(client, db_session):
    token, owner = _restaurant(client, db_session, "ord2@example.com")
    res = client.post("/api/orders", headers=auth_headers(token), json={
        "table_number": 10, "items": [{"name": "Acqua frizzante", "quantity": 1}],
    })
    assert res.status_code == 200
    assert res.json()["items"][0]["station"] == "cucina"  # no category → default


def test_item_requires_name_or_menu_id(client, db_session):
    token, _ = _restaurant(client, db_session, "ord3@example.com")
    res = client.post("/api/orders", headers=auth_headers(token), json={
        "table_number": 1, "items": [{"quantity": 2}],
    })
    assert res.status_code == 422


def test_submit_then_kitchen_view_grouped_by_station(client, db_session):
    token, owner = _restaurant(client, db_session, "ord4@example.com")
    salad = _menu_item(db_session, owner.id, "Caprese", "Insalate", 8.0)
    main = _menu_item(db_session, owner.id, "Carbonara", "Primi", 14.0)
    oid = client.post("/api/orders", headers=auth_headers(token), json={
        "table_number": 7,
        "items": [{"menu_item_id": salad.id, "quantity": 1}, {"menu_item_id": main.id, "quantity": 1}],
    }).json()["id"]

    # Not in the kitchen until submitted.
    assert client.get("/api/orders/kitchen", headers=auth_headers(token)).json()["total_active"] == 0
    client.post(f"/api/orders/{oid}/submit", headers=auth_headers(token))
    kv = client.get("/api/orders/kitchen", headers=auth_headers(token)).json()
    assert kv["total_active"] == 2
    st = {s["station"] for s in kv["stations"]}
    assert st == {"insalate", "primi"}
    # Each ticket carries its table + an age.
    sample = kv["stations"][0]["items"][0]
    assert sample["table_number"] == 7 and "age_minutes" in sample

    # Station filter.
    only = client.get("/api/orders/kitchen?station=primi", headers=auth_headers(token)).json()
    assert only["total_active"] == 1 and only["stations"][0]["station"] == "primi"


def test_bump_item_statuses_and_order_becomes_served(client, db_session):
    token, owner = _restaurant(client, db_session, "ord5@example.com")
    mi = _menu_item(db_session, owner.id, "Tiramisù", "Dolci", 6.0)
    order = client.post("/api/orders", headers=auth_headers(token), json={
        "table_number": 3, "items": [{"menu_item_id": mi.id, "quantity": 1}],
    }).json()
    client.post(f"/api/orders/{order['id']}/submit", headers=auth_headers(token))
    item_id = order["items"][0]["id"]

    for st in ("preparing", "ready", "served"):
        r = client.post(f"/api/orders/items/{item_id}/status", headers=auth_headers(token), json={"status": st})
        assert r.status_code == 200 and r.json()["status"] == st

    # Order auto-flips to served once its only item is served; kitchen clears it.
    detail = client.get(f"/api/orders/{order['id']}", headers=auth_headers(token)).json()
    assert detail["status"] == "served"
    assert client.get("/api/orders/kitchen", headers=auth_headers(token)).json()["total_active"] == 0


def test_invalid_item_status_rejected(client, db_session):
    token, owner = _restaurant(client, db_session, "ord6@example.com")
    mi = _menu_item(db_session, owner.id, "Pizza", "Pizze", 10.0)
    o = client.post("/api/orders", headers=auth_headers(token), json={
        "table_number": 2, "items": [{"menu_item_id": mi.id}]}).json()
    r = client.post(f"/api/orders/items/{o['items'][0]['id']}/status",
                    headers=auth_headers(token), json={"status": "exploded"})
    assert r.status_code == 422


def test_close_and_list_active(client, db_session):
    token, owner = _restaurant(client, db_session, "ord7@example.com")
    o = client.post("/api/orders", headers=auth_headers(token), json={
        "table_number": 9, "items": [{"name": "Caffè"}]}).json()
    assert any(x["id"] == o["id"] for x in client.get("/api/orders", headers=auth_headers(token)).json()["orders"])
    # An unsubmitted ("open") tab has nothing in the kitchen → it can be abandoned.
    assert client.post(f"/api/orders/{o['id']}/close", headers=auth_headers(token)).status_code == 200
    # Closed orders drop out of the default active list.
    assert not any(x["id"] == o["id"] for x in client.get("/api/orders", headers=auth_headers(token)).json()["orders"])


def test_atomic_create_and_submit(client, db_session):
    # One request creates the order AND sends it to the kitchen (no separate submit).
    token, owner = _restaurant(client, db_session, "ord-atomic@example.com")
    mi = _menu_item(db_session, owner.id, "Risotto", "Primi", 13.0)
    o = client.post("/api/orders", headers=auth_headers(token), json={
        "table_number": 6, "submit": True, "items": [{"menu_item_id": mi.id}]}).json()
    assert o["status"] == "submitted"
    # It shows up in the kitchen immediately, without a submit call.
    assert client.get("/api/orders/kitchen", headers=auth_headers(token)).json()["total_active"] == 1
    # submit=True with no items stays open (nothing to send).
    empty = client.post("/api/orders", headers=auth_headers(token), json={
        "table_number": 8, "submit": True}).json()
    assert empty["status"] == "open"


def test_cannot_close_submitted_order_with_active_items(client, db_session):
    # A tab sent to the kitchen can't be closed while lines are still cooking —
    # that would silently drop live tickets from the KDS.
    token, owner = _restaurant(client, db_session, "ord-close@example.com")
    mi = _menu_item(db_session, owner.id, "Bistecca", "Secondi", 22.0)
    o = client.post("/api/orders", headers=auth_headers(token), json={
        "table_number": 11, "submit": True, "items": [{"menu_item_id": mi.id}]}).json()
    r = client.post(f"/api/orders/{o['id']}/close", headers=auth_headers(token))
    assert r.status_code == 409, r.text
    # Still active in the kitchen.
    assert client.get("/api/orders/kitchen", headers=auth_headers(token)).json()["total_active"] == 1
    # Serve the item → now it closes.
    item_id = o["items"][0]["id"]
    client.post(f"/api/orders/items/{item_id}/status", headers=auth_headers(token), json={"status": "served"})
    assert client.post(f"/api/orders/{o['id']}/close", headers=auth_headers(token)).status_code == 200


def test_item_status_cannot_go_backward(client, db_session):
    # A stale second KDS screen must not drag a served line back to an earlier state.
    token, owner = _restaurant(client, db_session, "ord-mono@example.com")
    mi = _menu_item(db_session, owner.id, "Gelato", "Dolci", 5.0)
    o = client.post("/api/orders", headers=auth_headers(token), json={
        "table_number": 12, "submit": True, "items": [{"menu_item_id": mi.id}]}).json()
    item_id = o["items"][0]["id"]
    hdr = auth_headers(token)
    assert client.post(f"/api/orders/items/{item_id}/status", headers=hdr, json={"status": "ready"}).status_code == 200
    # Backward (ready → preparing) is rejected as a stale write.
    assert client.post(f"/api/orders/items/{item_id}/status", headers=hdr, json={"status": "preparing"}).status_code == 409
    # Forward still works; re-sending the same state is idempotent.
    assert client.post(f"/api/orders/items/{item_id}/status", headers=hdr, json={"status": "ready"}).status_code == 200
    assert client.post(f"/api/orders/items/{item_id}/status", headers=hdr, json={"status": "served"}).status_code == 200
    # A served line can no longer be dragged back.
    assert client.post(f"/api/orders/items/{item_id}/status", headers=hdr, json={"status": "ready"}).status_code == 409


def test_tenant_isolation(client, db_session):
    t1, o1 = _restaurant(client, db_session, "ordA@example.com")
    t2, o2 = _restaurant(client, db_session, "ordB@example.com")
    order = client.post("/api/orders", headers=auth_headers(t1), json={
        "table_number": 4, "items": [{"name": "Vino"}]}).json()
    # Restaurant B cannot read or mutate A's order, nor see it in its kitchen.
    assert client.get(f"/api/orders/{order['id']}", headers=auth_headers(t2)).status_code == 404
    assert client.post(f"/api/orders/{order['id']}/submit", headers=auth_headers(t2)).status_code == 404
    client.post(f"/api/orders/{order['id']}/submit", headers=auth_headers(t1))
    assert client.get("/api/orders/kitchen", headers=auth_headers(t2)).json()["total_active"] == 0


def test_orders_require_restaurant_account(client):
    token, _ = register_user(client, email="ord-consumer@example.com", account_type="consumer")
    assert client.get("/api/orders", headers=auth_headers(token)).status_code == 403
    assert client.get("/api/orders/kitchen", headers=auth_headers(token)).status_code == 403
    assert client.post("/api/orders", headers=auth_headers(token), json={"table_number": 1}).status_code == 403
