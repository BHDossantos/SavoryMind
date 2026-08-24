"""Consumer craving→delivery catalog — ranking, currency, and cuisine fallback."""
from app.services import delivery_service


def test_best_match_badges_the_top_rated_restaurant():
    # Korean: K-BBQ House (4.9) outranks Seoul Kitchen (4.8) which is first in
    # the catalog — the badge must follow the sort, not catalog order.
    res = delivery_service.get_restaurants_for_cuisine("Korean")
    assert res[0]["name"] == "K-BBQ House"
    assert res[0]["best_match"] is True
    assert all(r["best_match"] is False for r in res[1:])
    # Sorted by rating descending.
    assert res == sorted(res, key=lambda x: (-x["rating"], x["fee_val"]))


def test_empty_cuisine_uses_default_catalog_not_italian():
    # "" in "italian" is always True — an empty cuisine must fall to default.
    res = delivery_service.get_restaurants_for_cuisine("")
    names = {r["name"] for r in res}
    assert "The Kitchen Table" in names  # a default-catalog restaurant
    assert "Osteria Della Nonna" not in names  # the Italian catalog's first


def test_whitespace_cuisine_uses_default():
    res = delivery_service.get_restaurants_for_cuisine("   ")
    assert {r["name"] for r in res} == {r["name"] for r in delivery_service.get_restaurants_for_cuisine("")}


def test_delivery_fee_is_euro_not_dollar():
    res = delivery_service.get_restaurants_for_cuisine("Italian")
    fees = [r["fee"] for r in res if r["fee"] != "Free delivery"]
    assert fees, "expected at least one paid delivery fee in the Italian catalog"
    assert all("€" in f and "$" not in f for f in fees)


def test_known_cuisine_still_matches():
    res = delivery_service.get_restaurants_for_cuisine("Thai")
    assert {r["name"] for r in res} == {"Bangkok Street Kitchen", "Pad & Wok", "Lotus Thai"}
