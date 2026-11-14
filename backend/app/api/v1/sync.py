import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.models import (
    ActivityLog, AiConnection, AiContext, Archive, Collection,
    Document, FlashcardDeck, Folder, Note, Notification, Quiz, SharedLink, User
)

router = APIRouter(prefix="/sync", tags=["Sync & Bootstrap"])

@router.get("/bootstrap")
def bootstrap_workspace(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Returns the complete real workspace state from MariaDB for the authenticated user.
    """
    folders = db.query(Folder).filter(Folder.user_id == user.id).all()
    documents = db.query(Document).filter(Document.user_id == user.id, Document.deleted_at.is_(None)).all()
    notes = db.query(Note).filter(Note.user_id == user.id).all()
    collections = db.query(Collection).filter(Collection.user_id == user.id).all()
    archives = db.query(Archive).filter(Archive.user_id == user.id).all()
    connections = db.query(AiConnection).filter(AiConnection.user_id == user.id).all()
    contexts = db.query(AiContext).filter(AiContext.user_id == user.id).all()
    decks = db.query(FlashcardDeck).filter(FlashcardDeck.user_id == user.id).all()
    quizzes = db.query(Quiz).filter(Quiz.user_id == user.id).all()
    shared_links = db.query(SharedLink).filter(SharedLink.user_id == user.id).all()
    notifications = db.query(Notification).filter(Notification.user_id == user.id).order_by(Notification.created_at.desc()).limit(10).all()
    activity = db.query(ActivityLog).filter(ActivityLog.user_id == user.id).order_by(ActivityLog.created_at.desc()).limit(15).all()

    return {
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "avatar_url": user.avatar_url,
            "title": user.title,
            "bio": user.bio,
            "theme_preference": user.theme_preference,
            "language": user.language,
            "storage_used": user.storage_used,
            "storage_limit": user.storage_limit
        },
        "folders": [
            {
                "id": f.id,
                "name": f.name,
                "parentId": f.parent_id,
                "color": f.color,
                "icon": f.icon
            } for f in folders
        ],
        "documents": [
            {
                "id": d.id,
                "name": d.name,
                "originalName": d.original_name,
                "type": d.file_type,
                "folderId": d.folder_id,
                "size": d.file_size,
                "summary": d.summary,
                "starred": d.is_starred,
                "isArchived": d.is_archived,
                "addedAt": d.created_at.isoformat()
            } for d in documents
        ],
        "notes": [
            {
                "id": n.id,
                "title": n.title,
                "category": n.category,
                "folderId": n.folder_id,
                "documentId": n.document_id,
                "content": n.content,
                "tags": n.tags,
                "pinned": n.is_pinned,
                "favorite": n.is_favorite,
                "updatedAt": n.updated_at.isoformat()
            } for n in notes
        ],
        "collections": [
            {
                "id": c.id,
                "name": c.name,
                "description": c.description,
                "color": c.color,
                "tags": c.tags,
                "itemCount": len(c.items),
                "items": [
                    {
                        "id": it.id,
                        "documentId": it.document_id,
                        "noteId": it.note_id,
                        "deckId": it.deck_id
                    } for it in c.items
                ],
                "updatedAt": c.updated_at.isoformat()
            } for c in collections
        ],
        "archives": [
            {
                "id": a.id,
                "name": a.name,
                "originalName": a.original_name,
                "format": a.format,
                "size": a.file_size,
                "uncompressedSize": a.uncompressed_size,
                "ratio": round(a.uncompressed_size / a.file_size, 2) if a.file_size > 0 else 1.0,
                "fileCount": a.file_count,
                "manifest": json.loads(a.manifest_json) if a.manifest_json else [],
                "uploadedAt": a.created_at.isoformat()
            } for a in archives
        ],
        "aiConnections": [
            {
                "id": cn.id,
                "name": cn.name,
                "provider": cn.provider.id if cn.provider else cn.provider_id,
                "providerName": cn.provider.name if cn.provider else "Custom",
                "defaultModelId": cn.default_model_id,
                "defaultModel": cn.default_model.id if cn.default_model else None,
                "models": [model.id for model in cn.provider.models] if cn.provider else [],
                "apiKeyMasked": cn.api_key_masked,
                "isConnected": cn.is_connected,
                "customEndpoint": cn.api_endpoint,
                "lastTestedAt": cn.last_tested_at.isoformat() if cn.last_tested_at else None
            } for cn in connections
        ],
        "aiContexts": [
            {
                "id": ctx.id,
                "title": ctx.title,
                "version": ctx.current_version,
                "summary": ctx.summary,
                "insights": json.loads(ctx.knowledge_points_json or "[]"),
                "openQuestions": json.loads(ctx.open_questions_json or "[]"),
                "handoffDirective": ctx.handoff_directive or "",
                "sources": [],
                "progress": ctx.learning_progress,
                "versions": [
                    {
                        "version": version.version_tag,
                        "at": version.created_at.isoformat(),
                        "note": version.change_note or ""
                    } for version in ctx.versions
                ],
                "updatedAt": ctx.updated_at.isoformat()
            } for ctx in contexts
        ],
        "flashcards": {
            "decks": [
                {
                    "id": d.id,
                    "name": d.name,
                    "description": d.description,
                    "color": d.color,
                    "documentId": d.document_id,
                    "cards": [
                        {
                            "id": c.id,
                            "front": c.front_text,
                            "back": c.back_text,
                            "box": 1,
                            "isKnown": c.is_known,
                            "nextReview": c.last_reviewed_at.isoformat() if c.last_reviewed_at else c.created_at.isoformat()
                        } for c in d.cards
                    ]
                } for d in decks
            ]
        },
        "quizzes": [
            {
                "id": q.id,
                "title": q.title,
                "description": q.description,
                "timeLimit": q.time_limit_sec // 60,
                "passingScore": q.passing_score,
                "questionsCount": len(q.questions),
                "questions": [
                    {
                        "id": qu.id,
                        "text": qu.question_text,
                        "type": qu.question_type,
                        "options": [
                            {
                                "id": op.id,
                                "text": op.option_text,
                                "isCorrect": op.is_correct
                            } for op in qu.options
                        ]
                    } for qu in q.questions
                ]
            } for q in quizzes
        ],
        "sharedLinks": [
            {
                "id": sl.id,
                "documentId": sl.document_id,
                "shareName": sl.title,
                "allowDownload": sl.allow_download,
                "views": sl.views_count,
                "isRevoked": sl.is_revoked,
                "expiresAt": sl.expires_at.isoformat() if sl.expires_at else None,
                "createdAt": sl.created_at.isoformat()
            } for sl in shared_links
        ],
        "notifications": [
            {
                "id": n.id,
                "title": n.title,
                "message": n.message,
                "type": n.type,
                "icon": n.icon,
                "read": n.is_read,
                "at": n.created_at.isoformat()
            } for n in notifications
        ],
        "activity": [
            {
                "id": f"act-{a.id}",
                "text": a.description,
                "at": a.created_at.isoformat()
            } for a in activity
        ]
    }
