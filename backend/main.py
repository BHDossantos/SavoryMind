from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.api.routes import menu, reviews
from app.services.seed_data import seed_database

Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.app_name, version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(menu.router, prefix="/api")
app.include_router(reviews.router, prefix="/api")


@app.on_event("startup")
def startup_event():
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()


@app.get("/")
def root():
    return {"message": "SavoryMind API", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}
