# DANH SÁCH THỰC THỂ HỆ THỐNG NOTE (ENTITY LIST & SPECIFICATIONS)

---

## 1. BẢNG PHÂN BỔ CÁC THỰC THỂ THEO PHÂN HỆ NGHIỆP VỤ

Hệ thống được thiết kế theo 11 phân hệ nghiệp vụ độc lập, với tổng cộng **32 thực thể chuẩn hóa 3NF/BCNF** hoàn chỉnh:

```
+-----------------------------------------------------------------------------------+
|                           PHÂN HỆ NGHIỆP VỤ NOTE (32 BẢNG)                        |
+-------------------+-----------------------------------+---------------------------+
| Phân hệ           | Thực thể Conceptual (MCD)         | Bảng Vật lý (MPD)         |
+-------------------+-----------------------------------+---------------------------+
| 1. Tài khoản      | USER                              | users                     |
|                   | USER_RECOVERY_CODE                | user_recovery_codes       |
|                   | USER_SESSION                      | user_sessions             |
+-------------------+-----------------------------------+---------------------------+
| 2. Tài liệu & Lưu | FOLDER                            | folders                   |
|    trữ            | DOCUMENT                          | documents                 |
|                   | NOTE                              | notes                     |
|                   | TAG                               | tags                      |
|                   | DOCUMENT_TAG                      | document_tags             |
|                   | COLLECTION                        | collections               |
|                   | COLLECTION_ITEM                   | collection_items          |
+-------------------+-----------------------------------+---------------------------+
| 3. Gói nén ZIP/7Z | ARCHIVE                           | archives                  |
|                   | ARCHIVE_EXTRACTED_FILE            | archive_extracted_files   |
+-------------------+-----------------------------------+---------------------------+
| 4. AI BYOK &      | AI_PROVIDER                       | ai_providers              |
|    Danh mục       | AI_MODEL                          | ai_models                 |
|                   | AI_CONNECTION                     | ai_connections            |
+-------------------+-----------------------------------+---------------------------+
| 5. AI Assistant & | AI_CONVERSATION                   | ai_conversations          |
|    Hội thoại      | AI_MESSAGE                        | ai_messages               |
+-------------------+-----------------------------------+---------------------------+
| 6. Quy trình AI   | AI_TASK                           | ai_tasks                  |
|    tự động        | AI_TASK_LOG                       | ai_task_logs              |
+-------------------+-----------------------------------+---------------------------+
| 7. AI Context     | AI_CONTEXT                        | ai_contexts               |
|    Capsule        | AI_CONTEXT_VERSION                | ai_context_versions       |
+-------------------+-----------------------------------+---------------------------+
| 8. Flashcards     | FLASHCARD_DECK                    | flashcard_decks           |
|                   | FLASHCARD                         | flashcards                |
+-------------------+-----------------------------------+---------------------------+
| 9. Quiz &         | QUIZ                              | quizzes                   |
|    Trắc nghiệm    | QUIZ_QUESTION                     | quiz_questions            |
|                   | QUIZ_OPTION                       | quiz_options              |
|                   | QUIZ_ATTEMPT                      | quiz_attempts             |
|                   | QUIZ_ATTEMPT_ANSWER               | quiz_attempt_answers      |
+-------------------+-----------------------------------+---------------------------+
| 10. Chia sẻ ngoài | SHARED_LINK                       | shared_links              |
|                   | SHARE_ACCESS_LOG                  | share_access_logs         |
+-------------------+-----------------------------------+---------------------------+
| 11. Vận hành &    | ACTIVITY_LOG                      | activity_logs             |
|     Giám sát      | NOTIFICATION                      | notifications             |
+-------------------+-----------------------------------+---------------------------+
```

---

## 2. ĐẶC TẢ CHI TIẾT TỪNG THỰC THỂ

### 2.1. Phân hệ Tài khoản (Account Domain)

#### 1. Thực thể `USER` (Bảng: `users`)
- **Mục đích:** Lưu trữ định danh tài khoản người dùng, thông tin bảo mật và hạn mức lưu trữ.
- **Thuộc tính:**
  - `id`: Khóa chính (UUID v4 hoặc BIGINT UNSIGNED).
  - `email`: Địa chỉ email đăng nhập (UNIQUE, NOT NULL).
  - `password_hash`: Chuỗi băm mật khẩu bằng Argon2id hoặc Bcrypt (NOT NULL).
  - `full_name`: Tên hiển thị người dùng (VARCHAR(100), NOT NULL).
  - `avatar_url`: Đường dẫn ảnh đại diện (VARCHAR(255), NULL).
  - `title`: Chức danh / Nghề nghiệp (VARCHAR(100), NULL).
  - `bio`: Tiểu sử tóm tắt (TEXT, NULL).
  - `theme_preference`: Giao diện ưu tiên (`light`, `dark`, `auto`, DEFAULT `auto`).
  - `language`: Ngôn ngữ hiển thị (`vi`, `en`, DEFAULT `vi`).
  - `storage_used`: Dung lượng lưu trữ đã sử dụng tính theo bytes (BIGINT UNSIGNED, DEFAULT 0).
  - `storage_limit`: Hạn mức dung lượng tối đa tính theo bytes (BIGINT UNSIGNED, DEFAULT 1073741824 = 1GB).
  - `created_at`: Thời điểm tạo tài khoản (DATETIME, NOT NULL).
  - `updated_at`: Thời điểm cập nhật hồ sơ lần cuối (DATETIME, NOT NULL).

