import json
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Integer, BigInteger, Text, Boolean, DateTime,
    ForeignKey, LargeBinary, Numeric, func
)
from sqlalchemy.dialects.mysql import BIGINT as MySQLBigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.ext.hybrid import hybrid_property
from app.database.base import Base

UnsignedBigInteger = BigInteger().with_variant(MySQLBigInteger(unsigned=True), "mysql")


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True)
    email = Column(String(191), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    avatar_url = Column(String(255), nullable=True)
    title = Column(String(100), nullable=True)
    bio = Column(Text, nullable=True)
    theme_preference = Column(String(10), default="auto", nullable=False)
    language = Column(String(10), default="vi", nullable=False)
    storage_used = Column(BigInteger, default=0, nullable=False)
    storage_limit = Column(BigInteger, default=1073741824, nullable=False)
    failed_recovery_attempts = Column(Integer, default=0, nullable=False)
    recovery_locked_until = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    folders = relationship("Folder", back_populates="user", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="user", cascade="all, delete-orphan")
    notes = relationship("Note", back_populates="user", cascade="all, delete-orphan")
    collections = relationship("Collection", back_populates="user", cascade="all, delete-orphan")
    archives = relationship("Archive", back_populates="user", cascade="all, delete-orphan")
    ai_connections = relationship("AiConnection", back_populates="user", cascade="all, delete-orphan")
    quizzes = relationship("Quiz", back_populates="user", cascade="all, delete-orphan")
    flashcard_decks = relationship("FlashcardDeck", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    activity_logs = relationship("ActivityLog", back_populates="user", cascade="all, delete-orphan")


class UserRecoveryCode(Base):
    __tablename__ = "user_recovery_codes"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    code_hash = Column(String(64), nullable=False)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    session_token_hash = Column(String(64), unique=True, nullable=False, index=True)
    device_info = Column(String(255), nullable=False)
    ip_address = Column(String(45), nullable=False)
    is_revoked = Column(Boolean, default=False, nullable=False)
    last_active_at = Column(DateTime, default=func.now(), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)


class Folder(Base):
    __tablename__ = "folders"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    parent_id = Column(String(36), ForeignKey("folders.id", ondelete="CASCADE"), nullable=True)
    name = Column(String(150), nullable=False)
    color = Column(String(30), default="emerald", nullable=True)
    icon = Column(String(50), default="folder", nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="folders")
    children = relationship("Folder", backref="parent", remote_side=[id])
    documents = relationship("Document", back_populates="folder")


class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    folder_id = Column(String(36), ForeignKey("folders.id", ondelete="SET NULL"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    original_name = Column(String(255), nullable=False)
    file_type = Column(String(20), nullable=False)
    mime_type = Column(String(100), nullable=False)
    file_size = Column(BigInteger, nullable=False)
    storage_path = Column(String(500), nullable=False)
    sha256_checksum = Column(String(64), nullable=False)
    processing_status = Column(String(20), default="ready", nullable=False)
    extracted_text = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    is_starred = Column(Boolean, default=False, nullable=False)
    is_archived = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="documents")
    folder = relationship("Folder", back_populates="documents")
    notes = relationship("Note", back_populates="document")
    tags = relationship("Tag", secondary="document_tags", back_populates="documents")
    shared_links = relationship("SharedLink", back_populates="document", cascade="all, delete-orphan")

    @hybrid_property
    def is_deleted(self):
        return self.deleted_at is not None

    @is_deleted.setter
    def is_deleted(self, value):
        if value and self.deleted_at is None:
            self.deleted_at = datetime.now(timezone.utc).replace(tzinfo=None)
        elif not value:
            self.deleted_at = None

    @is_deleted.expression
    def is_deleted(cls):
        return cls.deleted_at.is_not(None)


class Note(Base):
    __tablename__ = "notes"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    folder_id = Column(String(36), ForeignKey("folders.id", ondelete="SET NULL"), nullable=True)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=False)
    category = Column(String(100), nullable=True)
    content = Column(Text, nullable=True)
    tags_json = Column(Text, default="[]", nullable=False)
    is_pinned = Column(Boolean, default=False, nullable=False)
    is_favorite = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="notes")
    document = relationship("Document", back_populates="notes")

    @property
    def tags(self):
        return json.loads(self.tags_json or "[]")

    @tags.setter
    def tags(self, value):
        self.tags_json = json.dumps(value, ensure_ascii=False)


class Tag(Base):
    __tablename__ = "tags"

    id = Column(UnsignedBigInteger, primary_key=True, autoincrement=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(50), nullable=False)
    color = Column(String(30), default="#10b981", nullable=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)

    documents = relationship("Document", secondary="document_tags", back_populates="tags")


class DocumentTag(Base):
    __tablename__ = "document_tags"

    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True)
    tag_id = Column(UnsignedBigInteger, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)


