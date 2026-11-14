import logging
import json
import os
import uuid
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.core.config import settings
from app.database.session import get_db
from app.models.models import Archive, ArchiveExtractedFile, Document, Folder, User
from app.schemas.schemas import ArchiveExtractRequest, ArchiveResponse
from app.storage.file_storage import read_upload_content, storage_manager
from app.storage.quota import calculate_storage_usage

router = APIRouter(prefix="/archives", tags=["Archives"])
logger = logging.getLogger(__name__)

@router.get("", response_model=list[ArchiveResponse])
def list_archives(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Archive).filter(Archive.user_id == user.id).order_by(Archive.created_at.desc()).all()

@router.post("/upload", response_model=ArchiveResponse)
async def upload_archive(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in [".zip", ".7z"]:
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ tệp định dạng .zip hoặc .7z")

    current_usage = calculate_storage_usage(db, user)
    remaining_storage = user.storage_limit - current_usage
    if remaining_storage <= 0:
        raise HTTPException(status_code=413, detail="Hạn mức lưu trữ tài khoản đã đầy.")
    max_upload_bytes = min(settings.MAX_UPLOAD_BYTES, remaining_storage)
    try:
        content = await read_upload_content(file, max_upload_bytes)
    except ValueError as exc:
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
    if current_usage + len(content) > locked_user.storage_limit:
        raise HTTPException(status_code=413, detail="Hạn mức lưu trữ tài khoản đã đầy.")

    filename = filename or f"archive{ext}"
    rel_path, abs_path, size, checksum = storage_manager.save_upload_file(
        filename, content, category="archives"
    )

    try:
        manifest, uncompressed_size, ratio = storage_manager.inspect_archive(abs_path, ext)
    except ValueError as exc:
        storage_manager.get_absolute_path(rel_path).unlink(missing_ok=True)
        logger.warning("Rejected archive upload for user %s: %s", user.id, exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        storage_manager.get_absolute_path(rel_path).unlink(missing_ok=True)
        logger.exception("Could not inspect archive uploaded by user %s", user.id)
        raise HTTPException(
            status_code=400,
            detail="Không thể đọc gói nén hoặc gói nén không hợp lệ.",
        ) from exc

    archive = Archive(
        id=str(uuid.uuid4()),
        user_id=user.id,
        name=filename,
        original_name=filename,
        format=ext.lstrip("."),
        file_size=size,
        uncompressed_size=uncompressed_size,
        max_ratio=ratio,
        file_count=len(manifest),
        storage_path=rel_path,
        sha256_checksum=checksum,
        scan_status="clean",
        manifest_json=json.dumps(manifest, ensure_ascii=False)
    )
    db.add(archive)
    locked_user.storage_used = current_usage + size
    try:
        db.commit()
    except Exception:
        db.rollback()
        try:
            storage_manager.get_absolute_path(rel_path).unlink(missing_ok=True)
        except OSError:
            logger.exception("Could not remove uncommitted archive upload")
        raise
    db.refresh(archive)
    return archive

@router.get("/{archive_id}/manifest")
def get_archive_manifest(archive_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    arch = db.query(Archive).filter(Archive.id == archive_id, Archive.user_id == user.id).first()
    if not arch:
        raise HTTPException(status_code=404, detail="Gói nén không tồn tại")

    manifest = json.loads(arch.manifest_json) if arch.manifest_json else []
    extracted = db.query(ArchiveExtractedFile).filter(ArchiveExtractedFile.archive_id == arch.id).all()
    extracted_paths = [e.inner_path for e in extracted]

    return {
        "id": arch.id,
        "name": arch.name,
        "format": arch.format,
        "file_size": arch.file_size,
        "uncompressed_size": arch.uncompressed_size,
        "compression_ratio": arch.compression_ratio,
        "file_count": arch.file_count,
        "manifest": manifest,
        "extracted_paths": extracted_paths
    }

@router.post("/{archive_id}/extract")
def extract_archive_files(
    archive_id: str,
    req: ArchiveExtractRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    arch = db.query(Archive).filter(Archive.id == archive_id, Archive.user_id == user.id).first()
    if not arch:
        raise HTTPException(status_code=404, detail="Gói nén không tồn tại")

    if req.target_folder_id:
        folder = db.query(Folder).filter(
            Folder.id == req.target_folder_id,
            Folder.user_id == user.id
        ).first()
        if not folder:
            raise HTTPException(status_code=404, detail="Thư mục không tồn tại")

    requested_paths = list(dict.fromkeys(req.inner_paths))
    if not requested_paths:
        raise HTTPException(status_code=400, detail="Hãy chọn ít nhất một tệp để giải nén.")
    manifest = json.loads(arch.manifest_json) if arch.manifest_json else []
    files_by_path = {
        item["path"]: item
        for item in manifest
        if not item.get("is_dir")
    }
    if any(path not in files_by_path for path in requested_paths):
        raise HTTPException(status_code=400, detail="Danh sách tệp giải nén không hợp lệ.")
    requested_size = sum(int(files_by_path[path]["size"]) for path in requested_paths)
    if requested_size > settings.MAX_ARCHIVE_UNCOMPRESSED_BYTES:
        raise HTTPException(status_code=413, detail="Tổng dung lượng giải nén vượt quá giới hạn.")

    current_usage = calculate_storage_usage(db, user)
    if current_usage + requested_size > user.storage_limit:
        raise HTTPException(status_code=413, detail="Hạn mức lưu trữ tài khoản không đủ.")

    abs_arch_path = storage_manager.get_absolute_path(arch.storage_path)
    if not abs_arch_path.exists():
        raise HTTPException(status_code=404, detail="Tệp nén gốc không còn tồn tại trên máy chủ")

    ext = f".{arch.format.lower()}"
    try:
        results = storage_manager.extract_selective(
            str(abs_arch_path), ext, requested_paths
        )
    except Exception as exc:
        logger.exception("Could not extract archive %s for user %s", arch.id, user.id)
        raise HTTPException(
            status_code=500,
            detail="Không thể giải nén gói tin. Hãy kiểm tra tệp và thử lại.",
        ) from exc

    extracted_size = sum(result["file_size"] for result in results)
    locked_user = (
        db.query(User)
        .filter(User.id == user.id)
        .with_for_update()
        .first()
    )
    if not locked_user:
        storage_manager.remove_saved_files(results)
        raise HTTPException(status_code=401, detail="Người dùng không tồn tại")
    current_usage = calculate_storage_usage(db, locked_user)
    if current_usage + extracted_size > locked_user.storage_limit:
        storage_manager.remove_saved_files(results)
        raise HTTPException(status_code=413, detail="Hạn mức lưu trữ tài khoản không đủ.")

    extracted_docs = []
    for r in results:
        doc_id = str(uuid.uuid4())
        doc_ext = os.path.splitext(r["filename"])[1].lower().lstrip(".")
        doc = Document(
            id=doc_id,
            user_id=user.id,
            folder_id=req.target_folder_id if req.target_folder_id else None,
            name=r["filename"],
            original_name=r["filename"],
            file_type=doc_ext or "bin",
            mime_type="application/octet-stream",
            file_size=r["file_size"],
            storage_path=r["storage_path"],
            sha256_checksum=r["sha256"]
        )
        db.add(doc)

        # Track extraction link
        link = ArchiveExtractedFile(
            archive_id=arch.id,
            document_id=doc_id,
            inner_path=r["inner_path"]
        )
        db.add(link)
        extracted_docs.append(doc_id)

    try:
        db.commit()
    except Exception:
        db.rollback()
        try:
            storage_manager.remove_saved_files(results)
        except OSError:
            logger.exception("Could not remove uncommitted extracted files")
        raise
    return {
        "message": f"Đã giải nén thành công {len(extracted_docs)} tệp tin vào thư viện tài liệu",
        "document_ids": extracted_docs
    }

@router.get("/{archive_id}/download")
def download_archive(archive_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    arch = db.query(Archive).filter(Archive.id == archive_id, Archive.user_id == user.id).first()
    if not arch:
        raise HTTPException(status_code=404, detail="Gói nén không tồn tại")

    abs_path = storage_manager.get_absolute_path(arch.storage_path)
    if not abs_path.exists():
        raise HTTPException(status_code=404, detail="Tệp nén vật lý không tồn tại")

    return FileResponse(path=str(abs_path), filename=arch.name)

@router.delete("/{archive_id}")
def delete_archive(archive_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    arch = db.query(Archive).filter(Archive.id == archive_id, Archive.user_id == user.id).first()
    if not arch:
        raise HTTPException(status_code=404, detail="Gói nén không tồn tại")

    current_usage = calculate_storage_usage(db, user)
    try:
        abs_path = storage_manager.get_absolute_path(arch.storage_path)
        if abs_path.exists():
            abs_path.unlink()
    except (OSError, ValueError) as exc:
        logger.exception("Could not remove stored archive %s", arch.id)
        raise HTTPException(
            status_code=500,
            detail="Không thể xóa gói nén khỏi kho lưu trữ.",
        ) from exc

    db.delete(arch)
    user.storage_used = max(0, current_usage - arch.file_size)
    try:
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Could not delete archive record %s after file removal", arch.id)
        raise HTTPException(
            status_code=500,
            detail="Không thể hoàn tất xóa gói nén.",
        )
    return {"message": "Xóa gói nén thành công"}