#### 2. Thực thể `USER_RECOVERY_CODE` (Bảng: `user_recovery_codes`)
- **Mục đích:** Lưu danh sách các mã khôi phục dự phòng dùng một lần khi quên mật khẩu.
- **Thuộc tính:**
  - `id`: Khóa chính (BIGINT UNSIGNED, AUTO_INCREMENT).
  - `user_id`: Khóa ngoại trỏ đến `users.id` (ON DELETE CASCADE, NOT NULL).
  - `code_hash`: Chuỗi băm SHA-256 của mã khôi phục (CHAR(64), NOT NULL).
  - `used_at`: Thời điểm mã được sử dụng (DATETIME, NULL). Nếu NULL nghĩa là mã còn hiệu lực.
  - `created_at`: Thời điểm cấp mã (DATETIME, NOT NULL).

#### 3. Thực thể `USER_SESSION` (Bảng: `user_sessions`)
- **Mục đích:** Theo dõi các phiên đăng nhập đang hoạt động trên các thiết bị.
- **Thuộc tính:**
  - `id`: Khóa chính (UUID / VARCHAR(64)).
  - `user_id`: Khóa ngoại trỏ đến `users.id` (ON DELETE CASCADE, NOT NULL).
  - `session_token_hash`: Mã băm SHA-256 của Session Token (CHAR(64), UNIQUE, NOT NULL).
  - `device_info`: Thông tin thiết bị và trình duyệt User-Agent (VARCHAR(255), NOT NULL).
  - `ip_address`: Địa chỉ IP đăng nhập (VARCHAR(45), NOT NULL).
  - `last_active_at`: Thời điểm tương tác cuối cùng (DATETIME, NOT NULL).
  - `expires_at`: Thời điểm hết hạn phiên (DATETIME, NOT NULL).
  - `created_at`: Thời điểm khởi tạo phiên (DATETIME, NOT NULL).

---

### 2.2. Phân hệ Tài liệu & Lưu trữ (Document & Storage Domain)

#### 4. Thực thể `FOLDER` (Bảng: `folders`)
- **Mục đích:** Quản lý cây thư mục phân cấp phục vụ lưu trữ tài liệu có tổ chức.
- **Thuộc tính:**
  - `id`: Khóa chính (UUID / VARCHAR(36)).
  - `user_id`: Khóa ngoại trỏ đến `users.id` (ON DELETE CASCADE, NOT NULL).
  - `parent_id`: Khóa ngoại tự tham chiếu trỏ đến `folders.id` (ON DELETE CASCADE, NULL nếu là thư mục gốc).
  - `name`: Tên thư mục (VARCHAR(150), NOT NULL).
  - `color`: Mã màu nhận diện (VARCHAR(30), NULL).
  - `icon`: Tên mã icon 2D Lucide (VARCHAR(50), DEFAULT `folder`).
  - `created_at`: Thời điểm tạo thư mục (DATETIME, NOT NULL).
  - `updated_at`: Thời điểm đổi tên / di chuyển thư mục (DATETIME, NOT NULL).

