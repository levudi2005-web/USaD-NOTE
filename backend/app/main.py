import logging

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import (
    OperationalError,
    SQLAlchemyError,
    TimeoutError as SQLAlchemyTimeoutError,
)
from app.api.v1.router import api_router
from app.core.config import settings
from app.database.session import SessionLocal

logger = logging.getLogger(__name__)

app = FastAPI(
    title="NOTE Backend API",
    description="Production-grade REST API for NOTE workspace management and AI learning platform",
    version="1.0.0"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {
        "app": "NOTE Workspace API",
        "version": "1.0.0",
        "status": "online",
        "docs_url": "/docs"
    }

@app.get("/api/v1/health")
def health_check():
    """Verify backend and MariaDB database connectivity."""
    db = SessionLocal()
    try:
        db_version, db_name = db.execute(
            text("SELECT VERSION(), DATABASE()")
        ).one()
    except SQLAlchemyError:
        logger.error(
            "Database health check failed",
            exc_info=True,
        )
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "degraded",
                "database": {"status": "unavailable"},
            },
        )
    finally:
        db.close()

    return {
        "status": "healthy",
        "database": {
            "status": "connected",
            "version": db_version,
            "name": db_name,
        }
    }

# Mount v1 router
app.include_router(api_router)

# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(
        "Unhandled exception while handling %s",
        request.url.path,
        exc_info=(type(exc), exc, exc.__traceback__),
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Lỗi máy chủ nội bộ"}
    )


@app.exception_handler(OperationalError)
def database_operational_error_handler(
    request: Request, exc: OperationalError
):
    original = exc.orig
    error_code = (
        original.args[0]
        if getattr(original, "args", None)
        else None
    )
    unavailable_codes = {
        1040, 1044, 1045, 1049, 2002, 2003, 2006, 2013, 2055,
    }
    if not exc.connection_invalidated and error_code not in unavailable_codes:
        logger.error(
            "Database operation failed while handling %s",
            request.url.path,
            exc_info=(type(exc), exc, exc.__traceback__),
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Lỗi máy chủ nội bộ"},
        )

    logger.error(
        "MariaDB connection failure while handling %s",
        request.url.path,
        exc_info=(type(exc), exc, exc.__traceback__),
    )
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "detail": "MariaDB không khả dụng hoặc cấu hình kết nối không hợp lệ."
        },
    )


@app.exception_handler(SQLAlchemyTimeoutError)
def database_pool_timeout_handler(
    request: Request, exc: SQLAlchemyTimeoutError
):
    logger.error(
        "MariaDB connection pool exhausted on %s",
        request.url.path,
        exc_info=(type(exc), exc, exc.__traceback__),
    )
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"detail": "Cơ sở dữ liệu đang quá tải. Vui lòng thử lại sau."},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.BACKEND_HOST, port=settings.BACKEND_PORT, reload=True)
