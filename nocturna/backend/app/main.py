import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.db import Base, SessionLocal, engine
from app.api.routes import (
    auth,
    cities,
    venues,
    planner,
    bookings,
    reviews,
    group,
    events,
    payments,
    chat,
    partner,
    saved,
    admin as admin_routes,
    admin_export,
    admin_import,
    admin_notifications,
    cron,
)
from app.seed.load_data import bootstrap_admin, seed_cities, seed_venues

settings = get_settings()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
log = logging.getLogger("nocturna")

app = FastAPI(title=settings.APP_NAME, version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    log.info("Creating tables and seeding…")
    # Import models to register tables
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    if settings.SEED_ON_STARTUP:
        db = SessionLocal()
        try:
            seed_cities(db)
            seed_venues(db)
            bootstrap_admin(db, settings.ADMIN_BOOTSTRAP_EMAIL, settings.ADMIN_BOOTSTRAP_PASSWORD)
        finally:
            db.close()
    log.info("Nocturna ready.")


@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings.APP_NAME}


for r in (
    auth.router,
    cities.router,
    venues.router,
    planner.router,
    bookings.router,
    reviews.router,
    group.router,
    events.router,
    payments.router,
    chat.router,
    partner.router,
    saved.router,
    admin_routes.router,
    admin_export.router,
    admin_import.router,
    admin_notifications.router,
    cron.router,
):
    app.include_router(r)