class Collection(Base):
    __tablename__ = "collections"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String(30), default="#10b981", nullable=True)
    tags_json = Column(Text, default="[]", nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="collections")
    items = relationship("CollectionItem", back_populates="collection", cascade="all, delete-orphan")

    @property
    def tags(self):
        return json.loads(self.tags_json or "[]")

    @tags.setter
    def tags(self, value):
        self.tags_json = json.dumps(value, ensure_ascii=False)


class CollectionItem(Base):
    __tablename__ = "collection_items"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    collection_id = Column(String(36), ForeignKey("collections.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=True)
    note_id = Column(String(36), ForeignKey("notes.id", ondelete="CASCADE"), nullable=True)
    deck_id = Column(String(36), ForeignKey("flashcard_decks.id", ondelete="CASCADE"), nullable=True)
    added_at = Column(DateTime, default=func.now(), nullable=False)

    collection = relationship("Collection", back_populates="items")


class Archive(Base):
    __tablename__ = "archives"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    original_name = Column(String(255), nullable=False)
    format = Column(String(10), nullable=False)
    file_size = Column(BigInteger, nullable=False)
    uncompressed_size = Column(BigInteger, nullable=False)
    max_ratio = Column(Numeric(6, 2), default=1.0, nullable=False)
    file_count = Column(Integer, default=0, nullable=False)
    storage_path = Column(String(500), nullable=False)
    sha256_checksum = Column(String(64), nullable=False)
    scan_status = Column(String(20), default="clean", nullable=False)
    manifest_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="archives")
    extracted_files = relationship("ArchiveExtractedFile", back_populates="archive", cascade="all, delete-orphan")

    @property
    def compression_ratio(self):
        return self.max_ratio


class ArchiveExtractedFile(Base):
    __tablename__ = "archive_extracted_files"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    archive_id = Column(String(36), ForeignKey("archives.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    inner_path = Column(String(500), nullable=False)
    extracted_at = Column(DateTime, default=func.now(), nullable=False)

    archive = relationship("Archive", back_populates="extracted_files")
    document = relationship("Document")


class AiProvider(Base):
    __tablename__ = "ai_providers"

    id = Column(String(50), primary_key=True)
    name = Column(String(100), nullable=False)
    api_base_url = Column(String(255), nullable=False)
    auth_header_format = Column(String(100), default="Bearer {KEY}", nullable=False)
    icon = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)

    models = relationship("AiModel", back_populates="provider")

    @property
    def code(self):
        return self.id

    @property
    def base_url(self):
        return self.api_base_url

    @property
    def auth_header_name(self):
        if self.id == "gemini":
            return "x-goog-api-key"
        if self.id == "claude":
            return "x-api-key"
        return "Authorization"

    @property
    def auth_scheme(self):
        return None if self.id in {"gemini", "claude"} else "Bearer"


class AiModel(Base):
    __tablename__ = "ai_models"

    id = Column(String(100), primary_key=True)
    provider_id = Column(String(50), ForeignKey("ai_providers.id", ondelete="CASCADE"), nullable=False)
    display_name = Column(String(150), nullable=False)
    context_window = Column(Integer, default=128000, nullable=False)
    max_output_tokens = Column(Integer, default=4096, nullable=False)
    supports_vision = Column(Boolean, default=False, nullable=False)
    is_default = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)

    provider = relationship("AiProvider", back_populates="models")

    @property
    def model_code(self):
        return self.id

    @property
    def name(self):
        return self.display_name

    @property
    def supports_streaming(self):
        return True


class AiConnection(Base):
    __tablename__ = "ai_connections"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    provider_id = Column(String(50), ForeignKey("ai_providers.id", ondelete="RESTRICT"), nullable=False)
    name = Column(String(100), nullable=False)
    api_endpoint = Column(String(255), nullable=True)
    encrypted_api_key = Column(LargeBinary, nullable=False)
    encryption_iv = Column(LargeBinary, nullable=False)
    encryption_tag = Column(LargeBinary, nullable=False)
    key_version = Column(Integer, default=1, nullable=False)
    api_key_masked = Column(String(64), nullable=False)
    default_model_id = Column(String(100), ForeignKey("ai_models.id", ondelete="RESTRICT"), nullable=False)
    is_connected = Column(Boolean, default=False, nullable=False)
    last_tested_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="ai_connections")
    provider = relationship("AiProvider")
    default_model = relationship("AiModel")

    @property
    def custom_endpoint(self):
        return self.api_endpoint

    @custom_endpoint.setter
    def custom_endpoint(self, value):
        self.api_endpoint = value

    @property
    def api_key_encrypted(self):
        return self.encrypted_api_key

    @api_key_encrypted.setter
    def api_key_encrypted(self, value):
        self.encrypted_api_key = value

    @property
    def api_key_iv(self):
        return self.encryption_iv

    @api_key_iv.setter
    def api_key_iv(self, value):
        self.encryption_iv = value

    @property
    def api_key_tag(self):
        return self.encryption_tag

    @api_key_tag.setter
    def api_key_tag(self, value):
        self.encryption_tag = value


