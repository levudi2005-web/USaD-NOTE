# MÔ HÌNH VẬT LÝ DỮ LIỆU — MPD (MODÈLE PHYSIQUE DE DONNÉES) CHO MARIADB

---

## 1. THÔNG SỐ VẬT LÝ HỆ THỐNG MARIADB

- **Hệ quản trị CSDL đích:** MariaDB 10.6+ / 11.x
- **Storage Engine:** `InnoDB`
- **Bộ mã ký tự (Character Set):** `utf8mb4`
- **Bộ so khớp sắp xếp (Collation):** `utf8mb4_unicode_ci`
- **Chiến lược định danh khóa chính (Primary Key Strategy):**
  - Thực thể nghiệp vụ người dùng tương tác trực tiếp (`users`, `documents`, `folders`, `notes`, `collections`, `archives`, `ai_connections`, `ai_tasks`, `ai_contexts`, `flashcard_decks`, `quizzes`, `shared_links`, `notifications`): Dùng **UUID v4 (CHAR(36))** nhằm bảo đảm tính bảo mật không đoán được ID, an toàn khi chia sẻ URL và sẵn sàng mở rộng phân tán.
  - Thực thể kỹ thuật / Nhật ký con (`user_recovery_codes`, `user_sessions`, `collection_items`, `archive_extracted_files`, `ai_task_logs`, `ai_context_versions`, `quiz_attempt_answers`, `share_access_logs`, `activity_logs`): Dùng **BIGINT UNSIGNED AUTO_INCREMENT** để tối ưu hóa bộ nhớ RAM, kích thước B-Tree Index và tốc độ ghi dồn dập (Append-only logs).

---

## 2. BẢNG CHI TIẾT 32 BẢNG VẬT LÝ, KIỂU DỮ LIỆU VÀ CHỈ MỤC

### 2.1. Phân hệ Tài khoản (Account Domain)

#### Bảng `users`
```sql
CREATE TABLE `users` (
  `id` CHAR(36) NOT NULL COMMENT 'UUID v4 định danh tài khoản',
  `email` VARCHAR(191) NOT NULL COMMENT 'Email đăng nhập duy nhất',
  `password_hash` VARCHAR(255) NOT NULL COMMENT 'Mã băm mật khẩu Argon2id / Bcrypt',
  `full_name` VARCHAR(100) NOT NULL COMMENT 'Họ và tên hiển thị',
  `avatar_url` VARCHAR(255) DEFAULT NULL COMMENT 'Đường dẫn ảnh đại diện',
  `title` VARCHAR(100) DEFAULT NULL COMMENT 'Chức danh nghề nghiệp',
  `bio` TEXT DEFAULT NULL COMMENT 'Tiểu sử cá nhân',
  `theme_preference` ENUM('light', 'dark', 'auto') NOT NULL DEFAULT 'auto' COMMENT 'Chế độ giao diện',
  `language` VARCHAR(10) NOT NULL DEFAULT 'vi' COMMENT 'Ngôn ngữ giao diện (vi, en)',
  `storage_used` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Dung lượng đã dùng (bytes)',
  `storage_limit` BIGINT UNSIGNED NOT NULL DEFAULT 1073741824 COMMENT 'Hạn mức dung lượng (bytes, mặc định 1GB)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm đăng ký',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Thời điểm cập nhật hồ sơ',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tài khoản người dùng';
```

#### Bảng `user_recovery_codes`
```sql
CREATE TABLE `user_recovery_codes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Khóa chính tự tăng',
  `user_id` CHAR(36) NOT NULL COMMENT 'Tài khoản sở hữu mã',
  `code_hash` CHAR(64) NOT NULL COMMENT 'Mã băm SHA-256 của Recovery Code',
  `used_at` DATETIME DEFAULT NULL COMMENT 'Thời điểm sử dụng (NULL = chưa dùng)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tạo mã',
  PRIMARY KEY (`id`),
  KEY `idx_recovery_user_unused` (`user_id`, `used_at`),
  CONSTRAINT `fk_recovery_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Mã khôi phục mật khẩu một lần';
```

