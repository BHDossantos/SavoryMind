import json
import logging
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models import City, User, Venue

log = logging.getLogger("nocturna.seed")
SEED_DIR = Path(__file__).parent


def _load_json(name: str) -> list:
    p = SEED_DIR / name
    if not p.exists():
        return []
    return json.loads(p.read_text(encoding="utf-8"))


def _all_venue_rows() -> list:
    from .rome_venues_part1 import VENUES_PART1
    from .rome_venues_part2 import VENUES_PART2
    from .rome_venues_part3 import VENUES_PART3
    from .rome_venues_part4 import VENUES_PART4
    from .intl_venues import INTL_VENUES

    return [*VENUES_PART1, *VENUES_PART2, *VENUES_PART3, *VENUES_PART4, *INTL_VENUES]


def seed_cities(db: Session):
    rows = _load_json("cities.json")
    created = 0
    for r in rows:
        if db.query(City).filter(City.slug == r["slug"]).first():
            continue
        db.add(City(**r))
        created += 1
    db.commit()
    log.info("Cities: +%d (total=%d)", created, db.query(City).count())


def seed_venues(db: Session):
    inserted = 0
    for r in _all_venue_rows():
        if db.query(Venue).filter(Venue.slug == r["slug"]).first():
            continue
        # Drop unknown keys defensively
        clean = {k: v for k, v in r.items() if hasattr(Venue, k)}
        db.add(Venue(**clean))
        inserted += 1
    db.commit()
    log.info("Venues: +%d (total=%d)", inserted, db.query(Venue).count())


def bootstrap_admin(db: Session, email: str, password: str):
    if db.query(User).filter(User.email == email).first():
        return
    db.add(User(
        email=email,
        password_hash=hash_password(password),
        name="Nocturna Admin",
        role="admin",
    ))
    db.commit()
    log.info("Bootstrapped admin user %s", email)
