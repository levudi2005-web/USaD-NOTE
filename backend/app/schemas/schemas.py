from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

# AUTH & USER
class UserRegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=6)
    full_name: str

class UserLoginRequest(BaseModel):
    email: str
    password: str

class UserProfileResponse(BaseModel):
    id: str
    email: str
    full_name: str
    avatar_url: Optional[str] = None
    title: Optional[str] = None
    bio: Optional[str] = None
    theme_preference: str = "auto"
    language: str = "vi"
    storage_used: int = 0
    storage_limit: int = 1073741824

    class Config:
        from_attributes = True

class UserProfileUpdateRequest(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    title: Optional[str] = None
    bio: Optional[str] = None
    theme_preference: Optional[str] = None
    language: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str = Field(min_length=6)

class RecoveryCodeResponse(BaseModel):
    recovery_code: str
    message: str

class RecoveryLoginRequest(BaseModel):
    email: str
    recovery_code: str
    new_password: str = Field(min_length=6)

class SessionResponse(BaseModel):
    id: str
    device_info: str
    ip_address: str
    is_revoked: bool
    last_active_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True

# FOLDERS
class FolderCreate(BaseModel):
    name: str
    parent_id: Optional[str] = None
    color: str = "emerald"
    icon: Optional[str] = "folder"

class FolderUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None

class FolderResponse(BaseModel):
    id: str
    user_id: str
    parent_id: Optional[str] = None
    name: str
    color: Optional[str] = "emerald"
    icon: Optional[str] = "folder"
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# DOCUMENTS
class DocumentResponse(BaseModel):
    id: str
    user_id: str
    folder_id: Optional[str] = None
    name: str
    original_name: str
    file_type: str
    mime_type: str
    file_size: int
    is_starred: bool = False
    is_archived: bool = False
    is_deleted: bool = False
    summary: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class DocumentUpdate(BaseModel):
    name: Optional[str] = None
    folder_id: Optional[str] = None
    is_starred: Optional[bool] = None
    is_archived: Optional[bool] = None
    summary: Optional[str] = None

# NOTES
class NoteCreate(BaseModel):
    title: str
    category: Optional[str] = None
    content: Optional[str] = None
    folder_id: Optional[str] = None
    document_id: Optional[str] = None
    is_pinned: bool = False
    is_favorite: bool = False
    tags: List[str] = Field(default_factory=list)

class NoteUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    content: Optional[str] = None
    folder_id: Optional[str] = None
    document_id: Optional[str] = None
    is_pinned: Optional[bool] = None
    is_favorite: Optional[bool] = None
    tags: Optional[List[str]] = None

class NoteResponse(BaseModel):
    id: str
    user_id: str
    folder_id: Optional[str] = None
    document_id: Optional[str] = None
    title: str
    category: Optional[str] = None
    content: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    is_pinned: bool = False
    is_favorite: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# TAGS
class TagResponse(BaseModel):
    id: int
    name: str
    color: Optional[str] = "#10b981"

    class Config:
        from_attributes = True

# COLLECTIONS
class CollectionCreate(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = "#10b981"
    tags: List[str] = Field(default_factory=list)

class CollectionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    tags: Optional[List[str]] = None

class CollectionResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    color: Optional[str] = "#10b981"
    tags: List[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ARCHIVES
class ArchiveResponse(BaseModel):
    id: str
    name: str
    format: str
    file_size: int
    uncompressed_size: int
    compression_ratio: float
    file_count: int
    scan_status: str
    manifest_json: str
    created_at: datetime

    class Config:
        from_attributes = True

class ArchiveExtractRequest(BaseModel):
    inner_paths: List[str]
    target_folder_id: Optional[str] = None

# AI BYOK
class AiProviderResponse(BaseModel):
    id: str
    code: str
    name: str
    base_url: Optional[str] = None
    auth_header_name: str
    auth_scheme: Optional[str] = None

    class Config:
        from_attributes = True

class AiModelResponse(BaseModel):
    id: str
    provider_id: str
    model_code: str
    name: str
    context_window: int
    max_output_tokens: int
    supports_vision: bool
    supports_streaming: bool
    is_default: bool

    class Config:
        from_attributes = True

class AiConnectionCreate(BaseModel):
    provider_id: str
    name: str
    api_key: str
    default_model_id: Optional[str] = None
    custom_endpoint: Optional[str] = None

class AiConnectionUpdate(BaseModel):
    name: Optional[str] = None
    api_key: Optional[str] = None
    default_model_id: Optional[str] = None
    custom_endpoint: Optional[str] = None

class AiConnectionResponse(BaseModel):
    id: str
    provider_id: str
    provider_code: Optional[str] = None
    provider_name: Optional[str] = None
    name: str
    api_key_masked: str
    default_model_id: Optional[str] = None
    default_model_name: Optional[str] = None
    custom_endpoint: Optional[str] = None
    is_connected: bool
    last_tested_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class AiChatRequest(BaseModel):
    conversation_id: Optional[str] = None
    connection_id: Optional[str] = None
    message: str
    model_name: Optional[str] = None
    document_id: Optional[str] = None

class AiMessageResponse(BaseModel):
    id: int
    conversation_id: str
    role: str
    content: str
    total_tokens: int = 0
    references_json: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class AiConversationResponse(BaseModel):
    id: str
    title: str
    model_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    messages: List[AiMessageResponse] = []

    class Config:
        from_attributes = True

# AI CONTEXT
class AiContextSaveRequest(BaseModel):
    id: Optional[str] = None
    name: str
    description: Optional[str] = None
    capsule_json: str

class AiContextResponse(BaseModel):
    id: str
    name: str
    version: str
    description: Optional[str] = None
    capsule_json: str
    schema_version: str
    is_valid: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# FLASHCARDS
class FlashcardCreate(BaseModel):
    front_text: str
    back_text: str

class FlashcardDeckCreate(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = "#10b981"
    document_id: Optional[str] = None
    cards: List[FlashcardCreate] = Field(default_factory=list)

class FlashcardResponse(BaseModel):
    id: str
    deck_id: str
    front_text: str
    back_text: str
    is_known: bool
    review_count: int
    last_reviewed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class FlashcardDeckResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    color: Optional[str] = "#10b981"
    document_id: Optional[str] = None
    cards_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True

class CardReviewRequest(BaseModel):
    known: bool

# QUIZ
class QuizOptionCreate(BaseModel):
    option_text: str
    is_correct: bool = False
    sort_order: int = Field(default=1, ge=1)

class QuizQuestionCreate(BaseModel):
    question_text: str
    question_type: str = "single_choice"
    explanation: Optional[str] = None
    sort_order: int = Field(default=1, ge=1)
    options: List[QuizOptionCreate]

class QuizCreate(BaseModel):
    title: str
    description: Optional[str] = None
    document_id: Optional[str] = None
    time_limit_minutes: int = Field(default=15, ge=0)
    passing_score: int = Field(default=80, ge=0, le=100)
    questions: List[QuizQuestionCreate]

class QuizOptionResponse(BaseModel):
    id: str
    option_text: str
    sort_order: int

    class Config:
        from_attributes = True

class QuizQuestionResponse(BaseModel):
    id: str
    question_text: str
    question_type: str
    sort_order: int
    options: List[QuizOptionResponse]

    class Config:
        from_attributes = True

class QuizResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    document_id: Optional[str] = None
    time_limit_minutes: int
    passing_score: int
    questions_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True

class QuizSubmitAnswer(BaseModel):
    question_id: str
    selected_option_id: str

class QuizSubmitRequest(BaseModel):
    answers: List[QuizSubmitAnswer]
    time_spent_seconds: int = Field(default=0, ge=0)

class QuizResultResponse(BaseModel):
    attempt_id: str
    score: int
    total_questions: int
    percentage: float
    passed: bool
    correct_answers_count: int
    time_spent_seconds: int

# SHARED LINKS
class SharedLinkCreate(BaseModel):
    document_id: str
    share_name: Optional[str] = None
    password: Optional[str] = Field(default=None, min_length=8, max_length=256)
    allow_download: bool = True
    expires_in_days: Optional[int] = Field(default=7, ge=0, le=365)
    expires_at: Optional[datetime] = None

class SharedLinkUpdate(BaseModel):
    share_name: Optional[str] = None
    password: Optional[str] = Field(default=None, min_length=8, max_length=256)
    allow_download: Optional[bool] = None
    expires_in_days: Optional[int] = Field(default=None, ge=0, le=365)
    expires_at: Optional[datetime] = None

class SharedLinkResponse(BaseModel):
    id: str
    document_id: str
    token: Optional[str] = None
    share_url: Optional[str] = None
    share_name: Optional[str] = None
    allow_download: bool
    view_count: int
    has_password: bool
    is_revoked: bool
    expires_at: Optional[datetime] = None
    created_at: datetime

class SharedLinkAccessRequest(BaseModel):
    password: Optional[str] = None

# NOTIFICATION & ACTIVITY
class NotificationResponse(BaseModel):
    id: str
    title: str
    message: str
    type: str
    link: Optional[str] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

class ActivityLogResponse(BaseModel):
    id: int
    event_type: str
    description: str
    created_at: datetime

    class Config:
        from_attributes = True
