"""Tests for Flavor's tool layer (Phase 7-10).

Covers the 38 tools, role gating, the dispatcher's cross-role guard,
and the memory layer's de-dup + eviction. Tools are tested directly
(UserContext in, dict out) rather than through the chat endpoint —
the multi-turn Claude loop is tested separately in
test_assistant_service.py with a mocked client.

The `client` fixture is still used: it runs the Alembic migrations on
lifespan startup so flavor_memories / reviews.response exist. We then
talk to the DB directly via db_session.
"""
import datetime

import pytest

from tests.conftest import register_user


# ── Helpers ────────────────────────────────────────────────────────────────

def _ctx(db_session, user_id, account_type="consumer"):
    """Build a UserContext for direct tool calls."""
    from app.services.flavor_tools import UserContext
    return UserContext(user_id=user_id, account_type=account_type, language="en", db=db_session)


def _make_user(client, db_session, email, account_type="consumer"):
    """Register a user via the API (so demo-seed + schema are real) and
    return their id."""
    _, user = register_user(client, email=email, account_type=account_type)
    return user["id"]


# ── Catalog search tools ──────────────────────────────────────────────────

def test_search_wines_returns_shape(client, db_session):
    from app.services import flavor_tools as ft
    uid = _make_user(client, db_session, "wine@example.com")
    ctx = _ctx(db_session, uid)
    out = ft.tool_search_wines(ctx, query="")
    assert "count" in out and "wines" in out
    assert out["count"] == len(out["wines"])
    assert out["count"] >= 1
    # Every wine carries its slug + the catalog fields.
    w = out["wines"][0]
    assert "slug" in w and "name" in w and "style" in w


def test_search_wines_query_filters(client, db_session):
    from app.services import flavor_tools as ft
    uid = _make_user(client, db_session, "wine2@example.com")
    ctx = _ctx(db_session, uid)
    # The seed catalog has Cabernet Sauvignon.
    out = ft.tool_search_wines(ctx, query="cabernet")
    assert out["count"] >= 1
    assert all("cabernet" in (w["name"] + w["style"] + w["flavor_profile"]).lower()
               for w in out["wines"])


def test_search_beers_abv_range(client, db_session):
    from app.services import flavor_tools as ft
    uid = _make_user(client, db_session, "beer@example.com")
    ctx = _ctx(db_session, uid)
    out = ft.tool_search_beers(ctx, min_abv=0, max_abv=4.5)
    assert all(b["abv"] <= 4.5 for b in out["beers"])


def test_search_spirits_returns_shape(client, db_session):
    from app.services import flavor_tools as ft
    uid = _make_user(client, db_session, "spirit@example.com")
    ctx = _ctx(db_session, uid)
    out = ft.tool_search_spirits(ctx, query="")
    assert out["count"] == len(out["spirits"])
    assert out["count"] >= 1


# ── Pairing tools ──────────────────────────────────────────────────────────

def test_get_wine_pairing_returns_pairings(client, db_session):
    from app.services import flavor_tools as ft
    uid = _make_user(client, db_session, "pair@example.com")
    ctx = _ctx(db_session, uid)
    out = ft.tool_get_wine_pairing(ctx, dish="grilled ribeye steak")
    assert out["dish"] == "grilled ribeye steak"
    assert isinstance(out["pairings"], list)


def test_get_wine_pairing_rejects_blank(client, db_session):
    from app.services import flavor_tools as ft
    uid = _make_user(client, db_session, "pair2@example.com")
    ctx = _ctx(db_session, uid)
    out = ft.tool_get_wine_pairing(ctx, dish="   ")
    assert "error" in out


# ── Recipe tools ───────────────────────────────────────────────────────────

def test_search_recipes_cuisine_hard_filter(client, db_session):
    from app.services import flavor_tools as ft
    uid = _make_user(client, db_session, "recipe@example.com")
    ctx = _ctx(db_session, uid)
    out = ft.tool_search_recipes(ctx, cuisine="French")
    # Hard filter — every result must be French.
    assert all("french" in r["cuisine"].lower() for r in out["recipes"])


def test_get_recipe_not_found(client, db_session):
    from app.services import flavor_tools as ft
    uid = _make_user(client, db_session, "recipe2@example.com")
    ctx = _ctx(db_session, uid)
    out = ft.tool_get_recipe(ctx, recipe_id=999999)
    assert "error" in out


# ── Pantry tools (read + write) ────────────────────────────────────────────

