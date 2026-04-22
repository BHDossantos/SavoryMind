from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.core.config import settings
from app.core.database import engine, Base
from app.models import User, MenuItem, Review  # noqa: F401
from app.models.consumer import WinePairing, MusicMood, SocialConnection, BehaviorLog  # noqa: F401
from app.models.restaurant_ext import Booking, CRMCustomer, Staff, SalesLog  # noqa: F401
from app.models.kitchen import FoodWasteLog, DishTimeLog  # noqa: F401
from app.models.diner import DinerBooking, DinerVisit  # noqa: F401
from app.api.routes import menu, reviews, reports, auth, consumer, restaurant_ext, owner_extras, diner

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
]


def _run_migrations():
    with engine.connect() as conn:
        for col, col_type in _USER_MIGRATIONS:
            try:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {col_type}"))
                conn.commit()
            except Exception:
                pass  # column already exists — safe to skip


@asynccontextmanager
async def lifespan(app: FastAPI):
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


@app.get("/")
def root():
    return {"message": "SavoryMind API v2", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}