#### 5. Thực thể `DOCUMENT` (Bảng: `documents`)
- **Mục đích:** Quản lý metadata của tài liệu tải lên hoặc trích xuất từ gói nén.
- **Thuộc tính:**
  - `id`: Khóa chính (UUID / VARCHAR(36)).
  - `user_id`: Khóa ngoại trỏ đến `users.id` (ON DELETE CASCADE, NOT NULL).
  - `folder_id`: Khóa ngoại trỏ đến `folders.id` (ON DELETE SET NULL, NULL nếu nằm ở thư mục gốc).
  - `name`: Tên hiển thị của tài liệu (VARCHAR(255), NOT NULL).
  - `original_name`: Tên tệp gốc khi người dùng tải lên (VARCHAR(255), NOT NULL).
  - `file_type`: Định dạng tệp mở rộng (`pdf`, `docx`, `xlsx`, `pptx`, `txt`, `md`, `image`, v.v. - VARCHAR(20), NOT NULL).
  - `mime_type`: Chuỗi chuẩn MIME Type (VARCHAR(100), NOT NULL).
  - `file_size`: Kích thước tệp tính bằng bytes (BIGINT UNSIGNED, NOT NULL).
  - `storage_path`: Đường dẫn tương đối lưu file vật lý trên đĩa / Object Storage (VARCHAR(500), NOT NULL).
  - `sha256_checksum`: Mã băm SHA-256 đối soát tính toàn vẹn (CHAR(64), NOT NULL).
  - `processing_status`: Trạng thái xử lý (`pending`, `processing`, `ready`, `failed`, DEFAULT `ready`).
  - `extracted_text`: Toàn văn văn bản trích xuất phục vụ tìm kiếm toàn văn Full-text (LONGTEXT, NULL).
  - `deleted_at`: Cờ đánh dấu xóa mềm (DATETIME, NULL). Nếu khác NULL là tài liệu trong thùng rác.
  - `created_at`: Thời điểm tải lên (DATETIME, NOT NULL).
  - `updated_at`: Thời điểm sửa đổi metadata lần cuối (DATETIME, NOT NULL).

#### 6. Thực thể `NOTE` (Bảng: `notes`)
- **Mục đích:** Ghi chú cá nhân, tóm lược tri thức hoặc ghi chú gắn kèm tài liệu.
- **Thuộc tính:**
  - `id`: Khóa chính (UUID / VARCHAR(36)).
  - `user_id`: Khóa ngoại trỏ đến `users.id` (ON DELETE CASCADE, NOT NULL).
  - `folder_id`: Khóa ngoại trỏ đến `folders.id` (ON DELETE SET NULL, NULL).
  - `document_id`: Khóa ngoại trỏ đến `documents.id` (ON DELETE SET NULL, NULL nếu là ghi chú độc lập).
  - `title`: Tiêu đề ghi chú (VARCHAR(255), NOT NULL).
  - `category`: Danh mục phân loại (VARCHAR(100), NULL).
  - `content`: Nội dung văn bản ghi chú định dạng HTML / Markdown (LONGTEXT, NULL).
  - `is_pinned`: Cờ đánh dấu ghim lên đầu (BOOLEAN, DEFAULT FALSE).
  - `is_favorite`: Cờ đánh dấu yêu thích (BOOLEAN, DEFAULT FALSE).
  - `created_at`: Thời điểm tạo ghi chú (DATETIME, NOT NULL).
  - `updated_at`: Thời điểm chỉnh sửa gần nhất (DATETIME, NOT NULL).

#### 7. Thực thể `TAG` (Bảng: `tags`)
- **Mục đích:** Quản lý danh mục nhãn phân loại từ khóa tự do của người dùng.
- **Thuộc tính:**
  - `id`: Khóa chính (BIGINT UNSIGNED, AUTO_INCREMENT).
  - `user_id`: Khóa ngoại trỏ đến `users.id` (ON DELETE CASCADE, NOT NULL).
  - `name`: Tên nhãn từ khóa (VARCHAR(50), NOT NULL).
  - `color`: Mã màu hiển thị (VARCHAR(30), NULL).
  - `created_at`: Thời điểm tạo nhãn (DATETIME, NOT NULL).
  - *Ràng buộc:* UNIQUE(`user_id`, `name`).

#### 8. Thực thể `DOCUMENT_TAG` (Bảng: `document_tags`)
- **Mục đích:** Bảng kết hợp quan hệ N-N giữa Tài liệu và Nhãn phân loại.
- **Thuộc tính:**
  - `document_id`: Khóa ngoại trỏ đến `documents.id` (ON DELETE CASCADE, NOT NULL).
  - `tag_id`: Khóa ngoại trỏ đến `tags.id` (ON DELETE CASCADE, NOT NULL).
  - `created_at`: Thời điểm gắn thẻ (DATETIME, NOT NULL).
  - *Khóa chính tổng hợp:* PRIMARY KEY (`document_id`, `tag_id`).

#### 9. Thực thể `COLLECTION` (Bảng: `collections`)
- **Mục đích:** Tạo bộ sưu tập chủ đề liên kết đa đối tượng (tài liệu, ghi chú, flashcard deck).
- **Thuộc tính:**
  - `id`: Khóa chính (UUID / VARCHAR(36)).
  - `user_id`: Khóa ngoại trỏ đến `users.id` (ON DELETE CASCADE, NOT NULL).
  - `name`: Tên bộ sưu tập (VARCHAR(150), NOT NULL).
  - `description`: Mô tả mục đích bộ sưu tập (TEXT, NULL).
  - `color`: Màu nhận diện (VARCHAR(30), NULL).
  - `created_at`: Thời điểm tạo (DATETIME, NOT NULL).
  - `updated_at`: Thời điểm cập nhật (DATETIME, NOT NULL).