def test_add_then_get_pantry(client, db_session):
    from app.services import flavor_tools as ft
    uid = _make_user(client, db_session, "pantry@example.com")
    ctx = _ctx(db_session, uid)

    add = ft.tool_add_to_pantry(ctx, ingredient="free-range eggs", quantity="12", category="dairy")
    assert add["ok"] is True

    got = ft.tool_get_pantry(ctx)
    assert any(i["ingredient"] == "free-range eggs" for i in got["items"])


def test_add_to_pantry_rejects_blank(client, db_session):
    from app.services import flavor_tools as ft
    uid = _make_user(client, db_session, "pantry2@example.com")
    ctx = _ctx(db_session, uid)
    out = ft.tool_add_to_pantry(ctx, ingredient="   ")
    assert "error" in out


def test_remove_from_pantry(client, db_session):
    from app.services import flavor_tools as ft
    uid = _make_user(client, db_session, "pantry3@example.com")
    ctx = _ctx(db_session, uid)
    ft.tool_add_to_pantry(ctx, ingredient="saffron")
    rm = ft.tool_remove_from_pantry(ctx, ingredient="saffron")
    assert rm["ok"] is True
    assert not any(i["ingredient"] == "saffron" for i in ft.tool_get_pantry(ctx)["items"])


def test_remove_from_pantry_missing(client, db_session):
    from app.services import flavor_tools as ft
    uid = _make_user(client, db_session, "pantry4@example.com")
    ctx = _ctx(db_session, uid)
    out = ft.tool_remove_from_pantry(ctx, ingredient="unobtainium")
    assert out["ok"] is False


def test_add_pantry_bulk(client, db_session):
    from app.services import flavor_tools as ft
    uid = _make_user(client, db_session, "bulk@example.com")
    ctx = _ctx(db_session, uid)
    out = ft.tool_add_pantry_bulk(ctx, items=[
        {"ingredient": "flour", "quantity": "1 kg"},
        {"ingredient": "sugar"},
        "olive oil",                       # plain string form
        {"ingredient": "   "},             # blank — should be skipped
        {"not_an_ingredient": "x"},        # malformed — skipped
    ])
    assert out["ok"] is True
    assert set(out["added"]) == {"flour", "sugar", "olive oil"}
    assert out["added_count"] == 3
    assert len(out["skipped"]) == 2


def test_add_pantry_bulk_rejects_empty(client, db_session):
    from app.services import flavor_tools as ft
    uid = _make_user(client, db_session, "bulk2@example.com")
    ctx = _ctx(db_session, uid)
    assert "error" in ft.tool_add_pantry_bulk(ctx, items=[])


# ── Journal tools ──────────────────────────────────────────────────────────

def test_log_then_get_journal(client, db_session):
    from app.services import flavor_tools as ft
    uid = _make_user(client, db_session, "journal@example.com")
    ctx = _ctx(db_session, uid)
    logged = ft.tool_log_meal_memory(ctx, dish_name="Carbonara", rating=5, cuisine="Italian")
    assert logged["ok"] is True and logged["rating"] == 5

    recent = ft.tool_get_journal_recent(ctx, limit=10)
    assert any(m["dish_name"] == "Carbonara" for m in recent["memories"])


def test_log_meal_memory_clamps_rating(client, db_session):
    from app.services import flavor_tools as ft
    uid = _make_user(client, db_session, "journal2@example.com")
    ctx = _ctx(db_session, uid)
    out = ft.tool_log_meal_memory(ctx, dish_name="Overrated dish", rating=99)
    assert out["rating"] == 5  # clamped to 1-5


# ── Preferences ────────────────────────────────────────────────────────────

def test_update_preferences_scalar_field(client, db_session):
    from app.services import flavor_tools as ft
    uid = _make_user(client, db_session, "pref@example.com")
    ctx = _ctx(db_session, uid)
    out = ft.tool_update_preferences_field(ctx, field="skill_level", value="advanced")
    assert out["ok"] is True
    prefs = ft.tool_get_user_preferences(ctx)
    assert prefs["skill_level"] == "advanced"


def test_update_preferences_list_field(client, db_session):
    from app.services import flavor_tools as ft
    uid = _make_user(client, db_session, "pref2@example.com")
    ctx = _ctx(db_session, uid)
    out = ft.tool_update_preferences_field(
        ctx, field="dietary_preferences", value=["vegetarian", "gluten_free"]
    )
    assert out["ok"] is True
    prefs = ft.tool_get_user_preferences(ctx)
    assert prefs["dietary_preferences"] == ["vegetarian", "gluten_free"]


def test_update_preferences_rejects_non_whitelist(client, db_session):
    from app.services import flavor_tools as ft
    uid = _make_user(client, db_session, "pref3@example.com")
    ctx = _ctx(db_session, uid)
    # account_type is deliberately NOT writable — changing it reroutes the user.
    assert "error" in ft.tool_update_preferences_field(ctx, field="account_type", value="restaurant")
    assert "error" in ft.tool_update_preferences_field(ctx, field="password_hash", value="x")


