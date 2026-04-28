import os
import sys
from pathlib import Path

os.environ.setdefault("NOCTURNA_DATABASE_URL", "sqlite:///./nocturna_test.db")
os.environ.setdefault("NOCTURNA_SEED_ON_STARTUP", "false")

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.db import Base


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    from app import models  # register

    Base.metadata.create_all(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()