#### 10. Thực thể `COLLECTION_ITEM` (Bảng: `collection_items`)
- **Mục đích:** Bảng liên kết các phần tử thuộc nhiều loại khác nhau trong bộ sưu tập.
- **Thuộc tính:**
  - `id`: Khóa chính (BIGINT UNSIGNED, AUTO_INCREMENT).
  - `collection_id`: Khóa ngoại trỏ đến `collections.id` (ON DELETE CASCADE, NOT NULL).
  - `item_type`: Loại phần tử (`document`, `note`, `deck` - VARCHAR(20), NOT NULL).
  - `item_id`: Khóa định danh của đối tượng tương ứng (VARCHAR(36), NOT NULL).
  - `added_at`: Thời điểm thêm vào bộ sưu tập (DATETIME, NOT NULL).
  - *Ràng buộc:* UNIQUE(`collection_id`, `item_type`, `item_id`).

---

### 2.3. Phân hệ Quản lý Gói nén ZIP/7Z (Archive Domain)

#### 11. Thực thể `ARCHIVE` (Bảng: `archives`)
- **Mục đích:** Lưu trữ gói nén gốc, thông tin quét an toàn và cấu trúc manifest danh sách file.
- **Thuộc tính:**
  - `id`: Khóa chính (UUID / VARCHAR(36)).
  - `user_id`: Khóa ngoại trỏ đến `users.id` (ON DELETE CASCADE, NOT NULL).
  - `name`: Tên hiển thị của gói nén (VARCHAR(255), NOT NULL).
  - `original_name`: Tên file gốc người dùng tải lên (VARCHAR(255), NOT NULL).
  - `format`: Định dạng gói nén (`zip`, `7z` - VARCHAR(10), NOT NULL).
  - `file_size`: Kích thước file nén tính theo bytes (BIGINT UNSIGNED, NOT NULL).
  - `file_count`: Tổng số tệp con bên trong (INT UNSIGNED, NOT NULL).
  - `storage_path`: Đường dẫn lưu gói nén gốc trên đĩa lưu trữ (VARCHAR(500), NOT NULL).
  - `sha256_checksum`: Mã băm SHA-256 của gói nén (CHAR(64), NOT NULL).
  - `scan_status`: Trạng thái quét an toàn (`clean`, `warning`, `quarantined`, `rejected`, DEFAULT `clean`).
  - `manifest_json`: Cấu trúc cây thư mục và danh sách metadata các file con bên trong (LONGTEXT / JSON, NOT NULL).
  - `created_at`: Thời điểm tải lên (DATETIME, NOT NULL).
  - `updated_at`: Thời điểm cập nhật gần nhất (DATETIME, NOT NULL).

#### 12. Thực thể `ARCHIVE_EXTRACTED_FILE` (Bảng: `archive_extracted_files`)
- **Mục đích:** Lưu vết các file con đã được trích xuất từ gói nén và đưa vào thư viện tài liệu.
- **Thuộc tính:**
  - `id`: Khóa chính (BIGINT UNSIGNED, AUTO_INCREMENT).
  - `archive_id`: Khóa ngoại trỏ đến `archives.id` (ON DELETE CASCADE, NOT NULL).
  - `document_id`: Khóa ngoại trỏ đến `documents.id` (ON DELETE CASCADE, NOT NULL).
  - `inner_path`: Đường dẫn tương đối của file bên trong gói nén ban đầu (VARCHAR(500), NOT NULL).
  - `extracted_at`: Thời điểm giải nén (DATETIME, NOT NULL).
  - *Ràng buộc:* UNIQUE(`archive_id`, `inner_path`).

---

### 2.4. Phân hệ AI BYOK & Quy trình AI (AI BYOK & Workflows Domain)

#### 13. Thực thể `AI_CONNECTION` (Bảng: `ai_connections`)
- **Mục đích:** Lưu trữ thông tin kết nối và API Key được mã hóa đối xứng của người dùng.
- **Thuộc tính:**
  - `id`: Khóa chính (UUID / VARCHAR(36)).
  - `user_id`: Khóa ngoại trỏ đến `users.id` (ON DELETE CASCADE, NOT NULL).
  - `provider`: Nhà cung cấp AI (`gemini`, `openai`, `claude`, `groq`, `openrouter`, `custom` - VARCHAR(50), NOT NULL).
  - `name`: Tên gợi nhớ kết nối do người dùng đặt (VARCHAR(100), NOT NULL).
  - `api_endpoint`: URL endpoint tùy chỉnh đối với custom provider (VARCHAR(255), NULL).
  - `encrypted_api_key`: Khóa API đã được mã hóa bằng AES-256-GCM (VARBINARY(512), NOT NULL).
  - `encryption_iv`: Initialization Vector dùng cho mã hóa (VARBINARY(16), NOT NULL).
  - `encryption_tag`: Authentication Tag xác thực tính toàn vẹn (VARBINARY(16), NOT NULL).
  - `api_key_masked`: Chuỗi làm mờ API Key chỉ để hiển thị trên UI (VARCHAR(64), NOT NULL).
  - `default_model`: Tên model mặc định được chọn (VARCHAR(100), NOT NULL).
  - `available_models_json`: Danh sách các model hỗ trợ lưu dạng JSON (TEXT, NULL).
  - `is_connected`: Trạng thái kết nối thành công (`TRUE`/`FALSE`, DEFAULT `FALSE`).
  - `last_tested_at`: Thời điểm kiểm tra kết nối gần nhất (DATETIME, NULL).
  - `created_at`: Thời điểm tạo kết nối (DATETIME, NOT NULL).
  - `updated_at`: Thời điểm cập nhật (DATETIME, NOT NULL).

