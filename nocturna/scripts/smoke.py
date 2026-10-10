#!/usr/bin/env python3
"""Nocturna production smoke test — run after every deploy.

Usage:
    python3 nocturna/scripts/smoke.py https://nocturna-api-xxx.run.app [https://nocturna-web-xxx.run.app]

Exercises the real golden path against live infrastructure:
  API: health → cities → trending venues → planner generate → guest booking
       → share-token round-trip
  Web (if URL given): home, /privacy, /terms, /robots.txt, /sitemap.xml

Pure stdlib — no pip installs needed on the machine running it.
Exit code 0 = all green; 1 = something failed (details printed).
"""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta

FAILURES: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    mark = "✓" if ok else "✗"
    print(f"  {mark} {name}" + (f" — {detail}" if detail else ""))
    if not ok:
        FAILURES.append(f"{name}: {detail}")


def req(url: str, payload: dict | None = None, timeout: int = 30):
    data = json.dumps(payload).encode() if payload is not None else None
    r = urllib.request.Request(
        url, data=data,
        headers={"Content-Type": "application/json", "User-Agent": "nocturna-smoke/1.0"},
        method="POST" if payload is not None else "GET",
    )
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            body = resp.read()
            ctype = resp.headers.get("Content-Type", "")
            parsed = json.loads(body) if "json" in ctype else body.decode(errors="replace")
            return resp.status, parsed
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, None
    except Exception as e:  # noqa: BLE001
        return 0, str(e)


def smoke_api(api: str) -> None:
    print(f"\nAPI · {api}")

    status, body = req(f"{api}/api/health")
    check("health", status == 200 and isinstance(body, dict) and body.get("status") == "ok", f"status={status}")
    if status != 200:
        return  # no point continuing

    status, cities = req(f"{api}/api/cities")
    check("cities seeded", status == 200 and isinstance(cities, list) and len(cities) >= 1,
          f"{len(cities) if isinstance(cities, list) else status} cities")

    status, venues = req(f"{api}/api/venues/trending?city=rome&limit=3")
    check("trending venues", status == 200 and isinstance(venues, list) and len(venues) >= 1,
          f"{len(venues) if isinstance(venues, list) else status} venues")

    # Planner — a Friday 21:00 at least 2 days out so hours always apply.
    when = datetime.utcnow() + timedelta(days=2)
    while when.weekday() != 4:  # advance to Friday
        when += timedelta(days=1)
    when = when.replace(hour=21, minute=0, second=0, microsecond=0)
    status, gen = req(f"{api}/api/planner/generate", {
        "city": "rome", "intent": "date_night",
        "requested_for": when.isoformat(),
        "vibe_tags": ["romantic", "elegant"], "music_pref": ["jazz"],
        "style": "elegant", "group_type": "date", "group_size": 2,
        "budget_band": "100-200", "budget_per_person": 150, "plan_count": 2,
    })
    plans = gen.get("plans", []) if isinstance(gen, dict) else []
    check("planner generates", status == 200 and len(plans) >= 1,
          f"status={status}, plans={len(plans)}")
    if not plans:
        return

    plan = plans[0]
    stops = plan.get("stops", [])
    check("plan has stops + cost", len(stops) >= 1 and plan.get("estimated_cost_eur", 0) > 0,
          f"{len(stops)} stops, €{plan.get('estimated_cost_eur')}")

    # Share round-trip
    token = plan.get("share_token")
    status, shared = req(f"{api}/api/plans/share/{token}")
    check("share token round-trip", status == 200 and isinstance(shared, dict) and shared.get("id") == plan["id"],
          f"status={status}")

    # Guest booking on the first stop (clearly marked as a smoke test)
    status, booking = req(f"{api}/api/bookings", {
        "venue_id": stops[0]["venue_id"], "plan_id": plan["id"],
        "contact_name": "SMOKE TEST — ignore",
        "contact_phone": "+10000000000",
        "contact_email": "smoke-test@nocturna.app",
        "date": when.strftime("%Y-%m-%d"), "time": "21:00",
        "group_size": 2, "request_type": "dinner", "vip_interest": "no",
        "notes": "Automated smoke test — safe to reject.",
    })
    bid = booking.get("id") if isinstance(booking, dict) else None
    check("guest booking accepted", status == 200 and bid is not None, f"status={status}, id={bid}")
    if bid:
        print(f"    ↳ reject booking #{bid} from the admin dashboard when done")

    # SEO endpoints served by the API host too? No — web-only. Done here.


def smoke_web(web: str) -> None:
    print(f"\nWeb · {web}")
    for path, needle in [
        ("/", "Nocturna"),
        ("/privacy", "Privacy"),
        ("/terms", "Terms"),
        ("/robots.txt", "Sitemap"),
        ("/sitemap.xml", "<urlset"),
        ("/manifest.webmanifest", "Nocturna"),
    ]:
        status, body = req(f"{web}{path}")
        text = body if isinstance(body, str) else json.dumps(body)
        check(path, status == 200 and needle.lower() in text.lower(), f"status={status}")


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    api = sys.argv[1].rstrip("/")
    smoke_api(api)
    if len(sys.argv) > 2:
        smoke_web(sys.argv[2].rstrip("/"))

    print()
    if FAILURES:
        print(f"✗ {len(FAILURES)} check(s) FAILED:")
        for f in FAILURES:
            print(f"  - {f}")
        return 1
    print("✓ All smoke checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
