from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base
from app.models import User, MenuItem, Review  # noqa: F401
from app.models.consumer import WinePairing, MusicMood, SocialConnection, BehaviorLog  # noqa: F401
from app.models.restaurant_ext import Booking, CRMCustomer, Staff, SalesLog  # noqa: F401
from app.api.routes import menu, reviews, reports, auth, consumer, restaurant_ext


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title=settings.app_name, version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
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


@app.get("/")
def root():
    return {"message": "SavoryMind API v2", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}