#### 14. Thực thể `AI_TASK` (Bảng: `ai_tasks`)
- **Mục đích:** Quản lý quy trình hoặc tác vụ AI tự động (sinh trắc nghiệm, tóm tắt, OCR).
- **Thuộc tính:**
  - `id`: Khóa chính (UUID / VARCHAR(36)).
  - `user_id`: Khóa ngoại trỏ đến `users.id` (ON DELETE CASCADE, NOT NULL).
  - `source_document_id`: Khóa ngoại trỏ đến `documents.id` (ON DELETE SET NULL, NULL nếu tác vụ tổng hợp).
  - `name`: Tên quy trình / tác vụ (VARCHAR(150), NOT NULL).
  - `description`: Mô tả chi tiết mục tiêu xử lý (TEXT, NULL).
  - `trigger_type`: Cơ chế kích hoạt (`manual`, `on_upload`, `on_extract` - VARCHAR(30), DEFAULT `manual`).
  - `status`: Trạng thái xử lý (`queued`, `processing`, `completed`, `failed` - VARCHAR(20), DEFAULT `queued`).
  - `progress`: Tiến độ xử lý tính theo phần trăm (TINYINT UNSIGNED, DEFAULT 0).
  - `created_at`: Thời điểm tạo tác vụ (DATETIME, NOT NULL).
  - `completed_at`: Thời điểm hoàn thành tác vụ (DATETIME, NULL).

#### 15. Thực thể `AI_TASK_LOG` (Bảng: `ai_task_logs`)
- **Mục đích:** Lưu lịch sử các lần chạy và nhật ký chi tiết từng bước của tác vụ AI.
- **Thuộc tính:**
  - `id`: Khóa chính (BIGINT UNSIGNED, AUTO_INCREMENT).
  - `task_id`: Khóa ngoại trỏ đến `ai_tasks.id` (ON DELETE CASCADE, NOT NULL).
  - `step_name`: Tên bước thực hiện (VARCHAR(100), NOT NULL).
  - `status`: Trạng thái bước (`success`, `failed`, `running` - VARCHAR(20), NOT NULL).
  - `duration_ms`: Thời gian thực hiện tính bằng mili-giây (INT UNSIGNED, DEFAULT 0).
  - `tokens_used`: Số token AI đã tiêu thụ (INT UNSIGNED, DEFAULT 0).
  - `input_summary`: Dữ liệu đầu vào tóm lược (TEXT, NULL).
  - `output_summary`: Kết quả xử lý đầu ra (LONGTEXT, NULL).
  - `error_message`: Thông báo lỗi chi tiết nếu có sự cố (TEXT, NULL).
  - `executed_at`: Thời điểm bắt đầu chạy bước (DATETIME, NOT NULL).

---

### 2.5. Phân hệ AI Context JSON (AI Context Domain)

#### 16. Thực thể `AI_CONTEXT` (Bảng: `ai_contexts`)
- **Mục đích:** Lưu trữ kho ngữ cảnh tri thức có cấu trúc (AI Knowledge Capsule) độc lập với lịch sử chat.
- **Thuộc tính:**
  - `id`: Khóa chính (UUID / VARCHAR(36)).
  - `user_id`: Khóa ngoại trỏ đến `users.id` (ON DELETE CASCADE, NOT NULL).
  - `title`: Tiêu đề ngữ cảnh tri thức (VARCHAR(200), NOT NULL).
  - `schema_version`: Phiên bản cấu trúc schema JSON (VARCHAR(20), DEFAULT `1.0.0`, NOT NULL).
  - `current_version`: Phiên bản nội dung tri thức hiện hành (VARCHAR(20), DEFAULT `1.0.0`, NOT NULL).
  - `summary`: Tóm tắt tổng quan tri thức tích lũy (TEXT, NOT NULL).
  - `knowledge_points_json`: Mảng JSON chứa các nguyên tử tri thức đã kiểm chứng (LONGTEXT / JSON, NOT NULL).
  - `conclusions_json`: Mảng JSON các kết luận cốt lõi (LONGTEXT / JSON, NOT NULL).
  - `open_questions_json`: Mảng JSON các câu hỏi mở cần giải quyết tiếp theo (LONGTEXT / JSON, NULL).
  - `learning_progress`: Điểm phần trăm mức độ thấu hiểu (TINYINT UNSIGNED, DEFAULT 0).
  - `handoff_directive`: Hướng dẫn sư phạm và định hướng cho phiên AI tiếp theo (TEXT, NULL).
  - `created_at`: Thời điểm khởi tạo ngữ cảnh (DATETIME, NOT NULL).
  - `updated_at`: Thời điểm cập nhật ngữ cảnh gần nhất (DATETIME, NOT NULL).

