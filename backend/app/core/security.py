import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from app.core.config import settings

ph = PasswordHasher()

def hash_password(password: str) -> str:
    """Hash a password using Argon2id."""
    return ph.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify an Argon2id password hash."""
    try:
        return ph.verify(hashed_password, plain_password)
    except Exception:
        return False

def hash_sha256(data: str) -> str:
    """Compute standard SHA-256 hash in lowercase hex."""
    return hashlib.sha256(data.encode("utf-8")).hexdigest()

def generate_random_token(length: int = 32) -> str:
    """Generate a cryptographically secure URL-safe random string."""
    return secrets.token_urlsafe(length)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Encode JWT session token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=7)
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    encoded_jwt = jwt.encode(to_encode, settings.APP_SECRET, algorithm="HS256")
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT token."""
    try:
        payload = jwt.decode(token, settings.APP_SECRET, algorithms=["HS256"])
        return payload
    except Exception:
        return None

def encrypt_api_key(plain_key: str, hex_master_key: Optional[str] = None) -> Tuple[bytes, bytes, bytes]:
    """
    Encrypt an API Key using AES-256-GCM.
    Returns: (ciphertext_bytes, iv_bytes, auth_tag_bytes)
    """
    key_hex = hex_master_key or settings.AI_ENCRYPTION_KEY
    key_bytes = bytes.fromhex(key_hex)
    aesgcm = AESGCM(key_bytes)
    
    # 12-byte (96-bit) IV for GCM
    iv = secrets.token_bytes(12)
    full_ct = aesgcm.encrypt(iv, plain_key.encode("utf-8"), None)
    
    # In cryptography AESGCM, the last 16 bytes are the authentication tag
    ciphertext = full_ct[:-16]
    tag = full_ct[-16:]
    return ciphertext, iv, tag

def decrypt_api_key(ciphertext: bytes, iv: bytes, tag: bytes, hex_master_key: Optional[str] = None) -> str:
    """
    Decrypt an AES-256-GCM encrypted API key.
    """
    key_hex = hex_master_key or settings.AI_ENCRYPTION_KEY
    key_bytes = bytes.fromhex(key_hex)
    aesgcm = AESGCM(key_bytes)
    full_ct = ciphertext + tag
    decrypted_bytes = aesgcm.decrypt(iv, full_ct, None)
    return decrypted_bytes.decode("utf-8")
