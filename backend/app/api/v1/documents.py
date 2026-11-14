import asyncio
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool
from app.api.deps import get_current_user
from app.core.config import settings
from app.database.session import get_db
from app.models.models import Document, Folder, User
from app.schemas.schemas import DocumentResponse, DocumentUpdate
from app.storage.file_storage import (
    UploadTooLargeError,
    save_upload_stream,
    storage_manager,
)
from app.storage.quota import calculate_storage_usage

router = APIRouter(prefix="/documents", tags=["Documents"])
logger = logging.getLogger(__name__)
_upload_semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_DOCUMENT_UPLOADS)

_DOCUMENT_MIME_TYPES = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "xls": "application/vnd.ms-excel",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "epub": "application/epub+zip",
    "txt": "text/plain",
    "md": "text/markdown",
    "csv": "text/csv",
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "webp": "image/webp",
    "bmp": "image/bmp",
    "zip": "application/zip",
    "7z": "application/x-7z-compressed",
}


def _validate_document_signature(
    extension: str, signature: bytes, contains_nul: bool
) -> None:
    if extension in {"txt", "md"}:
        valid = not contains_nul
    elif extension == "pdf":
        valid = signature.startswith(b"%PDF-")
    elif extension == "xls":
        valid = signature.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1")
    elif extension in {"docx", "xlsx", "pptx", "epub", "zip"}:
        valid = signature.startswith(b"PK")
    elif extension == "png":
        valid = signature.startswith(b"\x89PNG\r\n\x1a\n")
    elif extension in {"jpg", "jpeg"}:
        valid = signature.startswith(b"\xff\xd8\xff")
    elif extension == "webp":
        valid = signature.startswith(b"RIFF") and signature[8:12] == b"WEBP"
    elif extension == "bmp":
        valid = signature.startswith(b"BM")
    elif extension == "7z":
        valid = signature.startswith(b"7z\xbc\xaf\x27\x1c")
    else:
        valid = False

    if not valid:
        raise HTTPException(status_code=415, detail="Nội dung tệp không khớp định dạng.")

@router.get("", response_model=list[DocumentResponse])
def list_documents(
    folder_id: Optional[str] = None,
    is_starred: Optional[bool] = None,
    is_deleted: bool = False,
    search: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Document).filter(
        Document.user_id == user.id,
        Document.is_deleted == is_deleted
    )

    if folder_id is not None:
        if folder_id == "root" or folder_id == "":
            query = query.filter(Document.folder_id.is_(None))
        else:
            query = query.filter(Document.folder_id == folder_id)

    if is_starred is not None:
        query = query.filter(Document.is_starred == is_starred)

    if search:
        s = f"%{search.strip()}%"
        query = query.filter(Document.name.ilike(s))

    return query.order_by(Document.created_at.desc()).all()