def test_update_preferences_list_field_rejects_scalar(client, db_session):
    from app.services import flavor_tools as ft
    uid = _make_user(client, db_session, "pref4@example.com")
    ctx = _ctx(db_session, uid)
    out = ft.tool_update_preferences_field(ctx, field="cuisine_preferences", value="Italian")
    assert "error" in out  # list field needs a list


# ── Booking tools (diner side) ─────────────────────────────────────────────

def test_create_then_cancel_booking(client, db_session):
    from app.services import flavor_tools as ft
    uid = _make_user(client, db_session, "book@example.com")
    ctx = _ctx(db_session, uid)

    created = ft.tool_create_booking(
        ctx, restaurant_name="Taverna 21", date="2026-06-01", time="20:00", party_size=2
    )
    assert created["ok"] is True
    assert created["status"] == "pending"
    bid = created["id"]

    listed = ft.tool_get_my_bookings(ctx)
    assert any(b["id"] == bid for b in listed["bookings"])

    cancelled = ft.tool_cancel_booking(ctx, booking_id=bid)
    assert cancelled["status"] == "cancelled"


def test_cancel_booking_not_owned(client, db_session):
    from app.services import flavor_tools as ft
    owner = _make_user(client, db_session, "owner@example.com")
    other = _make_user(client, db_session, "other@example.com")
    owner_ctx = _ctx(db_session, owner)
    created = ft.tool_create_booking(owner_ctx, restaurant_name="X", date="2026-06-02")
    # A different user can't cancel it — user_id-scoped query.
    other_ctx = _ctx(db_session, other)
    out = ft.tool_cancel_booking(other_ctx, booking_id=created["id"])
    assert "error" in out


def test_log_visit(client, db_session):
    from app.services import flavor_tools as ft
    uid = _make_user(client, db_session, "visit@example.com")
    ctx = _ctx(db_session, uid)
    out = ft.tool_log_visit(ctx, restaurant_name="Bistro Nine", visit_date="2026-05-01", rating=4.5)
    assert out["ok"] is True
    hist = ft.tool_get_visit_history(ctx)
    assert any(v["restaurant"] == "Bistro Nine" for v in hist["visits"])


# ── Restaurant tools ───────────────────────────────────────────────────────

def test_add_then_get_menu(client, db_session):
    from app.services import flavor_tools as ft
    uid = _make_user(client, db_session, "resto@example.com", account_type="restaurant")
    ctx = _ctx(db_session, uid, account_type="restaurant")
    added = ft.tool_add_menu_item(ctx, name="Burrata", category="Starters", price=14.0, cost=4.0)
    assert added["ok"] is True
    menu = ft.tool_get_menu(ctx, category="Starters")
    assert any(i["name"] == "Burrata" for i in menu["items"])


def test_update_menu_item_scoped(client, db_session):
    from app.services import flavor_tools as ft
    resto_a = _make_user(client, db_session, "resa@example.com", account_type="restaurant")
    resto_b = _make_user(client, db_session, "resb@example.com", account_type="restaurant")
    ctx_a = _ctx(db_session, resto_a, account_type="restaurant")
    ctx_b = _ctx(db_session, resto_b, account_type="restaurant")
    item = ft.tool_add_menu_item(ctx_a, name="Tiramisu", category="Desserts", price=8.0)
    # Restaurant B cannot edit Restaurant A's item.
    out = ft.tool_update_menu_item(ctx_b, item_id=item["id"], price=99.0)
    assert "error" in out


def test_add_menu_item_rejects_bad_price(client, db_session):
    from app.services import flavor_tools as ft
    uid = _make_user(client, db_session, "resto2@example.com", account_type="restaurant")
    ctx = _ctx(db_session, uid, account_type="restaurant")
    assert "error" in ft.tool_add_menu_item(ctx, name="Free Lunch", category="Mains", price=0)


def test_decline_booking_requires_reason(client, db_session):
    from app.services import flavor_tools as ft
    uid = _make_user(client, db_session, "resto3@example.com", account_type="restaurant")
    ctx = _ctx(db_session, uid, account_type="restaurant")
    # No booking needed — the reason guard fires before the lookup.
    out = ft.tool_decline_booking(ctx, booking_id=1, reason="")
    assert "error" in out


