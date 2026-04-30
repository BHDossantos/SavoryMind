import logging
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text, inspect as sa_inspect
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from alembic.config import Config as AlembicConfig
from alembic import command as alembic_command
from app.core.config import settings
from app.core.database import engine
from app.core.rate_limit import limiter

logger = logging.getLogger(__name__)

# Initialise Sentry before the FastAPI app is constructed so its integration
# can hook into the request lifecycle. No DSN → SDK becomes a no-op, which is
# what we want in local dev.
if settings.sentry_dsn:
    import sentry_sdk
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.sentry_environment,
        traces_sample_rate=0.1,
        send_default_pii=False,
    )
from app.models import User, MenuItem, Review  # noqa: F401
from app.models.consumer import WinePairing, MusicMood, SocialConnection, BehaviorLog  # noqa: F401
from app.models.restaurant_ext import Booking, CRMCustomer, Staff, SalesLog  # noqa: F401
from app.models.kitchen import FoodWasteLog, DishTimeLog, StaffTimeLog  # noqa: F401
from app.models.diner import DinerBooking, DinerVisit  # noqa: F401
from app.models.notification import Notification  # noqa: F401
from app.api.routes import menu, reviews, reports, auth, consumer, restaurant_ext, owner_extras, diner, staff_portal, discover, notifications, oauth


def _run_alembic_migrations():
    """Apply schema migrations via Alembic.

    Self-healing across three states:
    - Empty database (e.g. fresh local dev) → upgrade head creates the schema.
    - Existing database from a pre-Alembic deploy (no `alembic_version` table)
      → stamp head, recording that the live schema matches the baseline
      without re-running create-table statements that would fail.
    - Database already managed by Alembic → upgrade head applies any
      pending migrations.
    """
    alembic_ini = Path(__file__).parent / "alembic.ini"
    cfg = AlembicConfig(str(alembic_ini))

    existing = set(sa_inspect(engine).get_table_names())
    if "alembic_version" in existing:
        alembic_command.upgrade(cfg, "head")
    elif "users" in existing:
        # Brownfield: schema already exists from create_all. Mark it as baseline.
        alembic_command.stamp(cfg, "head")
    else:
        alembic_command.upgrade(cfg, "head")


_DEFAULT_SECRET = "savorymind-super-secret-change-in-production-32chars"
_DEFAULT_SOCIAL_SECRET = "dev-social-secret"


@asynccontextmanager
async def lifespan(app: FastAPI):
    is_prod = "sqlite" not in settings.database_url
    if settings.secret_key == _DEFAULT_SECRET and is_prod:
        raise RuntimeError(
            "SECRET_KEY is the insecure default value. "
            "Set the SECRET_KEY environment variable before deploying to production."
        )
    if settings.social_login_secret == _DEFAULT_SOCIAL_SECRET and is_prod:
        raise RuntimeError(
            "SOCIAL_LOGIN_SECRET is the insecure default value. "
            "Set the SOCIAL_LOGIN_SECRET environment variable before deploying to production."
        )
    _run_alembic_migrations()
    yield


app = FastAPI(title=settings.app_name, version="2.0.0", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_origin_regex,
    # Required so the browser sends the httpOnly refresh-token cookie on
    # cross-origin requests (frontend savorymind.net → api.savorymind.net).
    # Note: with credentials enabled, allow_origins MUST be explicit (no "*")
    # — the cors_origins list above and the project-scoped regex satisfy that.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(menu.router, prefix="/api")
app.include_router(reviews.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(consumer.router, prefix="/api")
app.include_router(restaurant_ext.router, prefix="/api")
app.include_router(owner_extras.router, prefix="/api")
app.include_router(diner.router, prefix="/api")
app.include_router(staff_portal.router, prefix="/api")
app.include_router(discover.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(oauth.router, prefix="/api")


@app.get("/")
def root():
    return {"message": "SavoryMind API v2", "docs": "/docs"}


@app.get("/health")
def health():
    """Readiness probe — verifies the database is actually reachable.

    Returns 200 only if a `SELECT 1` succeeds. Otherwise returns 503 so
    Cloud Run / load balancers can stop sending traffic to a degraded
    instance instead of letting users hit it and get 500s.
    """
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:
        # Log the full exception server-side (Sentry + Cloud Run logs) but
        # never return it to the caller — it can leak DSN fragments,
        # connection strings, and authentication failure details.
        logger.exception("/health database probe failed")
        return JSONResponse(
            status_code=503,
            content={"status": "degraded", "db": "unavailable"},
        )
    return {"status": "ok", "db": "ok"}
