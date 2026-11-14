from pathlib import Path
from typing import List
from urllib.parse import urlsplit

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings
from sqlalchemy.engine import URL

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DEFAULT_APP_SECRET = "note_local_development_jwt_secret_key_987654321_secure"
DEFAULT_AI_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"


class Settings(BaseSettings):
    APP_ENV: str = "development"
    DB_HOST: str = "127.0.0.1"
    DB_PORT: int = 3306
    DB_NAME: str = "note_db"
    DB_USER: str = "note_app"
    DB_PASSWORD: str = ""

    STORAGE_ROOT: str = str(BASE_DIR.parent / "storage")
    APP_SECRET: str = DEFAULT_APP_SECRET
    AI_ENCRYPTION_KEY: str = DEFAULT_AI_ENCRYPTION_KEY
    FRONTEND_ORIGIN: str = (
        "http://localhost:8080,http://127.0.0.1:8080,"
        "http://localhost:5173,http://127.0.0.1:5173"
    )
    BACKEND_HOST: str = "127.0.0.1"
    BACKEND_PORT: int = 8000
    MAX_UPLOAD_BYTES: int = 50 * 1024 * 1024
    MAX_CONCURRENT_DOCUMENT_UPLOADS: int = 2
    MAX_ARCHIVE_ENTRIES: int = 2000
    MAX_ARCHIVE_UNCOMPRESSED_BYTES: int = 500 * 1024 * 1024
    MAX_ARCHIVE_COMPRESSION_RATIO: float = 50.0
    MAX_ARCHIVE_PATH_DEPTH: int = 20

    @field_validator("APP_ENV")
    @classmethod
    def validate_app_env(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in {"development", "production"}:
            raise ValueError("APP_ENV must be 'development' or 'production'")
        return normalized

    @field_validator("MAX_CONCURRENT_DOCUMENT_UPLOADS")
    @classmethod
    def validate_max_concurrent_document_uploads(cls, value: int) -> int:
        if value < 1:
            raise ValueError("MAX_CONCURRENT_DOCUMENT_UPLOADS must be at least 1")
        return value

    @field_validator("DB_HOST")
    @classmethod
    def reject_tidb_cloud(cls, value: str) -> str:
        host = value.strip().lower().rstrip(".")
        if host == "tidbcloud.com" or host.endswith(".tidbcloud.com"):
            raise ValueError(
                "NOTE requires MariaDB; configure DB_HOST to a MariaDB server."
            )
        return value

    @model_validator(mode="after")
    def validate_production_settings(self):
        if self.APP_ENV.strip().lower() != "production":
            return self

        errors = []
        placeholder_markers = ("replace_with_", "your_", "change_me", "placeholder")
        if (
            self.APP_SECRET == DEFAULT_APP_SECRET
            or len(self.APP_SECRET.encode("utf-8")) < 32
            or len(set(self.APP_SECRET)) < 8
            or any(marker in self.APP_SECRET.lower() for marker in placeholder_markers)
        ):
            errors.append("APP_SECRET must be unique and at least 32 bytes")
        if (
            self.AI_ENCRYPTION_KEY == DEFAULT_AI_ENCRYPTION_KEY
            or len(self.AI_ENCRYPTION_KEY) != 64
            or len(set(self.AI_ENCRYPTION_KEY.lower())) < 16
            or any(
                marker in self.AI_ENCRYPTION_KEY.lower()
                for marker in placeholder_markers
            )
            or any(char not in "0123456789abcdefABCDEF" for char in self.AI_ENCRYPTION_KEY)
        ):
            errors.append("AI_ENCRYPTION_KEY must be a unique 64-character hexadecimal key")
        if (
            not self.DB_PASSWORD
            or any(
                marker in self.DB_PASSWORD.lower()
                for marker in placeholder_markers
            )
        ):
            errors.append("DB_PASSWORD must be set to a non-placeholder value")
        if self.DB_USER.strip().lower() == "root":
            errors.append("DB_USER must be a dedicated non-root account")

        origins = self.allowed_origins
        for origin in origins:
            parsed = urlsplit(origin)
            if (
                parsed.scheme != "https"
                or not parsed.hostname
                or parsed.hostname.lower() in {"localhost", "127.0.0.1", "::1"}
                or parsed.path not in {"", "/"}
                or parsed.query
                or parsed.fragment
            ):
                errors.append("FRONTEND_ORIGIN must contain only HTTPS site origins")
                break
        if not origins:
            errors.append("FRONTEND_ORIGIN must contain at least one site origin")

        if errors:
            raise ValueError(
                "Invalid production configuration: " + "; ".join(errors)
            )
        return self

    @property
    def database_url(self) -> str:
        return URL.create(
            "mysql+pymysql",
            username=self.DB_USER,
            password=self.DB_PASSWORD or None,
            host=self.DB_HOST,
            port=self.DB_PORT,
            database=self.DB_NAME,
            query={"charset": "utf8mb4"},
        ).render_as_string(hide_password=False)

    @property
    def allowed_origins(self) -> List[str]:
        return [origin.strip() for origin in self.FRONTEND_ORIGIN.split(",") if origin.strip()]

    class Config:
        env_file = str(BASE_DIR / ".env")
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