def test_add_crm_customer(client, db_session):
    from app.services import flavor_tools as ft
    uid = _make_user(client, db_session, "resto4@example.com", account_type="restaurant")
    ctx = _ctx(db_session, uid, account_type="restaurant")
    out = ft.tool_add_crm_customer(ctx, name="Maria Santos", tags="vip,regular")
    assert out["ok"] is True
    top = ft.tool_get_top_customers(ctx)
    assert any(c["name"] == "Maria Santos" for c in top["customers"])


def test_log_inventory_adjustment_validates_type(client, db_session):
    from app.services import flavor_tools as ft
    uid = _make_user(client, db_session, "resto5@example.com", account_type="restaurant")
    ctx = _ctx(db_session, uid, account_type="restaurant")
    # Bad adjustment_type rejected before any DB write.
    out = ft.tool_log_inventory_adjustment(ctx, item_id=1, adjustment_type="teleport", delta=5)
    assert "error" in out


def test_respond_to_review_scoped(client, db_session):
    from app.services import flavor_tools as ft
    from app.models.review import Review
    uid = _make_user(client, db_session, "resto6@example.com", account_type="restaurant")
    ctx = _ctx(db_session, uid, account_type="restaurant")
    # Seed a review owned by this restaurant.
    review = Review(
        user_id=uid, customer_name="Guest", menu_item="Soup",
        rating=2, comment="Too salty.",
    )
    db_session.add(review)
    db_session.commit()
    db_session.refresh(review)

    out = ft.tool_respond_to_review(ctx, review_id=review.id,
                                    response_text="So sorry — we've adjusted the seasoning. Come back?")
    assert out["ok"] is True
    db_session.refresh(review)
    assert review.response is not None and review.responded_at is not None


def test_respond_to_review_not_found(client, db_session):
    from app.services import flavor_tools as ft
    uid = _make_user(client, db_session, "resto7@example.com", account_type="restaurant")
    ctx = _ctx(db_session, uid, account_type="restaurant")
    out = ft.tool_respond_to_review(ctx, review_id=999999, response_text="hi")
    assert "error" in out


# ── Composite tools ────────────────────────────────────────────────────────

def test_build_shopping_list_diffs_pantry(client, db_session):
    from app.services import flavor_tools as ft
    from app.services import recipe_service
    uid = _make_user(client, db_session, "shop@example.com")
    ctx = _ctx(db_session, uid)
    recipe = recipe_service.RECIPES[0]
    # Put one of the recipe's ingredient words in the pantry.
    first_ing = recipe["ingredients"][0]
    # crude: take a word ≥4 chars from the ingredient line
    word = next((w for w in first_ing.lower().split() if len(w) >= 4), first_ing)
    ft.tool_add_to_pantry(ctx, ingredient=word)
    out = ft.tool_build_shopping_list(ctx, recipe_id=recipe["id"])
    assert out["recipe_id"] == recipe["id"]
    assert out["need_count"] == len(out["need_to_buy"])
    # The pantry word should have moved at least one line to already_have.
    assert len(out["already_have"]) >= 1


def test_build_shopping_list_recipe_not_found(client, db_session):
    from app.services import flavor_tools as ft
    uid = _make_user(client, db_session, "shop2@example.com")
    ctx = _ctx(db_session, uid)
    assert "error" in ft.tool_build_shopping_list(ctx, recipe_id=999999)


def test_suggest_tonight_shape(client, db_session):
    from app.services import flavor_tools as ft
    uid = _make_user(client, db_session, "tonight@example.com")
    ctx = _ctx(db_session, uid)
    out = ft.tool_suggest_tonight(ctx)
    assert "based_on" in out
    assert "top_pick" in out
    assert "runners_up" in out and isinstance(out["runners_up"], list)


# ── Memory tools ───────────────────────────────────────────────────────────

def test_remember_then_recall(client, db_session):
    from app.services import flavor_tools as ft
    uid = _make_user(client, db_session, "mem@example.com")
    ctx = _ctx(db_session, uid)
    saved = ft.tool_remember_fact(ctx, fact="Allergic to shellfish", category="dietary")
    assert saved["ok"] is True
    recalled = ft.tool_recall_facts(ctx)
    assert any(f["fact"] == "Allergic to shellfish" for f in recalled["facts"])


def test_remember_fact_dedupes(client, db_session):
    from app.services import flavor_tools as ft
    uid = _make_user(client, db_session, "mem2@example.com")
    ctx = _ctx(db_session, uid)
    ft.tool_remember_fact(ctx, fact="Oven runs hot", category="equipment")
    second = ft.tool_remember_fact(ctx, fact="oven runs hot", category="equipment")  # case-diff
    assert second.get("note") == "already remembered"
    assert ft.tool_recall_facts(ctx)["count"] == 1


