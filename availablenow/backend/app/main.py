from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import init_db
from .routers import appointments, auth, availability, payments, providers, reviews, search, services

app = FastAPI(title="AvailableNow API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    init_db()


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