#### 17. Thực thể `AI_CONTEXT_VERSION` (Bảng: `ai_context_versions`)
- **Mục đích:** Lưu vết các bản chụp nhanh (Snapshot) phục vụ khôi phục (restore) hoặc so sánh thay đổi.
- **Thuộc tính:**
  - `id`: Khóa chính (BIGINT UNSIGNED, AUTO_INCREMENT).
  - `context_id`: Khóa ngoại trỏ đến `ai_contexts.id` (ON DELETE CASCADE, NOT NULL).
  - `version_tag`: Số hiệu phiên bản snapshot (VARCHAR(20), NOT NULL).
  - `snapshot_json`: Bản sao lưu toàn bộ trạng thái dữ liệu JSON tại thời điểm chụp (LONGTEXT / JSON, NOT NULL).
  - `change_note`: Ghi chú lý do cập nhật hoặc thay đổi phiên bản (VARCHAR(255), NULL).
  - `created_at`: Thời điểm chụp snapshot (DATETIME, NOT NULL).
  - *Ràng buộc:* UNIQUE(`context_id`, `version_tag`).

---

### 2.6. Phân hệ Flashcards & Quiz (Learning Domain)

#### 18. Thực thể `FLASHCARD_DECK` (Bảng: `flashcard_decks`)
- **Mục đích:** Quản lý bộ thẻ học tập theo chuyên đề hoặc gắn kèm tài liệu.
- **Thuộc tính:**
  - `id`: Khóa chính (UUID / VARCHAR(36)).
  - `user_id`: Khóa ngoại trỏ đến `users.id` (ON DELETE CASCADE, NOT NULL).
  - `document_id`: Khóa ngoại trỏ đến `documents.id` (ON DELETE SET NULL, NULL nếu tạo tự do).
  - `name`: Tên bộ thẻ (VARCHAR(150), NOT NULL).
  - `description`: Mô tả bộ thẻ (TEXT, NULL).
  - `created_at`: Thời điểm tạo (DATETIME, NOT NULL).
  - `updated_at`: Thời điểm cập nhật (DATETIME, NOT NULL).

#### 19. Thực thể `FLASHCARD` (Bảng: `flashcards`)
- **Mục đích:** Thẻ ghi nhớ đơn lẻ chứa câu hỏi mặt trước và đáp án mặt sau.
- **Thuộc tính:**
  - `id`: Khóa chính (UUID / VARCHAR(36)).
  - `deck_id`: Khóa ngoại trỏ đến `flashcard_decks.id` (ON DELETE CASCADE, NOT NULL).
  - `front_text`: Nội dung câu hỏi mặt trước (TEXT, NOT NULL).
  - `back_text`: Nội dung câu trả lời mặt sau (TEXT, NOT NULL).
  - `is_known`: Trạng thái người học đã ghi nhớ (`TRUE`/`FALSE`, DEFAULT `FALSE`).
  - `review_count`: Số lần đã ôn tập thẻ này (INT UNSIGNED, DEFAULT 0).
  - `last_reviewed_at`: Thời điểm ôn tập gần nhất (DATETIME, NULL).
  - `created_at`: Thời điểm tạo thẻ (DATETIME, NOT NULL).
  - `updated_at`: Thời điểm cập nhật thẻ (DATETIME, NOT NULL).

