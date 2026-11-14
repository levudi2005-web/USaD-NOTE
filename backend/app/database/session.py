from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from typing import Generator
from app.core.config import settings

engine = create_engine(
    settings.database_url,
    connect_args={
        "connect_timeout": 5,
        "read_timeout": 30,
        "write_timeout": 30,
        "init_command": "SET time_zone = '+00:00'",
    },
    pool_pre_ping=True,
    pool_recycle=1800,
    pool_size=4,
    max_overflow=1,
    pool_timeout=10,
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator:
    """Dependency for obtaining a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
