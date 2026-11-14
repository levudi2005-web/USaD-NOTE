from unittest.mock import Mock

import pytest
from fastapi import Request
from pydantic import ValidationError
from sqlalchemy.exc import OperationalError

from app.core.config import Settings
from app.main import database_operational_error_handler, health_check


def test_settings_reject_tidb_cloud_hosts():
    with pytest.raises(ValidationError, match="requires MariaDB"):
        Settings(DB_HOST="gateway.tidbcloud.com", _env_file=None)


def test_settings_builds_mysql_protocol_url_from_mariadb_fields():
    settings = Settings(
        DB_HOST="127.0.0.1",
        DB_PORT=3306,
        DB_NAME="note_db",
        DB_USER="note_app",
        DB_PASSWORD="",
        _env_file=None,
    )

    assert settings.database_url.startswith(
        "mysql+pymysql://note_app@127.0.0.1:3306/note_db"
    )
    assert "DATABASE_URL" not in Settings.model_fields


def test_production_settings_reject_development_defaults():
    with pytest.raises(ValidationError, match="Invalid production configuration"):
        Settings(APP_ENV="production", _env_file=None)


def test_production_settings_accept_secure_values():
    settings = Settings(
        APP_ENV="production",
        DB_USER="note_app",
        DB_PASSWORD="a-long-random-database-password",
        APP_SECRET="A1b2C3d4E5f6G7h8" * 3,
        AI_ENCRYPTION_KEY="9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
        FRONTEND_ORIGIN="https://notes.example.com",
        _env_file=None,
    )

    assert settings.allowed_origins == ["https://notes.example.com"]


def test_db_connection_failure_is_reported_as_service_unavailable(monkeypatch):
    db = Mock()
    db.execute.side_effect = OperationalError(
        "SELECT VERSION(), DATABASE()",
        {},
        Exception(2003, "connection refused"),
    )
    monkeypatch.setattr("app.main.SessionLocal", lambda: db)

    response = health_check()

    assert response.status_code == 503
    assert db.close.called


def test_bootstrap_connection_failure_returns_503():
    request = Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/api/v1/sync/bootstrap",
            "headers": [],
        }
    )
    error = OperationalError(
        "SELECT 1",
        {},
        Exception(2003, "connection refused"),
    )

    response = database_operational_error_handler(request, error)

    assert response.status_code == 503
