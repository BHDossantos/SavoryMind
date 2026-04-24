from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.core.config import settings
from app.core.database import engine, Base
from app.models import User, MenuItem, Review  # noqa: F401
from app.models.consumer import WinePairing, MusicMood, SocialConnection, BehaviorLog  # noqa: F401
from app.models.restaurant_ext import Booking, CRMCustomer, Staff, SalesLog  # noqa: F401
from app.models.kitchen import FoodWasteLog, DishTimeLog, StaffTimeLog  # noqa: F401
from app.models.diner import DinerBooking, DinerVisit  # noqa: F401
from app.api.routes import menu, reviews, reports, auth, consumer, restaurant_ext, owner_extras, diner, staff_portal, discover

# Columns to add to existing `users` table on older deployments
_USER_MIGRATIONS = [
    ("first_name",           "VARCHAR(100)"),
    ("last_name",            "VARCHAR(100)"),
    ("city",                 "VARCHAR(150)"),
    ("country",              "VARCHAR(100)"),
    ("latitude",             "REAL"),
    ("longitude",            "REAL"),
    ("music_genres",         "TEXT"),
    ("cuisine_preferences",  "TEXT"),
    ("dietary_preferences",  "TEXT"),
    ("drinking_habits",      "TEXT"),
    ("recipe_interests",     "TEXT"),
    ("onboarding_completed", "BOOLEAN DEFAULT FALSE"),
    ("social_provider",      "VARCHAR(50)"),
    ("social_id",            "VARCHAR(255)"),
    ("employer_id",          "INTEGER"),
    ("kitchen_style",        "VARCHAR(100)"),
    ("skill_level",          "VARCHAR(50)"),
    ("cooking_frequency",    "VARCHAR(50)"),
    ("cooking_time_pref",    "VARCHAR(50)"),
    ("flavor_profile",       "TEXT"),
    ("cooking_goals",        "TEXT"),
    ("meal_types",           "TEXT"),
    ("kitchen_tools",        "TEXT"),
    ("ingredient_budget",    "VARCHAR(50)"),
    ("music_moods",          "TEXT"),
    ("non_alcoholic_ok",     "BOOLEAN"),
    ("cuisine_dislikes",     "TEXT"),
    ("dining_occasions",     "TEXT"),
    ("atmosphere_prefs",     "TEXT"),
    ("dining_budget",        "VARCHAR(50)"),
    ("dining_frequency",     "VARCHAR(50)"),
    ("dining_group",         "TEXT"),
    ("business_type",        "VARCHAR(50)"),
    ("restaurant_cuisine",   "TEXT"),
    ("service_type",         "TEXT"),
    ("dining_style",         "VARCHAR(50)"),
    ("target_audience",      "TEXT"),
    ("peak_hours",           "TEXT"),
    ("restaurant_goals",     "TEXT"),
    ("wine_program",         "TEXT"),
    ("seating_capacity",     "INTEGER"),
    ("serves_wine",          "BOOLEAN"),
    ("serves_cocktails",     "BOOLEAN"),
    ("serves_beer",          "BOOLEAN"),
]

_STAFF_TIME_MIGRATIONS = [
    ("staff_user_id", "INTEGER"),
    ("is_open",       "BOOLEAN DEFAULT FALSE"),
]

_BOOKING_MIGRATIONS = [
    ("diner_user_id", "INTEGER"),
    ("source",        "VARCHAR DEFAULT 'manual'"),
]

_DINER_BOOKING_MIGRATIONS = [
    ("restaurant_user_id",    "INTEGER"),
    ("restaurant_booking_id", "INTEGER"),
]

_USER_AVAILABILITY_MIGRATIONS = [
    ("available_time_slots", "TEXT"),       # comma-sep e.g. "12:00,13:00,19:00,20:00"
    ("booking_window_days",  "INTEGER DEFAULT 60"),
]


def _run_migrations():
    with engine.connect() as conn:
        for col, col_type in _USER_MIGRATIONS:
            try:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {col_type}"))
                conn.commit()
            except Exception:
                pass
        for col, col_type in _STAFF_TIME_MIGRATIONS:
            try:
                conn.execute(text(f"ALTER TABLE staff_time_logs ADD COLUMN {col} {col_type}"))
                conn.commit()
            except Exception:
                pass
        for col, col_type in _BOOKING_MIGRATIONS:
            try:
                conn.execute(text(f"ALTER TABLE bookings ADD COLUMN {col} {col_type}"))
                conn.commit()
            except Exception:
                pass
        for col, col_type in _DINER_BOOKING_MIGRATIONS:
            try:
                conn.execute(text(f"ALTER TABLE diner_bookings ADD COLUMN {col} {col_type}"))
                conn.commit()
            except Exception:
                pass
        for col, col_type in _USER_AVAILABILITY_MIGRATIONS:
            try:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {col_type}"))
                conn.commit()
            except Exception:
                pass


_DEFAULT_SECRET = "savorymind-super-secret-change-in-production-32chars"


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.secret_key == _DEFAULT_SECRET and "sqlite" not in settings.database_url:
        raise RuntimeError(
            "SECRET_KEY is the insecure default value. "
            "Set the SECRET_KEY environment variable before deploying to production."
        )
    Base.metadata.create_all(bind=engine)
    _run_migrations()
    yield


app = FastAPI(title=settings.app_name, version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # Bearer-token auth — no cookies, so wildcard is safe
    allow_credentials=False,
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


@app.get("/")
def root():
    return {"message": "SavoryMind API v2", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}