class AiConversation(Base):
    __tablename__ = "ai_conversations"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    connection_id = Column(String(36), ForeignKey("ai_connections.id", ondelete="SET NULL"), nullable=True)
    model_name = Column(String(100), nullable=False)
    title = Column(String(200), nullable=False)
    pinned_document_id = Column(String(36), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
    total_tokens_used = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    messages = relationship("AiMessage", back_populates="conversation", cascade="all, delete-orphan", order_by="AiMessage.created_at")


class AiMessage(Base):
    __tablename__ = "ai_messages"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    conversation_id = Column(String(36), ForeignKey("ai_conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    prompt_tokens = Column(Integer, default=0, nullable=False)
    completion_tokens = Column(Integer, default=0, nullable=False)
    references_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)

    conversation = relationship("AiConversation", back_populates="messages")

    @property
    def total_tokens(self):
        return (self.prompt_tokens or 0) + (self.completion_tokens or 0)


class AiTask(Base):
    __tablename__ = "ai_tasks"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    source_document_id = Column(String(36), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
    connection_id = Column(String(36), ForeignKey("ai_connections.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    trigger_type = Column(String(30), default="manual", nullable=False)
    status = Column(String(20), default="queued", nullable=False)
    progress = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    completed_at = Column(DateTime, nullable=True)

    logs = relationship("AiTaskLog", back_populates="task", cascade="all, delete-orphan")


class AiTaskLog(Base):
    __tablename__ = "ai_task_logs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    task_id = Column(String(36), ForeignKey("ai_tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    step_name = Column(String(100), nullable=False)
    status = Column(String(20), nullable=False)
    duration_ms = Column(Integer, default=0, nullable=False)
    tokens_used = Column(Integer, default=0, nullable=False)
    input_summary = Column(Text, nullable=True)
    output_summary = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    executed_at = Column(DateTime, default=func.now(), nullable=False)

    task = relationship("AiTask", back_populates="logs")


class AiContext(Base):
    __tablename__ = "ai_contexts"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    schema_version = Column(String(20), default="1.0.0", nullable=False)
    current_version = Column(String(20), default="1.0.0", nullable=False)
    summary = Column(Text, nullable=False)
    knowledge_points_json = Column(Text, nullable=False)
    conclusions_json = Column(Text, nullable=False)
    open_questions_json = Column(Text, nullable=True)
    learning_progress = Column(Integer, default=0, nullable=False)
    handoff_directive = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    versions = relationship("AiContextVersion", back_populates="context", cascade="all, delete-orphan")


class AiContextVersion(Base):
    __tablename__ = "ai_context_versions"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    context_id = Column(String(36), ForeignKey("ai_contexts.id", ondelete="CASCADE"), nullable=False, index=True)
    version_tag = Column(String(20), nullable=False)
    snapshot_json = Column(Text, nullable=False)
    change_note = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)

    context = relationship("AiContext", back_populates="versions")


class FlashcardDeck(Base):
    __tablename__ = "flashcard_decks"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String(20), default="#10b981", nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="flashcard_decks")
    cards = relationship("Flashcard", back_populates="deck", cascade="all, delete-orphan")


class Flashcard(Base):
    __tablename__ = "flashcards"

    id = Column(String(36), primary_key=True)
    deck_id = Column(String(36), ForeignKey("flashcard_decks.id", ondelete="CASCADE"), nullable=False, index=True)
    front_text = Column(Text, nullable=False)
    back_text = Column(Text, nullable=False)
    is_known = Column(Boolean, default=False, nullable=False)
    review_count = Column(Integer, default=0, nullable=False)
    last_reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    deck = relationship("FlashcardDeck", back_populates="cards")


class Quiz(Base):
    __tablename__ = "quizzes"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    time_limit_sec = Column(Integer, default=0, nullable=False)
    passing_score = Column(Integer, default=80, nullable=False)
    max_attempts = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="quizzes")
    questions = relationship("QuizQuestion", back_populates="quiz", cascade="all, delete-orphan", order_by="QuizQuestion.order_index")
    attempts = relationship("QuizAttempt", back_populates="quiz", cascade="all, delete-orphan")


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id = Column(String(36), primary_key=True)
    quiz_id = Column(String(36), ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False, index=True)
    question_text = Column(Text, nullable=False)
    question_type = Column(String(30), default="single_choice", nullable=False)
    order_index = Column(Integer, default=1, nullable=False)
    explanation = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)

    quiz = relationship("Quiz", back_populates="questions")
    options = relationship("QuizOption", back_populates="question", cascade="all, delete-orphan", order_by="QuizOption.order_index")


class QuizOption(Base):
    __tablename__ = "quiz_options"

    id = Column(String(36), primary_key=True)
    question_id = Column(String(36), ForeignKey("quiz_questions.id", ondelete="CASCADE"), nullable=False, index=True)
    option_text = Column(Text, nullable=False)
    is_correct = Column(Boolean, default=False, nullable=False)
    order_index = Column(Integer, default=1, nullable=False)

    question = relationship("QuizQuestion", back_populates="options")


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(String(36), primary_key=True)
    quiz_id = Column(String(36), ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    score = Column(Numeric(5, 2), default=0, nullable=False)
    correct_answers = Column(Integer, default=0, nullable=False)
    total_questions = Column(Integer, default=0, nullable=False)
    duration_sec = Column(Integer, default=0, nullable=False)
    started_at = Column(DateTime, default=func.now(), nullable=False)
    completed_at = Column(DateTime, default=func.now(), nullable=False)

    quiz = relationship("Quiz", back_populates="attempts")
    answers = relationship("QuizAttemptAnswer", back_populates="attempt", cascade="all, delete-orphan")


class QuizAttemptAnswer(Base):
    __tablename__ = "quiz_attempt_answers"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    attempt_id = Column(String(36), ForeignKey("quiz_attempts.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id = Column(String(36), ForeignKey("quiz_questions.id", ondelete="CASCADE"), nullable=False)
    selected_option_id = Column(String(36), ForeignKey("quiz_options.id", ondelete="CASCADE"), nullable=False)
    is_correct = Column(Boolean, default=False, nullable=False)

    attempt = relationship("QuizAttempt", back_populates="answers")
    question = relationship("QuizQuestion")
    selected_option = relationship("QuizOption")


class SharedLink(Base):
    __tablename__ = "shared_links"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)
    allow_download = Column(Boolean, default=True, nullable=False)
    expires_at = Column(DateTime, nullable=True)
    views_count = Column(Integer, default=0, nullable=False)
    failed_pass_attempts = Column(Integer, default=0, nullable=False)
    pass_locked_until = Column(DateTime, nullable=True)
    is_revoked = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    document = relationship("Document", back_populates="shared_links")
    access_logs = relationship("ShareAccessLog", back_populates="shared_link", cascade="all, delete-orphan")


class ShareAccessLog(Base):
    __tablename__ = "share_access_logs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    shared_link_id = Column(String(36), ForeignKey("shared_links.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String(50), default="view", nullable=False)
    ip_address = Column(String(45), nullable=False)
    user_agent = Column(String(255), nullable=False)
    accessed_at = Column(DateTime, default=func.now(), nullable=False)

    shared_link = relationship("SharedLink", back_populates="access_logs")


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(50), nullable=False)
    description = Column(String(255), nullable=False)
    entity_type = Column(String(30), nullable=True)
    entity_id = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)

    user = relationship("User", back_populates="activity_logs")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(150), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(20), default="system", nullable=False)
    icon = Column(String(50), default="bell", nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)

    user = relationship("User", back_populates="notifications")
