# MÔ HÌNH LOGIC DỮ LIỆU — MLD (MODÈLE LOGIQUE DE DONNÉES)

---

## 1. QUY TẮC CHUYỂN ĐỔI TỪ MCD SANG MLD (MERISE DERIVATION RULES)

Quá trình chuyển đổi từ Mô hình Khái niệm (MCD) sang Mô hình Logic (MLD) tuân thủ nghiêm ngặt các quy tắc Merise:
1. **Thực thể độc lập -> Bảng (Relation):**
   - Mỗi thực thể trong MCD trở thành một quan hệ (bảng) trong MLD. Định danh của thực thể trở thành Khóa chính (Primary Key - PK).
2. **Mối kết hợp 1:N (Cardinality (1,1) - (0,n)):**
   - Khóa chính của bảng phía `(0,n)` hoặc `(1,n)` được di chuyển sang bảng phía `(1,1)` để đóng vai trò làm Khóa ngoại (Foreign Key - FK).
   - Ví dụ: `USER (1,1) <---> (0,n) DOCUMENT` -> Cột `user_id` xuất hiện trong bảng `DOCUMENTS` làm Khóa ngoại.
3. **Mối kết hợp N:N (Cardinality (0,n) - (0,n)):**
   - Chuyển thành một bảng liên kết trung gian (Table d'association). Khóa chính của bảng này là tổ hợp các khóa ngoại trỏ về 2 bảng cha (Composite Primary Key).
   - Ví dụ: `DOCUMENT (0,n) <---> (0,n) TAG` -> Sinh ra bảng `DOCUMENT_TAGS` với `PRIMARY KEY (document_id, tag_id)`.
4. **Mối kết hợp có thuộc tính riêng:**
   - Quan hệ `EXTRAIRE_DE` mang thuộc tính `inner_path`, `extracted_at` -> Trở thành bảng liên kết trích xuất `ARCHIVE_EXTRACTED_FILES`.
5. **Mối kết hợp đệ quy (Recursive / Self-referencing):**
   - `FOLDER (0,1) <---> (0,n) FOLDER` -> Bổ sung khóa ngoại `parent_id` trong chính bảng `FOLDERS` tham chiếu đến `folders(id)`.

---

## 2. ĐẶC TẢ CHI TIẾT CÁC QUAN HỆ TRONG MLD (RELATIONAL SCHEMAS)

Quy ước ký hiệu:
- **`PK`**: Primary Key (Khóa chính)
- **`FK`**: Foreign Key (Khóa ngoại)
- **`UQ`**: Unique constraint (Duy nhất)
- **`NN`**: Not Null (Bắt buộc)

### 2.1. Nhóm Tài khoản & Xác thực
1. **`USERS`** (
   **`id`** PK,
   `email` NN UQ,
   `password_hash` NN,
   `full_name` NN,
   `avatar_url`,
   `title`,
   `bio`,
   `theme_preference` NN,
   `language` NN,
   `storage_used` NN,
   `storage_limit` NN,
   `created_at` NN,
   `updated_at` NN
)

2. **`USER_RECOVERY_CODES`** (
   **`id`** PK,
   `user_id` FK -> USERS(id) NN,
   `code_hash` NN,
   `used_at`,
   `created_at` NN
)

3. **`USER_SESSIONS`** (
   **`id`** PK,
   `user_id` FK -> USERS(id) NN,
   `session_token_hash` NN UQ,
   `device_info` NN,
   `ip_address` NN,
   `last_active_at` NN,
   `expires_at` NN,
   `created_at` NN
)

### 2.2. Nhóm Tài liệu & Lưu trữ
4. **`FOLDERS`** (
   **`id`** PK,
   `user_id` FK -> USERS(id) NN,
   `parent_id` FK -> FOLDERS(id),
   `name` NN,
   `color`,
   `icon` NN,
   `created_at` NN,
   `updated_at` NN
)

5. **`DOCUMENTS`** (
   **`id`** PK,
   `user_id` FK -> USERS(id) NN,
   `folder_id` FK -> FOLDERS(id),
   `name` NN,
   `original_name` NN,
   `file_type` NN,
   `mime_type` NN,
   `file_size` NN,
   `storage_path` NN,
   `sha256_checksum` NN,
   `processing_status` NN,
   `extracted_text`,
   `deleted_at`,
   `created_at` NN,
   `updated_at` NN
)

6. **`NOTES`** (
   **`id`** PK,
   `user_id` FK -> USERS(id) NN,
   `folder_id` FK -> FOLDERS(id),
   `document_id` FK -> DOCUMENTS(id),
   `title` NN,
   `category`,
   `content`,
   `is_pinned` NN,
   `is_favorite` NN,
   `created_at` NN,
   `updated_at` NN
)

7. **`TAGS`** (
   **`id`** PK,
   `user_id` FK -> USERS(id) NN,
   `name` NN,
   `color`,
   `created_at` NN,
   UQ(`user_id`, `name`)
)

8. **`DOCUMENT_TAGS`** (
   **`document_id`** PK FK -> DOCUMENTS(id),
   **`tag_id`** PK FK -> TAGS(id),
   `created_at` NN
)

9. **`COLLECTIONS`** (
   **`id`** PK,
   `user_id` FK -> USERS(id) NN,
   `name` NN,
   `description`,
   `color`,
   `created_at` NN,
   `updated_at` NN
)

10. **`COLLECTION_ITEMS`** (
    **`id`** PK,
    `collection_id` FK -> COLLECTIONS(id) NN,
    `item_type` NN,
    `item_id` NN,
    `added_at` NN,
    UQ(`collection_id`, `item_type`, `item_id`)
)

### 2.3. Nhóm Gói nén ZIP / 7Z
11. **`ARCHIVES`** (
    **`id`** PK,
    `user_id` FK -> USERS(id) NN,
    `name` NN,
    `original_name` NN,
    `format` NN,
    `file_size` NN,
    `file_count` NN,
    `storage_path` NN,
    `sha256_checksum` NN,
    `scan_status` NN,
    `manifest_json` NN,
    `created_at` NN,
    `updated_at` NN
)

12. **`ARCHIVE_EXTRACTED_FILES`** (
    **`id`** PK,
    `archive_id` FK -> ARCHIVES(id) NN,
    `document_id` FK -> DOCUMENTS(id) NN,
    `inner_path` NN,
    `extracted_at` NN,
    UQ(`archive_id`, `inner_path`)
)

### 2.4. Nhóm AI BYOK & Quy trình AI
13. **`AI_CONNECTIONS`** (
    **`id`** PK,
    `user_id` FK -> USERS(id) NN,
    `provider` NN,
    `name` NN,
    `api_endpoint`,
    `encrypted_api_key` NN,
    `encryption_iv` NN,
    `encryption_tag` NN,
    `api_key_masked` NN,
    `default_model` NN,
    `available_models_json`,
    `is_connected` NN,
    `last_tested_at`,
    `created_at` NN,
    `updated_at` NN
)

14. **`AI_TASKS`** (
    **`id`** PK,
    `user_id` FK -> USERS(id) NN,
    `source_document_id` FK -> DOCUMENTS(id),
    `name` NN,
    `description`,
    `trigger_type` NN,
    `status` NN,
    `progress` NN,
    `created_at` NN,
    `completed_at`
)

15. **`AI_TASK_LOGS`** (
    **`id`** PK,
    `task_id` FK -> AI_TASKS(id) NN,
    `step_name` NN,
    `status` NN,
    `duration_ms` NN,
    `tokens_used` NN,
    `input_summary`,
    `output_summary`,
    `error_message`,
    `executed_at` NN
)

### 2.5. Nhóm AI Context Capsule
16. **`AI_CONTEXTS`** (
    **`id`** PK,
    `user_id` FK -> USERS(id) NN,
    `title` NN,
    `schema_version` NN,
    `current_version` NN,
    `summary` NN,
    `knowledge_points_json` NN,
    `conclusions_json` NN,
    `open_questions_json`,
    `learning_progress` NN,
    `handoff_directive`,
    `created_at` NN,
    `updated_at` NN
)

17. **`AI_CONTEXT_VERSIONS`** (
    **`id`** PK,
    `context_id` FK -> AI_CONTEXTS(id) NN,
    `version_tag` NN,
    `snapshot_json` NN,
    `change_note`,
    `created_at` NN,
    UQ(`context_id`, `version_tag`)
)

### 2.6. Nhóm Flashcards & Quiz
18. **`FLASHCARD_DECKS`** (
    **`id`** PK,
    `user_id` FK -> USERS(id) NN,
    `document_id` FK -> DOCUMENTS(id),
    `name` NN,
    `description`,
    `created_at` NN,
    `updated_at` NN
)

19. **`FLASHCARDS`** (
    **`id`** PK,
    `deck_id` FK -> FLASHCARD_DECKS(id) NN,
    `front_text` NN,
    `back_text` NN,
    `is_known` NN,
    `review_count` NN,
    `last_reviewed_at`,
    `created_at` NN,
    `updated_at` NN
)

20. **`QUIZZES`** (
    **`id`** PK,
    `user_id` FK -> USERS(id) NN,
    `document_id` FK -> DOCUMENTS(id),
    `title` NN,
    `description`,
    `time_limit_sec` NN,
    `max_attempts` NN,
    `created_at` NN,
    `updated_at` NN
)

21. **`QUIZ_QUESTIONS`** (
    **`id`** PK,
    `quiz_id` FK -> QUIZZES(id) NN,
    `question_text` NN,
    `order_index` NN,
    `explanation`,
    `created_at` NN
)

22. **`QUIZ_OPTIONS`** (
    **`id`** PK,
    `question_id` FK -> QUIZ_QUESTIONS(id) NN,
    `option_text` NN,
    `is_correct` NN,
    `order_index` NN
)

23. **`QUIZ_ATTEMPTS`** (
    **`id`** PK,
    `quiz_id` FK -> QUIZZES(id) NN,
    `user_id` FK -> USERS(id) NN,
    `score` NN,
    `correct_answers` NN,
    `total_questions` NN,
    `duration_sec` NN,
    `started_at` NN,
    `completed_at` NN
)

24. **`QUIZ_ATTEMPT_ANSWERS`** (
    **`id`** PK,
    `attempt_id` FK -> QUIZ_ATTEMPTS(id) NN,
    `question_id` FK -> QUIZ_QUESTIONS(id) NN,
    `selected_option_id` FK -> QUIZ_OPTIONS(id) NN,
    `is_correct` NN,
    UQ(`attempt_id`, `question_id`)
)

### 2.7. Nhóm Chia sẻ Ngoại vi
25. **`SHARED_LINKS`** (
    **`id`** PK,
    `user_id` FK -> USERS(id) NN,
    `document_id` FK -> DOCUMENTS(id) NN,
    `title` NN,
    `token_hash` NN UQ,
    `password_hash`,
    `allow_download` NN,
    `expires_at`,
    `views_count` NN,
    `is_revoked` NN,
    `created_at` NN,
    `updated_at` NN
)

26. **`SHARE_ACCESS_LOGS`** (
    **`id`** PK,
    `shared_link_id` FK -> SHARED_LINKS(id) NN,
    `action` NN,
    `ip_address` NN,
    `user_agent` NN,
    `accessed_at` NN
)

### 2.8. Nhóm Vận hành & Thông báo
27. **`ACTIVITY_LOGS`** (
    **`id`** PK,
    `user_id` FK -> USERS(id) NN,
    `event_type` NN,
    `description` NN,
    `entity_type`,
    `entity_id`,
    `created_at` NN
)

28. **`NOTIFICATIONS`** (
    **`id`** PK,
    `user_id` FK -> USERS(id) NN,
    `title` NN,
    `message` NN,
    `type` NN,
    `icon` NN,
    `is_read` NN,
    `created_at` NN
)

---

## 3. KIỂM CHỨNG CHUẨN HÓA DỮ LIỆU (NORMALIZATION PROOF)

### Chuẩn 1NF (First Normal Form)
- Tất cả các thuộc tính đều có giá trị nguyên tử (atomic values).
- Không có mảng lặp thuộc tính (repeating groups).
- Ví dụ: Danh sách tag của tài liệu không lưu chuỗi `tag1,tag2,tag3` trong bảng `documents` mà được tách riêng thành bảng `document_tags`.

### Chuẩn 2NF (Second Normal Form)
- Đạt 1NF.
- Mọi thuộc tính không khóa đều phụ thuộc hàm đầy đủ vào toàn bộ Khóa chính, không phụ thuộc vào một phần của khóa chính trong các bảng có khóa tổ hợp.
- Ví dụ: Trong bảng `document_tags(document_id, tag_id)`, thuộc tính `created_at` phản ánh thời điểm gán thẻ cho tài liệu, phụ thuộc vào cặp `(document_id, tag_id)`.

### Chuẩn 3NF (Third Normal Form)
- Đạt 2NF.
- Không có phụ thuộc bắc cầu (transitive dependency): Thuộc tính không khóa không phụ thuộc vào thuộc tính không khóa khác.
- Ví dụ: Bảng `documents` không lưu `user_email` hay `folder_name` (vì `document_id -> folder_id -> folder_name`), mà chỉ lưu khóa ngoại `folder_id` và `user_id`.