#### Bảng `user_sessions`
```sql
CREATE TABLE `user_sessions` (
  `id` CHAR(36) NOT NULL COMMENT 'UUID định danh phiên',
  `user_id` CHAR(36) NOT NULL COMMENT 'Tài khoản đăng nhập',
  `session_token_hash` CHAR(64) NOT NULL COMMENT 'Mã băm SHA-256 của Session Token',
  `device_info` VARCHAR(255) NOT NULL COMMENT 'Thông tin thiết bị và trình duyệt',
  `ip_address` VARCHAR(45) NOT NULL COMMENT 'Địa chỉ IPv4/IPv6',
  `last_active_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm hoạt động gần nhất',
  `expires_at` DATETIME NOT NULL COMMENT 'Thời điểm hết hạn phiên',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm khởi tạo phiên',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sessions_token_hash` (`session_token_hash`),
  KEY `idx_sessions_user_expires` (`user_id`, `expires_at`),
  CONSTRAINT `fk_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Phiên đăng nhập người dùng';
```

---

### 2.2. Phân hệ Tài liệu & Lưu trữ (Document & Storage Domain)

#### Bảng `folders`
```sql
CREATE TABLE `folders` (
  `id` CHAR(36) NOT NULL COMMENT 'UUID định danh thư mục',
  `user_id` CHAR(36) NOT NULL COMMENT 'Tài khoản sở hữu thư mục',
  `parent_id` CHAR(36) DEFAULT NULL COMMENT 'Thư mục cha (NULL nếu là thư mục gốc)',
  `name` VARCHAR(150) NOT NULL COMMENT 'Tên thư mục',
  `color` VARCHAR(30) DEFAULT NULL COMMENT 'Mã màu nhận diện giao diện',
  `icon` VARCHAR(50) NOT NULL DEFAULT 'folder' COMMENT 'Tên icon Lucide',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tạo',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Thời điểm sửa đổi',
  PRIMARY KEY (`id`),
  KEY `idx_folders_user_parent` (`user_id`, `parent_id`),
  CONSTRAINT `fk_folders_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_folders_parent` FOREIGN KEY (`parent_id`) REFERENCES `folders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Cấu trúc thư mục phân cấp';