def test_remember_fact_bad_category_falls_back(client, db_session):
    from app.services import flavor_tools as ft
    uid = _make_user(client, db_session, "mem3@example.com")
    ctx = _ctx(db_session, uid)
    out = ft.tool_remember_fact(ctx, fact="Likes things spicy", category="not_a_category")
    assert out["category"] == "context"


def test_forget_fact_fuzzy(client, db_session):
    from app.services import flavor_tools as ft
    uid = _make_user(client, db_session, "mem4@example.com")
    ctx = _ctx(db_session, uid)
    ft.tool_remember_fact(ctx, fact="Cooking for a date this Friday", category="context")
    out = ft.tool_forget_fact(ctx, fact="date this friday")  # substring, lowercase
    assert out["ok"] is True
    assert ft.tool_recall_facts(ctx)["count"] == 0


def test_memory_eviction_at_cap(client, db_session):
    from app.services import flavor_tools as ft
    uid = _make_user(client, db_session, "mem5@example.com")
    ctx = _ctx(db_session, uid)
    # Fill past the cap. Each fact is unique so de-dup doesn't interfere.
    for i in range(ft.MEMORY_CAP + 5):
        ft.tool_remember_fact(ctx, fact=f"fact number {i}", category="context")
    count = ft.tool_recall_facts(ctx)["count"]
    assert count == ft.MEMORY_CAP  # never exceeds the cap


def test_load_user_memories_helper(client, db_session):
    from app.services import flavor_tools as ft
    uid = _make_user(client, db_session, "mem6@example.com")
    ctx = _ctx(db_session, uid)
    ft.tool_remember_fact(ctx, fact="Vegan", category="dietary")
    ft.tool_remember_fact(ctx, fact="No microwave", category="equipment")
    mems = ft.load_user_memories(db_session, uid)
    assert len(mems) == 2
    assert {m["category"] for m in mems} == {"dietary", "equipment"}


# ── Role gating + dispatcher ──────────────────────────────────────────────

def test_tools_for_user_role_sets(client, db_session):
    from app.services import flavor_tools as ft
    consumer = _ctx(db_session, 1, account_type="consumer")
    restaurant = _ctx(db_session, 1, account_type="restaurant")
    staff = _ctx(db_session, 1, account_type="staff")

    consumer_names = {t["name"] for t in ft.tools_for_user(consumer)}
    restaurant_names = {t["name"] for t in ft.tools_for_user(restaurant)}
    staff_names = {t["name"] for t in ft.tools_for_user(staff)}

    # Consumer gets diner tools, not restaurant tools.
    assert "get_my_bookings" in consumer_names
    assert "get_menu" not in consumer_names
    # Restaurant gets restaurant tools, not diner tools.
    assert "get_menu" in restaurant_names
    assert "get_my_bookings" not in restaurant_names
    # Staff gets universal only.
    assert "get_menu" not in staff_names
    assert "get_my_bookings" not in staff_names
    assert "search_wines" in staff_names  # universal


def test_every_advertised_tool_has_a_dispatch_entry(client, db_session):
    """Guard against adding a tool definition but forgetting the
    dispatch wiring (or vice versa)."""
    from app.services import flavor_tools as ft
    for at in ("consumer", "diner", "restaurant", "staff"):
        ctx = _ctx(db_session, 1, account_type=at)
        for tool_def in ft.tools_for_user(ctx):
            assert tool_def["name"] in ft._TOOLS, f"{tool_def['name']} missing from dispatch"


def test_dispatcher_rejects_cross_role_tool(client, db_session):
    from app.services import flavor_tools as ft
    # A consumer's dispatcher must refuse a restaurant-only tool even
    # if Claude misroutes the call.
    ctx = _ctx(db_session, 1, account_type="consumer")
    dispatch = ft.make_dispatcher(ctx)
    result = dispatch("get_menu", {})
    assert "error" in result
    assert "not available" in result["error"]


def test_dispatcher_rejects_unknown_tool(client, db_session):
    from app.services import flavor_tools as ft
    ctx = _ctx(db_session, 1, account_type="consumer")
    dispatch = ft.make_dispatcher(ctx)
    result = dispatch("definitely_not_a_tool", {})
    assert "error" in result and "unknown tool" in result["error"]


def test_dispatcher_runs_universal_tool(client, db_session):
    from app.services import flavor_tools as ft
    uid = _make_user(client, db_session, "disp@example.com")
    ctx = _ctx(db_session, uid, account_type="consumer")
    dispatch = ft.make_dispatcher(ctx)
    result = dispatch("search_wines", {"query": ""})
    assert "wines" in result  # ran successfully