#### 20. Thực thể `QUIZ` (Bảng: `quizzes`)
- **Mục đích:** Đề thi / Bài kiểm tra trắc nghiệm kiến thức.
- **Thuộc tính:**
  - `id`: Khóa chính (UUID / VARCHAR(36)).
  - `user_id`: Khóa ngoại trỏ đến `users.id` (ON DELETE CASCADE, NOT NULL).
  - `document_id`: Khóa ngoại trỏ đến `documents.id` (ON DELETE SET NULL, NULL nếu tạo tự do).
  - `title`: Tiêu đề bài trắc nghiệm (VARCHAR(200), NOT NULL).
  - `description`: Hướng dẫn hoặc mục tiêu bài làm (TEXT, NULL).
  - `time_limit_sec`: Giới hạn thời gian làm bài tính theo giây (INT UNSIGNED, DEFAULT 0 = không giới hạn).
  - `max_attempts`: Số lần tối đa được làm lại (TINYINT UNSIGNED, DEFAULT 0 = không giới hạn).
  - `created_at`: Thời điểm tạo bài trắc nghiệm (DATETIME, NOT NULL).
  - `updated_at`: Thời điểm cập nhật (DATETIME, NOT NULL).

#### 21. Thực thể `QUIZ_QUESTION` (Bảng: `quiz_questions`)
- **Mục đích:** Danh sách câu hỏi trong bài thi trắc nghiệm.
- **Thuộc tính:**
  - `id`: Khóa chính (UUID / VARCHAR(36)).
  - `quiz_id`: Khóa ngoại trỏ đến `quizzes.id` (ON DELETE CASCADE, NOT NULL).
  - `question_text`: Nội dung câu hỏi trắc nghiệm (TEXT, NOT NULL).
  - `order_index`: Thứ tự hiển thị câu hỏi (INT UNSIGNED, DEFAULT 1).
  - `explanation`: Lời giải thích chuyên sâu sau khi chọn đáp án (TEXT, NULL).
  - `created_at`: Thời điểm tạo câu hỏi (DATETIME, NOT NULL).

#### 22. Thực thể `QUIZ_OPTION` (Bảng: `quiz_options`)
- **Mục đích:** Các đáp án lựa chọn của từng câu hỏi (A, B, C, D).
- **Thuộc tính:**
  - `id`: Khóa chính (UUID / VARCHAR(36)).
  - `question_id`: Khóa ngoại trỏ đến `quiz_questions.id` (ON DELETE CASCADE, NOT NULL).
  - `option_text`: Nội dung đáp án (TEXT, NOT NULL).
  - `is_correct`: Cờ xác định đây có phải đáp án đúng không (BOOLEAN, DEFAULT FALSE).
  - `order_index`: Thứ tự lựa chọn (TINYINT UNSIGNED, DEFAULT 1).

#### 23. Thực thể `QUIZ_ATTEMPT` (Bảng: `quiz_attempts`)
- **Mục đích:** Ghi nhận từng lượt làm bài thi trắc nghiệm của người học.
- **Thuộc tính:**
  - `id`: Khóa chính (UUID / VARCHAR(36)).
  - `quiz_id`: Khóa ngoại trỏ đến `quizzes.id` (ON DELETE CASCADE, NOT NULL).
  - `user_id`: Khóa ngoại trỏ đến `users.id` (ON DELETE CASCADE, NOT NULL).
  - `score`: Điểm số đạt được tính theo thang 100 hoặc tỉ lệ (DECIMAL(5,2), NOT NULL).
  - `correct_answers`: Tổng số câu trả lời đúng (INT UNSIGNED, NOT NULL).
  - `total_questions`: Tổng số câu hỏi của bài kiểm tra (INT UNSIGNED, NOT NULL).
  - `duration_sec`: Thời gian hoàn thành tính theo giây (INT UNSIGNED, NOT NULL).
  - `started_at`: Thời điểm bắt đầu làm bài (DATETIME, NOT NULL).
  - `completed_at`: Thời điểm nộp bài (DATETIME, NOT NULL).

#### 24. Thực thể `QUIZ_ATTEMPT_ANSWER` (Bảng: `quiz_attempt_answers`)
- **Mục đích:** Lưu chi tiết đáp án mà người học đã chọn cho từng câu hỏi, phục vụ xem lại câu sai.
- **Thuộc tính:**
  - `id`: Khóa chính (BIGINT UNSIGNED, AUTO_INCREMENT).
  - `attempt_id`: Khóa ngoại trỏ đến `quiz_attempts.id` (ON DELETE CASCADE, NOT NULL).
  - `question_id`: Khóa ngoại trỏ đến `quiz_questions.id` (ON DELETE CASCADE, NOT NULL).
  - `selected_option_id`: Khóa ngoại trỏ đến `quiz_options.id` (ON DELETE CASCADE, NOT NULL).
  - `is_correct`: Cờ đánh dấu câu trả lời đúng hay sai (BOOLEAN, NOT NULL).
  - *Ràng buộc:* UNIQUE(`attempt_id`, `question_id`).

---

### 2.7. Phân hệ Chia sẻ Ngoại vi (Sharing Domain)

