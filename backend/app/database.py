import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Default is the local file next to the backend (host dev). Docker overrides it to
# a mounted volume path via LIFETRACK_DB_URL so the DB survives container rebuilds.
SQLALCHEMY_DATABASE_URL = os.environ.get("LIFETRACK_DB_URL", "sqlite:///./life_track.db")

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
