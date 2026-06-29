"""Alembic environment.

Wires the SQLAlchemy URL and metadata from the application config so
migrations target the same database the running app uses, no matter
whether we're running locally (SQLite) or in Cloud Run (Cloud SQL
Postgres via Unix socket).
"""
from logging.config import fileConfig
from pathlib import Path
import sys

from sqlalchemy import engine_from_config, pool
from alembic import context

# Make the backend package importable regardless of where alembic is invoked from.
BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import settings  # noqa: E402
from app.core.database import Base  # noqa: E402

# Import every model module so all tables register on Base.metadata before
# autogenerate inspects it. Mirrors the imports in main.py.
from app.models import User, MenuItem, Review  # noqa: E402, F401
from app.models.consumer import WinePairing, MusicMood, SocialConnection, BehaviorLog  # noqa: E402, F401
from app.models.restaurant_ext import Booking, CRMCustomer, Staff, SalesLog  # noqa: E402, F401
from app.models.kitchen import FoodWasteLog, DishTimeLog, StaffTimeLog  # noqa: E402, F401
from app.models.diner import DinerBooking, DinerVisit  # noqa: E402, F401
from app.models.notification import Notification  # noqa: E402, F401


config = context.config

# Override the placeholder URL in alembic.ini with the real one.
config.set_main_option("sqlalchemy.url", settings.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Emit SQL statements to stdout instead of executing them."""
    context.configure(
        url=settings.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Execute migrations against a live database."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
