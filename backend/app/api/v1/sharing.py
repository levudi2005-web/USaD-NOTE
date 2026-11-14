import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.core.security import hash_password, hash_sha256, verify_password
from app.database.session import get_db
from app.models.models import Document, ShareAccessLog, SharedLink, User
from app.schemas.schemas import (
    SharedLinkAccessRequest, SharedLinkCreate, SharedLinkResponse, SharedLinkUpdate
)
from app.storage.file_storage import storage_manager

router = APIRouter(tags=["Sharing"])

def _find_link_by_token(db: Session, token: str) -> Optional[SharedLink]:
    return db.query(SharedLink).filter(
        SharedLink.token_hash == hash_sha256(token)
    ).first()


def _ensure_link_active(link: SharedLink, now: datetime) -> None:
    if link.is_revoked:
        raise HTTPException(status_code=410, detail="Liên kết chia sẻ này đã bị thu hồi")
    if link.expires_at and link.expires_at <= now:
        raise HTTPException(status_code=410, detail="Liên kết chia sẻ đã hết hạn")


def _verify_link_password(
    link: SharedLink,
    password: Optional[str],
    db: Session,
    now: datetime,
) -> None:
    if link.pass_locked_until and link.pass_locked_until > now:
        raise HTTPException(status_code=429, detail="Liên kết đang tạm khóa do nhập sai mật khẩu")
    if not link.password_hash:
        return
    if not password:
        raise HTTPException(status_code=401, detail="Liên kết này được bảo vệ bằng mật khẩu")
    if not verify_password(password, link.password_hash):
        link.failed_pass_attempts += 1
        if link.failed_pass_attempts >= 5:
            link.pass_locked_until = now + timedelta(minutes=15)
        db.commit()
        raise HTTPException(status_code=401, detail="Mật khẩu truy cập không chính xác")

    link.failed_pass_attempts = 0
    link.pass_locked_until = None


def _link_response(link: SharedLink, token: Optional[str] = None) -> SharedLinkResponse:
    return SharedLinkResponse(
        id=link.id,
        document_id=link.document_id,
        token=token,
        share_url=f"/share/?token={token}" if token else None,
        share_name=link.title,
        allow_download=link.allow_download,
        view_count=link.views_count,
        has_password=bool(link.password_hash),
        is_revoked=link.is_revoked,
        expires_at=link.expires_at,
        created_at=link.created_at,
    )


