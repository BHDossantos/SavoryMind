from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from .config import settings


def _make_engine(url: str):
    # Railway/Render ship postgres:// — SQLAlchemy 2.x needs postgresql+psycopg2://
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg2://", 1)
    elif url.startswith("postgresql://") and "+psycopg2" not in url:
        url = url.replace("postgresql://", "postgresql+psycopg2://", 1)

    kwargs = {}
    if url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
    else:
        kwargs["pool_pre_ping"] = True
        kwargs["pool_size"] = 5
        kwargs["max_overflow"] = 10
        # Fail a connection attempt fast instead of hanging when the database
        # is unreachable (e.g. Cloud SQL down). Combined with the swallowed
        # startup migrations in main.py, this keeps the container starting +
        # listening on $PORT so Cloud Run deploys don't fail on a DB blip.
        kwargs["connect_args"] = {"connect_timeout": 10}

    return create_engine(url, **kwargs)


engine = _make_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
