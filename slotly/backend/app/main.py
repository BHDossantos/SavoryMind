import logging

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session

from .config import settings
from .db import engine, init_db
from .notifications_service import process_due
from .routers import (
    admin,
    appointments,
    auth,
    availability,
    payments,
    providers,
    reviews,
    search,
    services,
)

logger = logging.getLogger("slotly.main")
_scheduler: BackgroundScheduler | None = None


def _process_due_tick() -> None:
    try:
        with Session(engine) as session:
            sent = process_due(session)
            if sent:
                logger.info("Sent %d notification(s)", sent)
    except Exception as e:  # noqa: BLE001
        logger.warning("Notification tick failed: %s", e)

app = FastAPI(title="Slotly API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    global _scheduler
    init_db()
    _scheduler = BackgroundScheduler(daemon=True)
    _scheduler.add_job(
        _process_due_tick,
        "interval",
        seconds=settings.notifications_tick_seconds,
        id="notifications_tick",
        max_instances=1,
        coalesce=True,
    )
    _scheduler.start()


@app.on_event("shutdown")
def _shutdown() -> None:
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(providers.router)
app.include_router(services.router)
app.include_router(availability.router)
app.include_router(search.router)
app.include_router(appointments.router)
app.include_router(reviews.router)
app.include_router(payments.router)
app.include_router(admin.router)
