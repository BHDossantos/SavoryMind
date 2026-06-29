"""Idempotent test-account seeder.

Creates three demo users (consumer / restaurant / diner) on the configured
DATABASE_URL. Skips any account that already exists so it's safe to run
repeatedly — including against production-like databases where deleting
real users would be catastrophic.

Run locally:
    python -m scripts.seed_test_accounts

Run against Cloud Run's database via Cloud SQL Auth Proxy or `gcloud run jobs`.
Required env: DATABASE_URL, SECRET_KEY (for password hashing config to load).

Override the password via env:
    SEED_TEST_PASSWORD=MyOwnPassword python -m scripts.seed_test_accounts
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Allow running as a plain script (`python scripts/seed_test_accounts.py`)
# from inside backend/ — adds backend/ to sys.path so `app.*` imports work.
BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.database import SessionLocal  # noqa: E402
from app.models.user import User  # noqa: E402
from app.schemas.auth import UserRegister  # noqa: E402
from app.services import auth_service  # noqa: E402


DEFAULT_PASSWORD = os.environ.get("SEED_TEST_PASSWORD", "Test1234!")

TEST_ACCOUNTS = [
    {
        "email": "consumer@savorymind.test",
        "account_type": "consumer",
        "display_name": "Test Consumer",
    },
    {
        "email": "restaurant@savorymind.test",
        "account_type": "restaurant",
        "display_name": "Test Restaurant",
    },
    {
        "email": "diner@savorymind.test",
        "account_type": "diner",
        "display_name": "Test Diner",
    },
]


def seed() -> int:
    db = SessionLocal()
    created = 0
    skipped = 0
    try:
        for spec in TEST_ACCOUNTS:
            existing = db.query(User).filter(User.email == spec["email"]).first()
            if existing:
                print(f"  skip   {spec['email']:<35} (id={existing.id}, already exists)")
                skipped += 1
                continue
            data = UserRegister(password=DEFAULT_PASSWORD, **spec)
            _, user = auth_service.register(db, data)
            print(f"  create {spec['email']:<35} (id={user.id})")
            created += 1
    finally:
        db.close()

    print(f"\nDone. {created} created, {skipped} skipped.")
    print(f"Password for newly created accounts: {DEFAULT_PASSWORD!r}")
    return 0


if __name__ == "__main__":
    sys.exit(seed())