def _normalize_expiry(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    aware_value = value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value
    expires_at = aware_value.astimezone(timezone.utc).replace(tzinfo=None)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if expires_at <= now or expires_at > now + timedelta(days=365):
        raise HTTPException(
            status_code=400,
            detail="Thời hạn chia sẻ phải nằm trong 365 ngày tới.",
        )
    return expires_at


@router.get("/sharing", response_model=list[SharedLinkResponse])
def list_shared_links(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    links = db.query(SharedLink).filter(SharedLink.user_id == user.id).order_by(SharedLink.created_at.desc()).all()
    return [_link_response(link) for link in links]

@router.post("/sharing", response_model=SharedLinkResponse)
def create_shared_link(req: SharedLinkCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = db.query(Document).filter(
        Document.id == req.document_id,
        Document.user_id == user.id,
        Document.is_deleted.is_(False),
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Tài liệu không tồn tại")

    token_secret = secrets.token_urlsafe(32)
    token_hash = hash_sha256(token_secret)
    pw_hash = hash_password(req.password) if req.password else None

    if "expires_at" in req.model_fields_set:
        expires = _normalize_expiry(req.expires_at)
    else:
        expires = (
            datetime.now(timezone.utc).replace(tzinfo=None)
            + timedelta(days=req.expires_in_days)
            if req.expires_in_days
            else None
        )

    link_id = str(uuid.uuid4())
    link = SharedLink(
        id=link_id,
        user_id=user.id,
        document_id=doc.id,
        token_hash=token_hash,
        title=req.share_name or f"Chia sẻ: {doc.name}",
        password_hash=pw_hash,
        allow_download=req.allow_download,
        expires_at=expires
    )
    db.add(link)
    db.commit()
    db.refresh(link)

    return _link_response(link, token_secret)


@router.put("/sharing/{link_id}", response_model=SharedLinkResponse)
def update_shared_link(
    link_id: str,
    req: SharedLinkUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    link = db.query(SharedLink).filter(
        SharedLink.id == link_id,
        SharedLink.user_id == user.id,
    ).first()
    if not link:
        raise HTTPException(status_code=404, detail="Liên kết chia sẻ không tồn tại")

    changes = req.model_dump(exclude_unset=True)
    if "share_name" in changes:
        link.title = changes["share_name"]
    if "allow_download" in changes:
        link.allow_download = changes["allow_download"]
    if "expires_at" in changes:
        link.expires_at = _normalize_expiry(changes["expires_at"])
    elif "expires_in_days" in changes:
        days = changes["expires_in_days"]
        link.expires_at = (
            datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=days)
            if days
            else None
        )
    if "password" in changes:
        link.password_hash = hash_password(changes["password"]) if changes["password"] else None
        link.failed_pass_attempts = 0
        link.pass_locked_until = None

    db.commit()
    db.refresh(link)
    return _link_response(link)


@router.post("/sharing/{link_id}/rotate", response_model=SharedLinkResponse)
def rotate_shared_link(
    link_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    link = db.query(SharedLink).filter(
        SharedLink.id == link_id,
        SharedLink.user_id == user.id,
    ).first()
    if not link:
        raise HTTPException(status_code=404, detail="Liên kết chia sẻ không tồn tại")

    token_secret = secrets.token_urlsafe(32)
    link.token_hash = hash_sha256(token_secret)
    link.is_revoked = False
    link.failed_pass_attempts = 0
    link.pass_locked_until = None
    db.commit()
    db.refresh(link)
    return _link_response(link, token_secret)

@router.delete("/sharing/{link_id}")
def revoke_shared_link(link_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    link = db.query(SharedLink).filter(SharedLink.id == link_id, SharedLink.user_id == user.id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Liên kết chia sẻ không tồn tại")

    link.is_revoked = True
    db.commit()
    return {"message": "Đã thu hồi liên kết chia sẻ"}

# PUBLIC ACCESS (NO AUTH REQUIRED)
@router.post("/public/share/{token}")
def access_shared_document(
    token: str,
    req: Optional[SharedLinkAccessRequest] = None,
    request: Request = None,
    db: Session = Depends(get_db)
):
    link = _find_link_by_token(db, token)
    if not link:
        raise HTTPException(status_code=404, detail="Liên kết chia sẻ không hợp lệ hoặc không tồn tại")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    _ensure_link_active(link, now)
    _verify_link_password(link, req.password if req else None, db, now)

    doc = db.query(Document).filter(
        Document.id == link.document_id,
        Document.user_id == link.user_id,
        Document.is_deleted.is_(False),
    ).first()
    if not doc or doc.is_deleted:
        raise HTTPException(status_code=404, detail="Tài liệu được chia sẻ không còn khả dụng")

    link.views_count += 1
    ip = request.client.host if request and request.client else "127.0.0.1"
    ua = request.headers.get("user-agent", "")[:255] if request else ""
    log = ShareAccessLog(shared_link_id=link.id, ip_address=ip, user_agent=ua, action="view")
    db.add(log)
    db.commit()

    content = storage_manager.read_document_content(doc.storage_path, doc.mime_type)

    return {
        "document_name": doc.name,
        "file_type": doc.file_type,
        "file_size": doc.file_size,
        "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
        "allow_download": link.allow_download,
        "share_name": link.title,
        "content": content,
        "download_url": f"/api/v1/public/share/{token}/download" if link.allow_download else None
    }

def _download_shared_document(
    token: str,
    password: Optional[str],
    request: Request,
    db: Session,
):
    link = _find_link_by_token(db, token)
    if not link:
        raise HTTPException(status_code=404, detail="Liên kết chia sẻ không hợp lệ hoặc không tồn tại")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    _ensure_link_active(link, now)
    if not link.allow_download:
        raise HTTPException(status_code=403, detail="Không được phép tải tệp tin này")
    _verify_link_password(link, password, db, now)

    doc = db.query(Document).filter(
        Document.id == link.document_id,
        Document.user_id == link.user_id,
        Document.is_deleted.is_(False),
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Tài liệu không tồn tại")

    abs_path = storage_manager.get_absolute_path(doc.storage_path)
    if not abs_path.exists():
        raise HTTPException(status_code=404, detail="Tệp tin không tồn tại trên hệ thống lưu trữ")

    ip = request.client.host if request.client else "127.0.0.1"
    ua = request.headers.get("user-agent", "")[:255]
    log = ShareAccessLog(shared_link_id=link.id, ip_address=ip, user_agent=ua, action="download")
    db.add(log)
    db.commit()
    return FileResponse(path=str(abs_path), filename=doc.original_name, media_type=doc.mime_type)


@router.get("/public/share/{token}/download")
def download_shared_document(
    token: str,
    request: Request,
    db: Session = Depends(get_db),
    x_share_password: Optional[str] = Header(default=None),
):
    return _download_shared_document(token, x_share_password, request, db)


@router.post("/public/share/{token}/download")
def download_shared_document_with_password(
    token: str,
    request: Request,
    req: Optional[SharedLinkAccessRequest] = None,
    db: Session = Depends(get_db),
):
    return _download_shared_document(token, req.password if req else None, request, db)
