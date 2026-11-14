from fastapi import APIRouter
from app.api.v1 import (
    ai, archives, auth, collections, documents, flashcards, folders, notes,
    quizzes, settings, sharing, sync
)

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(folders.router)
api_router.include_router(documents.router)
api_router.include_router(notes.router)
api_router.include_router(collections.router)
api_router.include_router(archives.router)
api_router.include_router(ai.router)
api_router.include_router(flashcards.router)
api_router.include_router(quizzes.router)
api_router.include_router(sharing.router)
api_router.include_router(settings.router)
api_router.include_router(sync.router)
