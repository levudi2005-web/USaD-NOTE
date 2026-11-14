import uuid
import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.models import Document, Folder, Note, User
from app.schemas.schemas import NoteCreate, NoteResponse, NoteUpdate

router = APIRouter(prefix="/notes", tags=["Notes"])

def _validate_note_references(db: Session, user_id: str, folder_id: Optional[str], document_id: Optional[str]):
    if folder_id and not db.query(Folder).filter(
        Folder.id == folder_id,
        Folder.user_id == user_id,
    ).first():
        raise HTTPException(status_code=404, detail="Thư mục không tồn tại")

    if document_id and not db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == user_id,
        Document.is_deleted.is_(False),
    ).first():
        raise HTTPException(status_code=404, detail="Tài liệu không tồn tại")


@router.get("", response_model=list[NoteResponse])
def list_notes(
    folder_id: Optional[str] = None,
    document_id: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Note).filter(Note.user_id == user.id)
    if folder_id:
        query = query.filter(Note.folder_id == folder_id)
    if document_id:
        query = query.filter(Note.document_id == document_id)
    return query.order_by(Note.is_pinned.desc(), Note.updated_at.desc()).all()

@router.post("", response_model=NoteResponse)
def create_note(req: NoteCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    folder_id = req.folder_id or None
    document_id = req.document_id or None
    _validate_note_references(db, user.id, folder_id, document_id)
    note = Note(
        id=str(uuid.uuid4()),
        user_id=user.id,
        folder_id=folder_id,
        document_id=document_id,
        title=req.title,
        category=req.category,
        content=req.content,
        tags_json=json.dumps(req.tags, ensure_ascii=False),
        is_pinned=req.is_pinned,
        is_favorite=req.is_favorite
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note

@router.get("/{note_id}", response_model=NoteResponse)
def get_note(note_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id, Note.user_id == user.id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Ghi chú không tồn tại")
    return note

@router.put("/{note_id}", response_model=NoteResponse)
def update_note(note_id: str, req: NoteUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id, Note.user_id == user.id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Ghi chú không tồn tại")

    if req.title is not None:
        note.title = req.title
    if req.category is not None:
        note.category = req.category
    if req.content is not None:
        note.content = req.content
    if req.tags is not None:
        note.tags_json = json.dumps(req.tags, ensure_ascii=False)
    if req.folder_id is not None:
        note.folder_id = req.folder_id if req.folder_id != "" else None
    if req.document_id is not None:
        note.document_id = req.document_id if req.document_id != "" else None
    if req.is_pinned is not None:
        note.is_pinned = req.is_pinned
    if req.is_favorite is not None:
        note.is_favorite = req.is_favorite

    _validate_note_references(db, user.id, note.folder_id, note.document_id)
    db.commit()
    db.refresh(note)
    return note

@router.delete("/{note_id}")
def delete_note(note_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id, Note.user_id == user.id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Ghi chú không tồn tại")

    db.delete(note)
    db.commit()
    return {"message": "Xóa ghi chú thành công"}