#### 25. Thực thể `SHARED_LINK` (Bảng: `shared_links`)
- **Mục đích:** Quản lý liên kết chia sẻ tài liệu ra ngoài mà người nhận không cần đăng ký tài khoản.
- **Thuộc tính:**
  - `id`: Khóa chính (UUID / VARCHAR(36)).
  - `user_id`: Khóa ngoại trỏ đến `users.id` (ON DELETE CASCADE, NOT NULL).
  - `document_id`: Khóa ngoại trỏ đến `documents.id` (ON DELETE CASCADE, NOT NULL).
  - `title`: Tiêu đề công khai hiển thị trên trang chia sẻ (VARCHAR(255), NOT NULL).
  - `token_hash`: Mã băm SHA-256 của chuỗi bảo mật Share Token (CHAR(64), UNIQUE, NOT NULL).
  - `password_hash`: Chuỗi băm mật khẩu bảo vệ liên kết nếu có (VARCHAR(255), NULL).
  - `allow_download`: Cờ cho phép người nhận tải file gốc về máy (BOOLEAN, DEFAULT TRUE).
  - `expires_at`: Thời điểm hết hạn truy cập liên kết (DATETIME, NULL = không hết hạn).
  - `views_count`: Số lượt truy cập đã ghi nhận (INT UNSIGNED, DEFAULT 0).
  - `is_revoked`: Cờ thu hồi liên kết tức thì (BOOLEAN, DEFAULT FALSE).
  - `created_at`: Thời điểm tạo liên kết (DATETIME, NOT NULL).
  - `updated_at`: Thời điểm cấu hình lại (DATETIME, NOT NULL).

#### 26. Thực thể `SHARE_ACCESS_LOG` (Bảng: `share_access_logs`)
- **Mục đích:** Lưu vết chi tiết từng lượt xem hoặc tải tài liệu từ liên kết chia sẻ.
- **Thuộc tính:**
  - `id`: Khóa chính (BIGINT UNSIGNED, AUTO_INCREMENT).
  - `shared_link_id`: Khóa ngoại trỏ đến `shared_links.id` (ON DELETE CASCADE, NOT NULL).
  - `action`: Hành vi truy cập (`view` hoặc `download` - VARCHAR(20), NOT NULL).
  - `ip_address`: Địa chỉ IP của người truy cập (VARCHAR(45), NOT NULL).
  - `user_agent`: Thông tin trình duyệt và hệ điều hành (VARCHAR(255), NOT NULL).
  - `accessed_at`: Thời điểm truy cập (DATETIME, NOT NULL).

---

### 2.8. Phân hệ Vận hành & Thông báo (Operations Domain)

#### 27. Thực thể `ACTIVITY_LOG` (Bảng: `activity_logs`)
- **Mục đích:** Ghi nhận nhật ký audit trail của người dùng (tải lên, giải nén, cập nhật ngữ cảnh, v.v.).
- **Thuộc tính:**
  - `id`: Khóa chính (BIGINT UNSIGNED, AUTO_INCREMENT).
  - `user_id`: Khóa ngoại trỏ đến `users.id` (ON DELETE CASCADE, NOT NULL).
  - `event_type`: Loại sự kiện (`document_upload`, `archive_extract`, `context_snapshot`, `quiz_complete` - VARCHAR(50), NOT NULL).
  - `description`: Mô tả chi tiết hành động bằng ngôn ngữ tự nhiên (VARCHAR(255), NOT NULL).
  - `entity_type`: Loại thực thể tác động (`document`, `archive`, `context`, `quiz` - VARCHAR(30), NULL).
  - `entity_id`: Khóa định danh của thực thể tác động (VARCHAR(36), NULL).
  - `created_at`: Thời điểm ghi nhận sự kiện (DATETIME, NOT NULL).

#### 28. Thực thể `NOTIFICATION` (Bảng: `notifications`)
- **Mục đích:** Thông báo trong ứng dụng gửi đến người dùng (nhắc nhở ôn thẻ, báo hoàn thành tác vụ AI, cảnh báo dung lượng).
- **Thuộc tính:**
  - `id`: Khóa chính (UUID / VARCHAR(36)).
  - `user_id`: Khóa ngoại trỏ đến `users.id` (ON DELETE CASCADE, NOT NULL).
  - `title`: Tiêu đề thông báo ngắn gọn (VARCHAR(150), NOT NULL).
  - `message`: Nội dung chi tiết thông báo (TEXT, NOT NULL).
  - `type`: Phân loại thông báo (`learning`, `ai`, `share`, `system` - VARCHAR(30), NOT NULL).
  - `icon`: Mã icon Lucide đại diện (VARCHAR(50), DEFAULT `bell`).
  - `is_read`: Cờ đánh dấu đã đọc (`TRUE`/`FALSE`, DEFAULT `FALSE`).
  - `created_at`: Thời điểm gửi thông báo (DATETIME, NOT NULL).
