import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.core.security import (
    create_access_token, decode_access_token, hash_password, hash_sha256, verify_password
)
from app.database.session import get_db
from app.models.models import ActivityLog, User, UserRecoveryCode, UserSession
from app.schemas.schemas import (
    ChangePasswordRequest, RecoveryCodeResponse, RecoveryLoginRequest,
    SessionResponse, UserLoginRequest, UserProfileResponse,
    UserProfileUpdateRequest, UserRegisterRequest
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=dict)
def register(req: UserRegisterRequest, request: Request, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == req.email.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email này đã được sử dụng")

    user_id = str(uuid.uuid4())
    pw_hash = hash_password(req.password)
    user = User(
        id=user_id,
        email=req.email.lower(),
        password_hash=pw_hash,
        full_name=req.full_name,
        theme_preference="auto",
        language="vi"
    )
    db.add(user)

    # Generate one recovery code
    raw_code = f"REC-{secrets.token_hex(4).upper()}-{secrets.token_hex(4).upper()}"
    code_hash = hash_sha256(raw_code)
    rc = UserRecoveryCode(user_id=user_id, code_hash=code_hash)
    db.add(rc)

    # Create session
    session_id = str(uuid.uuid4())
    token_str = secrets.token_hex(32)
    session_token_hash = hash_sha256(token_str)
    user_agent = request.headers.get("user-agent", "Unknown Device")[:255]
    ip = request.client.host if request.client else "127.0.0.1"
    sess = UserSession(
        id=session_id,
        user_id=user_id,
        session_token_hash=session_token_hash,
        device_info=user_agent,
        ip_address=ip,
        expires_at=datetime.utcnow() + timedelta(days=7)
    )
    db.add(sess)

    # Activity log
    act = ActivityLog(
        user_id=user_id,
        event_type="register",
        description="Đăng ký tài khoản thành công"
    )
    db.add(act)
    db.commit()

    jwt_token = create_access_token({"sub": user_id, "session_id": session_id})
    return {
        "access_token": jwt_token,
        "token_type": "bearer",
        "recovery_code": raw_code,
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "theme_preference": user.theme_preference,
            "language": user.language,
            "storage_used": user.storage_used,
            "storage_limit": user.storage_limit
        }
    }

@router.post("/login", response_model=dict)
def login(req: UserLoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email.lower()).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email hoặc mật khẩu không chính xác")

    session_id = str(uuid.uuid4())
    token_str = secrets.token_hex(32)
    session_token_hash = hash_sha256(token_str)
    user_agent = request.headers.get("user-agent", "Unknown Device")[:255]
    ip = request.client.host if request.client else "127.0.0.1"

    sess = UserSession(
        id=session_id,
        user_id=user.id,
        session_token_hash=session_token_hash,
        device_info=user_agent,
        ip_address=ip,
        expires_at=datetime.utcnow() + timedelta(days=7)
    )
    db.add(sess)

    act = ActivityLog(
        user_id=user.id,
        event_type="login",
        description="Đăng nhập tài khoản thành công"
    )
    db.add(act)
    db.commit()

    jwt_token = create_access_token({"sub": user.id, "session_id": session_id})
    return {
        "access_token": jwt_token,
        "token_type": "bearer",
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
        }
    }

@router.get("/me", response_model=UserProfileResponse)
def get_me(user: User = Depends(get_current_user)):
    return user

@router.put("/me", response_model=UserProfileResponse)
def update_me(req: UserProfileUpdateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if req.email is not None:
        normalized_email = req.email.strip().lower()
        if not normalized_email or len(normalized_email) > 191 or "@" not in normalized_email:
            raise HTTPException(status_code=400, detail="Email không hợp lệ")
        existing = db.query(User).filter(
            User.email == normalized_email,
            User.id != user.id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email này đã được sử dụng")
        user.email = normalized_email
    if req.full_name is not None:
        user.full_name = req.full_name
    if req.title is not None:
        user.title = req.title
    if req.bio is not None:
        user.bio = req.bio
    if req.avatar_url is not None:
        user.avatar_url = req.avatar_url
    if req.theme_preference is not None:
        user.theme_preference = req.theme_preference
    if req.language is not None:
        user.language = req.language

    db.commit()
    db.refresh(user)
    return user

@router.post("/change-password")
def change_password(req: ChangePasswordRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(req.old_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Mật khẩu hiện tại không chính xác")

    user.password_hash = hash_password(req.new_password)
    db.commit()
    return {"message": "Đổi mật khẩu thành công"}

@router.post("/recover")
def recover_password(req: RecoveryLoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email.lower()).first()
    if not user:
        raise HTTPException(status_code=400, detail="Tài khoản không tồn tại")

    if user.recovery_locked_until and user.recovery_locked_until > datetime.utcnow():
        raise HTTPException(status_code=429, detail="Chức năng khôi phục đang bị tạm khóa do nhập sai nhiều lần. Vui lòng thử lại sau.")

    code_hash = hash_sha256(req.recovery_code.strip())
    rec = db.query(UserRecoveryCode).filter(
        UserRecoveryCode.user_id == user.id,
        UserRecoveryCode.code_hash == code_hash,
        UserRecoveryCode.used_at.is_(None)
    ).first()

    if not rec:
        user.failed_recovery_attempts += 1
        if user.failed_recovery_attempts >= 5:
            user.recovery_locked_until = datetime.utcnow() + timedelta(minutes=30)
        db.commit()
        raise HTTPException(status_code=400, detail="Mã khôi phục không đúng hoặc đã qua sử dụng")

    rec.used_at = datetime.utcnow()
    user.password_hash = hash_password(req.new_password)
    user.failed_recovery_attempts = 0
    user.recovery_locked_until = None
    db.commit()
    return {"message": "Khôi phục mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới."}

@router.post("/generate-recovery-code", response_model=RecoveryCodeResponse)
def generate_recovery_code(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    raw_code = f"REC-{secrets.token_hex(4).upper()}-{secrets.token_hex(4).upper()}"
    code_hash = hash_sha256(raw_code)
    rc = UserRecoveryCode(user_id=user.id, code_hash=code_hash)
    db.add(rc)
    db.commit()
    return {
        "recovery_code": raw_code,
        "message": "Vui lòng lưu lại mã này ở nơi an toàn. Mã chỉ hiển thị duy nhất một lần."
    }

@router.get("/sessions", response_model=list[SessionResponse])
def get_sessions(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sessions = db.query(UserSession).filter(
        UserSession.user_id == user.id,
        UserSession.is_revoked == False
    ).order_by(UserSession.last_active_at.desc()).all()
    return sessions

@router.delete("/sessions/{session_id}")
def revoke_session(session_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sess = db.query(UserSession).filter(
        UserSession.id == session_id,
        UserSession.user_id == user.id
    ).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Phiên làm việc không tồn tại")
    sess.is_revoked = True
    db.commit()
    return {"message": "Phiên làm việc đã bị thu hồi"}

@router.post("/logout")
def logout(
    authorization: Optional[str] = Header(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    token = authorization.removeprefix("Bearer ").strip() if authorization else ""
    payload = decode_access_token(token)
    session_id = payload.get("session_id") if payload else None
    if session_id:
        session = db.query(UserSession).filter(
            UserSession.id == session_id,
            UserSession.user_id == user.id
        ).first()
        if session:
            session.is_revoked = True
            db.commit()
    return {"message": "Đăng xuất thành công"}