```

#### Bảng `documents`
```sql
CREATE TABLE `documents` (
  `id` CHAR(36) NOT NULL COMMENT 'UUID định danh tài liệu',
  `user_id` CHAR(36) NOT NULL COMMENT 'Tài khoản sở hữu tài liệu',
  `folder_id` CHAR(36) DEFAULT NULL COMMENT 'Thư mục chứa tài liệu (NULL nếu ở gốc)',
  `name` VARCHAR(255) NOT NULL COMMENT 'Tên hiển thị tài liệu',
  `original_name` VARCHAR(255) NOT NULL COMMENT 'Tên file gốc khi upload',
  `file_type` VARCHAR(20) NOT NULL COMMENT 'Phần mở rộng (pdf, docx, xlsx, txt...)',
  `mime_type` VARCHAR(100) NOT NULL COMMENT 'MIME Type chuẩn (application/pdf...)',
  `file_size` BIGINT UNSIGNED NOT NULL COMMENT 'Kích thước tệp (bytes)',
  `storage_path` VARCHAR(500) NOT NULL COMMENT 'Đường dẫn vật lý trên đĩa/storage',
  `sha256_checksum` CHAR(64) NOT NULL COMMENT 'Mã băm SHA-256 đối soát toàn vẹn',
  `processing_status` ENUM('pending', 'processing', 'ready', 'failed') NOT NULL DEFAULT 'ready' COMMENT 'Trạng thái xử lý',
  `extracted_text` LONGTEXT DEFAULT NULL COMMENT 'Toàn văn bản trích xuất phục vụ tìm kiếm',
  `deleted_at` DATETIME DEFAULT NULL COMMENT 'Thời điểm xóa mềm (NULL = chưa xóa)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tải lên',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Thời điểm cập nhật',
  PRIMARY KEY (`id`),
  KEY `idx_documents_user_deleted` (`user_id`, `deleted_at`, `created_at` DESC),
  KEY `idx_documents_folder` (`folder_id`),
  KEY `idx_documents_checksum` (`sha256_checksum`),
  FULLTEXT KEY `ft_documents_content` (`name`, `extracted_text`),
  CONSTRAINT `fk_documents_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_documents_folder` FOREIGN KEY (`folder_id`) REFERENCES `folders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Metadata tài liệu số';
```

#### Bảng `notes`
```sql
CREATE TABLE `notes` (
  `id` CHAR(36) NOT NULL COMMENT 'UUID định danh ghi chú',
  `user_id` CHAR(36) NOT NULL COMMENT 'Tài khoản sở hữu ghi chú',
  `folder_id` CHAR(36) DEFAULT NULL COMMENT 'Thư mục phân loại (nếu có)',
  `document_id` CHAR(36) DEFAULT NULL COMMENT 'Tài liệu liên kết (nếu có)',
  `title` VARCHAR(255) NOT NULL COMMENT 'Tiêu đề ghi chú',
  `category` VARCHAR(100) DEFAULT NULL COMMENT 'Danh mục chủ đề',
  `content` LONGTEXT DEFAULT NULL COMMENT 'Nội dung ghi chú HTML/Markdown',
  `is_pinned` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Cờ ghim lên đầu',
  `is_favorite` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Cờ yêu thích',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tạo',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Thời điểm sửa',
  PRIMARY KEY (`id`),
  KEY `idx_notes_user_doc` (`user_id`, `document_id`),
  KEY `idx_notes_folder` (`folder_id`),
  FULLTEXT KEY `ft_notes_text` (`title`, `content`),
  CONSTRAINT `fk_notes_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_notes_folder` FOREIGN KEY (`folder_id`) REFERENCES `folders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_notes_document` FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Ghi chú cá nhân và ghi chú tài liệu';
```

#### Bảng `tags` & `document_tags`
```sql
CREATE TABLE `tags` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Khóa chính tự tăng',
  `user_id` CHAR(36) NOT NULL COMMENT 'Tài khoản sở hữu nhãn',
  `name` VARCHAR(50) NOT NULL COMMENT 'Tên nhãn từ khóa',
  `color` VARCHAR(30) DEFAULT NULL COMMENT 'Mã màu nhận diện',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tạo',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tags_user_name` (`user_id`, `name`),
  CONSTRAINT `fk_tags_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Danh mục nhãn phân loại';

CREATE TABLE `document_tags` (
  `document_id` CHAR(36) NOT NULL COMMENT 'Tài liệu được gắn thẻ',
  `tag_id` BIGINT UNSIGNED NOT NULL COMMENT 'Nhãn được gắn',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm gắn',
  PRIMARY KEY (`document_id`, `tag_id`),
  KEY `idx_doc_tags_tag` (`tag_id`),
  CONSTRAINT `fk_doctags_document` FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_doctags_tag` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng kết hợp N-N Tài liệu và Nhãn';
```

#### Bảng `collections` & `collection_items`
```sql
CREATE TABLE `collections` (
  `id` CHAR(36) NOT NULL COMMENT 'UUID định danh bộ sưu tập',
  `user_id` CHAR(36) NOT NULL COMMENT 'Tài khoản sở hữu bộ sưu tập',
  `name` VARCHAR(150) NOT NULL COMMENT 'Tên bộ sưu tập',
  `description` TEXT DEFAULT NULL COMMENT 'Mô tả bộ sưu tập',
  `color` VARCHAR(30) DEFAULT NULL COMMENT 'Mã màu nhận diện',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tạo',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Thời điểm sửa',
  PRIMARY KEY (`id`),
  KEY `idx_collections_user` (`user_id`),
  CONSTRAINT `fk_collections_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bộ sưu tập chuyên đề';

CREATE TABLE `collection_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Khóa chính tự tăng',
  `collection_id` CHAR(36) NOT NULL COMMENT 'Bộ sưu tập chứa phần tử',
  `item_type` ENUM('document', 'note', 'deck') NOT NULL COMMENT 'Loại đối tượng',
  `item_id` VARCHAR(36) NOT NULL COMMENT 'ID của tài liệu/ghi chú/bộ thẻ',
  `added_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm thêm vào',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_coll_items_unique` (`collection_id`, `item_type`, `item_id`),
  KEY `idx_coll_items_item` (`item_type`, `item_id`),
  CONSTRAINT `fk_coll_items_collection` FOREIGN KEY (`collection_id`) REFERENCES `collections` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Phần tử trong bộ sưu tập';
```

---

### 2.3. Phân hệ Gói nén ZIP/7Z (Archive Domain)

#### Bảng `archives`
```sql
CREATE TABLE `archives` (
  `id` CHAR(36) NOT NULL COMMENT 'UUID định danh gói nén',
  `user_id` CHAR(36) NOT NULL COMMENT 'Tài khoản sở hữu gói nén',
  `name` VARCHAR(255) NOT NULL COMMENT 'Tên hiển thị gói nén',
  `original_name` VARCHAR(255) NOT NULL COMMENT 'Tên file gốc khi upload',
  `format` ENUM('zip', '7z') NOT NULL COMMENT 'Định dạng gói nén',
  `file_size` BIGINT UNSIGNED NOT NULL COMMENT 'Kích thước file nén (bytes)',
  `file_count` INT UNSIGNED NOT NULL COMMENT 'Tổng số file bên trong gói nén',
  `storage_path` VARCHAR(500) NOT NULL COMMENT 'Đường dẫn lưu trữ gói nén gốc',
  `sha256_checksum` CHAR(64) NOT NULL COMMENT 'Mã băm SHA-256 gói nén',
  `scan_status` ENUM('clean', 'warning', 'quarantined', 'rejected') NOT NULL DEFAULT 'clean' COMMENT 'Trạng thái quét an toàn',
  `manifest_json` LONGTEXT NOT NULL COMMENT 'Cây thư mục và danh sách file con bên trong dạng JSON',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tải lên',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Thời điểm cập nhật',
  PRIMARY KEY (`id`),
  KEY `idx_archives_user` (`user_id`, `created_at` DESC),
  CONSTRAINT `fk_archives_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Gói nén ZIP và 7Z';
```

#### Bảng `archive_extracted_files`
```sql
CREATE TABLE `archive_extracted_files` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Khóa chính tự tăng',
  `archive_id` CHAR(36) NOT NULL COMMENT 'Gói nén nguồn',
  `document_id` CHAR(36) NOT NULL COMMENT 'Tài liệu đích đã tạo trong thư viện',
  `inner_path` VARCHAR(500) NOT NULL COMMENT 'Đường dẫn tương đối bên trong gói nén ban đầu',
  `extracted_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm giải nén',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_arch_extract_path` (`archive_id`, `inner_path`),
  KEY `idx_arch_extract_doc` (`document_id`),
  CONSTRAINT `fk_archext_archive` FOREIGN KEY (`archive_id`) REFERENCES `archives` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_archext_document` FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Liên kết file giải nén từ gói nén vào thư viện';
```

---

### 2.4. Phân hệ AI BYOK & Quy trình AI (AI BYOK & Workflows Domain)

#### Bảng `ai_connections`
```sql
CREATE TABLE `ai_connections` (
  `id` CHAR(36) NOT NULL COMMENT 'UUID định danh kết nối',
  `user_id` CHAR(36) NOT NULL COMMENT 'Tài khoản sở hữu kết nối',
  `provider` VARCHAR(50) NOT NULL COMMENT 'Nhà cung cấp (gemini, openai, claude, groq, openrouter, custom)',
  `name` VARCHAR(100) NOT NULL COMMENT 'Tên gợi nhớ kết nối do người dùng đặt',
  `api_endpoint` VARCHAR(255) DEFAULT NULL COMMENT 'Custom API Endpoint nếu có',
  `encrypted_api_key` VARBINARY(512) NOT NULL COMMENT 'Khóa API đã mã hóa bằng AES-256-GCM',
  `encryption_iv` VARBINARY(16) NOT NULL COMMENT 'Initialization Vector ngẫu nhiên',
  `encryption_tag` VARBINARY(16) NOT NULL COMMENT 'Authentication Tag xác thực toàn vẹn',
  `api_key_masked` VARCHAR(64) NOT NULL COMMENT 'Chuỗi làm mờ API Key để hiển thị trên UI',
  `default_model` VARCHAR(100) NOT NULL COMMENT 'Tên model mặc định',
  `available_models_json` TEXT DEFAULT NULL COMMENT 'Danh sách model khả dụng dạng JSON',
  `is_connected` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Trạng thái kiểm tra kết nối',
  `last_tested_at` DATETIME DEFAULT NULL COMMENT 'Thời điểm kiểm tra kết nối gần nhất',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tạo',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Thời điểm cập nhật',
  PRIMARY KEY (`id`),
  KEY `idx_ai_conn_user_provider` (`user_id`, `provider`),
  CONSTRAINT `fk_aiconn_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Cấu hình kết nối AI BYOK';
```

#### Bảng `ai_tasks` & `ai_task_logs`
```sql
CREATE TABLE `ai_tasks` (
  `id` CHAR(36) NOT NULL COMMENT 'UUID định danh tác vụ',
  `user_id` CHAR(36) NOT NULL COMMENT 'Tài khoản sở hữu tác vụ',
  `source_document_id` CHAR(36) DEFAULT NULL COMMENT 'Tài liệu nguồn liên quan',
  `name` VARCHAR(150) NOT NULL COMMENT 'Tên quy trình / tác vụ',
  `description` TEXT DEFAULT NULL COMMENT 'Mô tả chi tiết tác vụ',
  `trigger_type` ENUM('manual', 'on_upload', 'on_extract') NOT NULL DEFAULT 'manual' COMMENT 'Cơ chế kích hoạt',
  `status` ENUM('queued', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'queued' COMMENT 'Trạng thái tác vụ',
  `progress` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Tiến độ xử lý (0-100%)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tạo',
  `completed_at` DATETIME DEFAULT NULL COMMENT 'Thời điểm hoàn thành',
  PRIMARY KEY (`id`),
  KEY `idx_ai_tasks_user_status` (`user_id`, `status`),
  KEY `idx_ai_tasks_doc` (`source_document_id`),
  CONSTRAINT `fk_aitasks_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_aitasks_document` FOREIGN KEY (`source_document_id`) REFERENCES `documents` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Quy trình xử lý AI tự động';

CREATE TABLE `ai_task_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Khóa chính tự tăng',
  `task_id` CHAR(36) NOT NULL COMMENT 'Tác vụ liên quan',
  `step_name` VARCHAR(100) NOT NULL COMMENT 'Tên bước thực hiện',
  `status` ENUM('running', 'success', 'failed') NOT NULL DEFAULT 'running' COMMENT 'Trạng thái bước',
  `duration_ms` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Thời gian thực thi (mili-giây)',
  `tokens_used` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Số token đã tiêu thụ',
  `input_summary` TEXT DEFAULT NULL COMMENT 'Đầu vào tóm lược',
  `output_summary` LONGTEXT DEFAULT NULL COMMENT 'Đầu ra kết quả',
  `error_message` TEXT DEFAULT NULL COMMENT 'Thông báo lỗi nếu có',
  `executed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm chạy bước',
  PRIMARY KEY (`id`),
  KEY `idx_task_logs_task` (`task_id`, `executed_at`),
  CONSTRAINT `fk_tasklogs_task` FOREIGN KEY (`task_id`) REFERENCES `ai_tasks` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Nhật ký thực thi từng bước của tác vụ AI';
```

---

### 2.5. Phân hệ AI Context JSON (AI Context Domain)

#### Bảng `ai_contexts`
```sql
CREATE TABLE `ai_contexts` (
  `id` CHAR(36) NOT NULL COMMENT 'UUID định danh AI Context',
  `user_id` CHAR(36) NOT NULL COMMENT 'Tài khoản sở hữu Context',
  `title` VARCHAR(200) NOT NULL COMMENT 'Tiêu đề ngữ cảnh tri thức',
  `schema_version` VARCHAR(20) NOT NULL DEFAULT '1.0.0' COMMENT 'Phiên bản schema cấu trúc JSON',
  `current_version` VARCHAR(20) NOT NULL DEFAULT '1.0.0' COMMENT 'Phiên bản nội dung tri thức',
  `summary` TEXT NOT NULL COMMENT 'Tóm tắt tổng quan tri thức',
  `knowledge_points_json` LONGTEXT NOT NULL COMMENT 'Mảng JSON chứa các luận điểm tri thức',
  `conclusions_json` LONGTEXT NOT NULL COMMENT 'Mảng JSON chứa các kết luận',
  `open_questions_json` LONGTEXT DEFAULT NULL COMMENT 'Mảng JSON chứa các câu hỏi mở',
  `learning_progress` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Điểm tiến độ thấu hiểu (0-100%)',
  `handoff_directive` TEXT DEFAULT NULL COMMENT 'Chỉ dẫn sư phạm cho phiên AI tiếp theo',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm khởi tạo',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Thời điểm cập nhật',
  PRIMARY KEY (`id`),
  KEY `idx_ai_context_user` (`user_id`, `updated_at` DESC),
  CONSTRAINT `fk_aicontext_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Kho ngữ cảnh tri thức AI Capsule';
```

#### Bảng `ai_context_versions`
```sql
CREATE TABLE `ai_context_versions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Khóa chính tự tăng',
  `context_id` CHAR(36) NOT NULL COMMENT 'AI Context được chụp snapshot',
  `version_tag` VARCHAR(20) NOT NULL COMMENT 'Số hiệu phiên bản (ví dụ 1.1.0)',
  `snapshot_json` LONGTEXT NOT NULL COMMENT 'Bản sao lưu toàn bộ trạng thái dữ liệu JSON',
  `change_note` VARCHAR(255) DEFAULT NULL COMMENT 'Ghi chú lý do cập nhật phiên bản',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tạo snapshot',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_context_version_tag` (`context_id`, `version_tag`),
  CONSTRAINT `fk_contextver_context` FOREIGN KEY (`context_id`) REFERENCES `ai_contexts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Lịch sử snapshot phiên bản của AI Context';
```

---

### 2.6. Phân hệ Flashcards & Quiz (Learning Domain)

#### Bảng `flashcard_decks` & `flashcards`
```sql
CREATE TABLE `flashcard_decks` (
  `id` CHAR(36) NOT NULL COMMENT 'UUID định danh bộ thẻ',
  `user_id` CHAR(36) NOT NULL COMMENT 'Tài khoản sở hữu bộ thẻ',
  `document_id` CHAR(36) DEFAULT NULL COMMENT 'Tài liệu nguồn liên quan',
  `name` VARCHAR(150) NOT NULL COMMENT 'Tên bộ thẻ',
  `description` TEXT DEFAULT NULL COMMENT 'Mô tả bộ thẻ',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tạo',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Thời điểm cập nhật',
  PRIMARY KEY (`id`),
  KEY `idx_decks_user` (`user_id`),
  KEY `idx_decks_doc` (`document_id`),
  CONSTRAINT `fk_decks_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_decks_document` FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bộ thẻ ghi nhớ Flashcard';

CREATE TABLE `flashcards` (
  `id` CHAR(36) NOT NULL COMMENT 'UUID định danh thẻ',
  `deck_id` CHAR(36) NOT NULL COMMENT 'Bộ thẻ chứa thẻ này',
  `front_text` TEXT NOT NULL COMMENT 'Nội dung câu hỏi mặt trước',
  `back_text` TEXT NOT NULL COMMENT 'Nội dung câu trả lời mặt sau',
  `is_known` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Trạng thái đã ghi nhớ',
  `review_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Số lần đã ôn tập thẻ',
  `last_reviewed_at` DATETIME DEFAULT NULL COMMENT 'Thời điểm ôn tập gần nhất',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tạo',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Thời điểm cập nhật',
  PRIMARY KEY (`id`),
  KEY `idx_cards_deck_known` (`deck_id`, `is_known`),
  CONSTRAINT `fk_cards_deck` FOREIGN KEY (`deck_id`) REFERENCES `flashcard_decks` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Thẻ ghi nhớ Flashcard';
```

#### Bảng `quizzes`, `quiz_questions`, `quiz_options`
```sql
CREATE TABLE `quizzes` (
  `id` CHAR(36) NOT NULL COMMENT 'UUID định danh bài trắc nghiệm',
  `user_id` CHAR(36) NOT NULL COMMENT 'Tài khoản sở hữu bài thi',
  `document_id` CHAR(36) DEFAULT NULL COMMENT 'Tài liệu nguồn liên quan',
  `title` VARCHAR(200) NOT NULL COMMENT 'Tiêu đề bài trắc nghiệm',
  `description` TEXT DEFAULT NULL COMMENT 'Mô tả bài trắc nghiệm',
  `time_limit_sec` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Thời gian làm bài tối đa (giây, 0 = không giới hạn)',
  `max_attempts` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Số lần làm lại tối đa (0 = không giới hạn)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tạo',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Thời điểm cập nhật',
  PRIMARY KEY (`id`),
  KEY `idx_quizzes_user` (`user_id`),
  KEY `idx_quizzes_doc` (`document_id`),
  CONSTRAINT `fk_quizzes_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_quizzes_document` FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bài kiểm tra trắc nghiệm';

CREATE TABLE `quiz_questions` (
  `id` CHAR(36) NOT NULL COMMENT 'UUID định danh câu hỏi',
  `quiz_id` CHAR(36) NOT NULL COMMENT 'Bài quiz chứa câu hỏi',
  `question_text` TEXT NOT NULL COMMENT 'Nội dung câu hỏi',
  `order_index` INT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Thứ tự hiển thị câu hỏi',
  `explanation` TEXT DEFAULT NULL COMMENT 'Giải thích đáp án chi tiết',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tạo',
  PRIMARY KEY (`id`),
  KEY `idx_questions_quiz_order` (`quiz_id`, `order_index`),
  CONSTRAINT `fk_questions_quiz` FOREIGN KEY (`quiz_id`) REFERENCES `quizzes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Câu hỏi trắc nghiệm';

CREATE TABLE `quiz_options` (
  `id` CHAR(36) NOT NULL COMMENT 'UUID định danh đáp án',
  `question_id` CHAR(36) NOT NULL COMMENT 'Câu hỏi chứa đáp án',
  `option_text` TEXT NOT NULL COMMENT 'Nội dung đáp án lựa chọn',
  `is_correct` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Cờ xác định đáp án đúng',
  `order_index` TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Thứ tự đáp án (A, B, C, D)',
  PRIMARY KEY (`id`),
  KEY `idx_options_question` (`question_id`),
  CONSTRAINT `fk_options_question` FOREIGN KEY (`question_id`) REFERENCES `quiz_questions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Các lựa chọn đáp án trắc nghiệm';
```

#### Bảng `quiz_attempts` & `quiz_attempt_answers`
```sql
CREATE TABLE `quiz_attempts` (
  `id` CHAR(36) NOT NULL COMMENT 'UUID định danh lượt làm bài',
  `quiz_id` CHAR(36) NOT NULL COMMENT 'Bài quiz được làm',
  `user_id` CHAR(36) NOT NULL COMMENT 'Tài khoản làm bài',
  `score` DECIMAL(5,2) NOT NULL COMMENT 'Điểm số đạt được (0.00 - 100.00)',
  `correct_answers` INT UNSIGNED NOT NULL COMMENT 'Số câu trả lời đúng',
  `total_questions` INT UNSIGNED NOT NULL COMMENT 'Tổng số câu hỏi của bài thi',
  `duration_sec` INT UNSIGNED NOT NULL COMMENT 'Thời gian hoàn thành (giây)',
  `started_at` DATETIME NOT NULL COMMENT 'Thời điểm bắt đầu làm bài',
  `completed_at` DATETIME NOT NULL COMMENT 'Thời điểm nộp bài',
  PRIMARY KEY (`id`),
  KEY `idx_attempts_user_quiz` (`user_id`, `quiz_id`, `completed_at` DESC),
  KEY `idx_attempts_quiz` (`quiz_id`),
  CONSTRAINT `fk_attempts_quiz` FOREIGN KEY (`quiz_id`) REFERENCES `quizzes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_attempts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Lượt làm bài trắc nghiệm';

CREATE TABLE `quiz_attempt_answers` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Khóa chính tự tăng',
  `attempt_id` CHAR(36) NOT NULL COMMENT 'Lượt làm bài liên quan',
  `question_id` CHAR(36) NOT NULL COMMENT 'Câu hỏi được trả lời',
  `selected_option_id` CHAR(36) NOT NULL COMMENT 'Đáp án người học đã chọn',
  `is_correct` TINYINT(1) NOT NULL COMMENT 'Kết quả câu trả lời đúng hay sai',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_attempt_question` (`attempt_id`, `question_id`),
  KEY `idx_ans_option` (`selected_option_id`),
  CONSTRAINT `fk_ans_attempt` FOREIGN KEY (`attempt_id`) REFERENCES `quiz_attempts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_ans_question` FOREIGN KEY (`question_id`) REFERENCES `quiz_questions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_ans_option` FOREIGN KEY (`selected_option_id`) REFERENCES `quiz_options` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Chi tiết câu trả lời từng lượt làm bài';
```

---

### 2.7. Phân hệ Chia sẻ Ngoại vi (Sharing Domain)

#### Bảng `shared_links`
```sql
CREATE TABLE `shared_links` (
  `id` CHAR(36) NOT NULL COMMENT 'UUID định danh liên kết chia sẻ',
  `user_id` CHAR(36) NOT NULL COMMENT 'Tài khoản phát hành liên kết',
  `document_id` CHAR(36) NOT NULL COMMENT 'Tài liệu được chia sẻ',
  `title` VARCHAR(255) NOT NULL COMMENT 'Tiêu đề hiển thị công khai',
  `token_hash` CHAR(64) NOT NULL COMMENT 'Mã băm SHA-256 của chuỗi bảo mật Share Token',
  `password_hash` VARCHAR(255) DEFAULT NULL COMMENT 'Mã băm mật khẩu bảo vệ liên kết nếu có',
  `allow_download` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Cờ cho phép tải file gốc',
  `expires_at` DATETIME DEFAULT NULL COMMENT 'Thời điểm hết hạn (NULL = vô thời hạn)',
  `views_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Số lượt truy cập đã ghi nhận',
  `is_revoked` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Cờ thu hồi liên kết tức thì',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tạo',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Thời điểm cập nhật',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_shared_links_token` (`token_hash`),
  KEY `idx_shared_links_user` (`user_id`),
  KEY `idx_shared_links_doc` (`document_id`),
  CONSTRAINT `fk_shared_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_shared_document` FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Liên kết chia sẻ tài liệu ra ngoài';
```

#### Bảng `share_access_logs`
```sql
CREATE TABLE `share_access_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Khóa chính tự tăng',
  `shared_link_id` CHAR(36) NOT NULL COMMENT 'Liên kết chia sẻ được truy cập',
  `action` ENUM('view', 'download') NOT NULL DEFAULT 'view' COMMENT 'Hành vi truy cập',
  `ip_address` VARCHAR(45) NOT NULL COMMENT 'Địa chỉ IPv4/IPv6 của người truy cập',
  `user_agent` VARCHAR(255) NOT NULL COMMENT 'Trình duyệt và thiết bị của người truy cập',
  `accessed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm truy cập',
  PRIMARY KEY (`id`),
  KEY `idx_share_logs_link_time` (`shared_link_id`, `accessed_at` DESC),
  CONSTRAINT `fk_sharelogs_link` FOREIGN KEY (`shared_link_id`) REFERENCES `shared_links` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Nhật ký lượt truy cập liên kết chia sẻ';
```

---

### 2.8. Phân hệ Vận hành & Thông báo (Operations Domain)

#### Bảng `activity_logs`
```sql
CREATE TABLE `activity_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Khóa chính tự tăng',
  `user_id` CHAR(36) NOT NULL COMMENT 'Tài khoản phát sinh hành động',
  `event_type` VARCHAR(50) NOT NULL COMMENT 'Mã loại sự kiện',
  `description` VARCHAR(255) NOT NULL COMMENT 'Mô tả tóm tắt hành động',
  `entity_type` VARCHAR(30) DEFAULT NULL COMMENT 'Loại thực thể bị tác động',
  `entity_id` VARCHAR(36) DEFAULT NULL COMMENT 'ID của thực thể bị tác động',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm ghi nhận',
  PRIMARY KEY (`id`),
  KEY `idx_act_logs_user_time` (`user_id`, `created_at` DESC),
  CONSTRAINT `fk_actlogs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Nhật ký hoạt động hệ thống (Audit Trail)';
```

#### Bảng `notifications`
```sql
CREATE TABLE `notifications` (
  `id` CHAR(36) NOT NULL COMMENT 'UUID định danh thông báo',
  `user_id` CHAR(36) NOT NULL COMMENT 'Tài khoản nhận thông báo',
  `title` VARCHAR(150) NOT NULL COMMENT 'Tiêu đề thông báo',
  `message` TEXT NOT NULL COMMENT 'Nội dung chi tiết thông báo',
  `type` ENUM('learning', 'ai', 'share', 'system') NOT NULL DEFAULT 'system' COMMENT 'Phân loại thông báo',
  `icon` VARCHAR(50) NOT NULL DEFAULT 'bell' COMMENT 'Tên icon Lucide',
  `is_read` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Cờ đánh dấu đã đọc',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm gửi thông báo',
  PRIMARY KEY (`id`),
  KEY `idx_notif_user_read` (`user_id`, `is_read`, `created_at` DESC),
  CONSTRAINT `fk_notif_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Thông báo hệ thống gửi đến người dùng';
```