@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    folder_id: Optional[str] = Form(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    filename = file.filename or "upload"
    ext = os.path.splitext(filename)[1].lower().lstrip(".")
    if ext not in _DOCUMENT_MIME_TYPES:
        raise HTTPException(status_code=415, detail="Định dạng tệp không được hỗ trợ.")

    async with _upload_semaphore:
        if folder_id and folder_id != "" and folder_id != "null":
            folder = db.query(Folder).filter(
                Folder.id == folder_id,
                Folder.user_id == user.id,
            ).first()
            if not folder:
                raise HTTPException(status_code=404, detail="Thư mục không tồn tại")
        else:
            folder_id = None

        current_usage = calculate_storage_usage(db, user)
        remaining_storage = user.storage_limit - current_usage
        if remaining_storage <= 0:
            raise HTTPException(status_code=413, detail="Hạn mức lưu trữ tài khoản đã đầy.")
        max_upload_bytes = min(settings.MAX_UPLOAD_BYTES, remaining_storage)

        content_length = request.headers.get("content-length") if request else None
        if content_length is not None:
            try:
                declared_length = int(content_length)
            except ValueError as exc:
                raise HTTPException(
                    status_code=400,
                    detail="Content-Length không hợp lệ.",
                ) from exc
            if declared_length < 0:
                raise HTTPException(status_code=400, detail="Content-Length không hợp lệ.")
            if declared_length > max_upload_bytes:
                raise HTTPException(
                    status_code=413,
                    detail="Tệp vượt quá giới hạn tải lên hoặc dung lượng còn lại.",
                )

        rel_path = None
        committed = False
        try:
            try:
                rel_path, _, size, checksum = await save_upload_stream(
                    file,
                    filename,
                    max_upload_bytes,
                    lambda signature, contains_nul: _validate_document_signature(
                        ext, signature, contains_nul
                    ),
                )
            except UploadTooLargeError as exc:
                raise HTTPException(
                    status_code=413,
                    detail="Tệp vượt quá giới hạn tải lên hoặc dung lượng còn lại.",
                ) from exc

            locked_user = (
                db.query(User)
                .filter(User.id == user.id)
                .with_for_update()
                .first()
            )
            if not locked_user:
                raise HTTPException(status_code=401, detail="Người dùng không tồn tại")
            current_usage = calculate_storage_usage(db, locked_user)
            if current_usage + size > locked_user.storage_limit:
                raise HTTPException(status_code=413, detail="Hạn mức lưu trữ tài khoản đã đầy.")

            mime = _DOCUMENT_MIME_TYPES[ext]
            extracted = await run_in_threadpool(
                storage_manager.read_document_content,
                rel_path,
                mime,
            )

            doc = Document(
                id=str(uuid.uuid4()),
                user_id=user.id,
                folder_id=folder_id,
                name=filename,
                original_name=filename,
                file_type=ext,
                mime_type=mime,
                file_size=size,
                storage_path=rel_path,
                sha256_checksum=checksum,
                extracted_text=extracted[:50000] if extracted else None,
            )
            db.add(doc)
            db.commit()
            committed = True
            db.refresh(doc)
            return doc
        except Exception:
            if not committed:
                if rel_path:
                    try:
                        storage_manager.get_absolute_path(rel_path).unlink(missing_ok=True)
                    except (OSError, ValueError):
                        logger.exception("Could not remove uncommitted document upload")
                db.rollback()
            raise

@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(document_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == document_id, Document.user_id == user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Tài liệu không tồn tại")
    return doc

@router.get("/{document_id}/content")
def get_document_content(document_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == document_id, Document.user_id == user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Tài liệu không tồn tại")

    content = storage_manager.read_document_content(doc.storage_path, doc.mime_type)
    return {
        "id": doc.id,
        "name": doc.name,
        "file_type": doc.file_type,
        "content": content
    }

@router.get("/{document_id}/download")
def download_document(document_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == document_id, Document.user_id == user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Tài liệu không tồn tại")

    abs_path = storage_manager.get_absolute_path(doc.storage_path)
    if not abs_path.exists():
        raise HTTPException(status_code=404, detail="Tệp tin vật lý không tồn tại trên máy chủ")

    return FileResponse(path=str(abs_path), filename=doc.original_name, media_type=doc.mime_type)

@router.put("/{document_id}", response_model=DocumentResponse)
def update_document(
    document_id: str,
    req: DocumentUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(Document).filter(Document.id == document_id, Document.user_id == user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Tài liệu không tồn tại")

    if req.name is not None:
        doc.name = req.name
    if req.folder_id is not None:
        if req.folder_id == "root" or req.folder_id == "":
            doc.folder_id = None
        else:
            folder = db.query(Folder).filter(Folder.id == req.folder_id, Folder.user_id == user.id).first()
            if not folder:
                raise HTTPException(status_code=404, detail="Thư mục không tồn tại")
            doc.folder_id = folder.id
    if req.is_starred is not None:
        doc.is_starred = req.is_starred
    if req.is_archived is not None:
        doc.is_archived = req.is_archived
    if req.summary is not None:
        doc.summary = req.summary

    db.commit()
    db.refresh(doc)
    return doc

@router.delete("/{document_id}")
def soft_delete_document(document_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == document_id, Document.user_id == user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Tài liệu không tồn tại")

    doc.is_deleted = True
    doc.deleted_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    return {"message": "Đã chuyển tài liệu vào thùng rác"}

@router.post("/{document_id}/restore", response_model=DocumentResponse)
def restore_document(document_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == document_id, Document.user_id == user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Tài liệu không tồn tại")

    doc.is_deleted = False
    doc.deleted_at = None
    db.commit()
    db.refresh(doc)
    return doc

@router.delete("/{document_id}/permanent")
def permanent_delete_document(document_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == document_id, Document.user_id == user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Tài liệu không tồn tại")

    try:
        abs_path = storage_manager.get_absolute_path(doc.storage_path)
        if abs_path.exists():
            abs_path.unlink()
    except (OSError, ValueError) as exc:
        logger.exception("Could not remove stored document %s", doc.id)
        raise HTTPException(
            status_code=500,
            detail="Không thể xóa tệp khỏi kho lưu trữ.",
        ) from exc

    db.delete(doc)
    db.commit()
    return {"message": "Đã xóa vĩnh viễn tài liệu khỏi hệ thống"}
