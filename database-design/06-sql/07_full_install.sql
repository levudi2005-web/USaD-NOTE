-- =============================================================================
-- DỰ ÁN: NOTE - WORKSPACE MANAGEMENT & AI-POWERED LEARNING
-- BỘ MÃ SQL TRIỂN KHAI TOÀN DIỆN CHO MARIADB 10.11+ LTS
-- TẬP TIN 07: BỘ CÀI ĐẶT TỔNG HỢP TOÀN BỘ CƠ SỞ DỮ LIỆU (FULL INSTALL SCRIPT)
-- DÙNG MỘT LẦN CHO DATABASE NOTE MỚI/TRỐNG TRÊN VPS (MARIADB 10.11+).
-- ĐÃ BAO GỒM SCHEMA HIỆN TẠI, TƯƠNG ỨNG CÁC THAY ĐỔI TRONG MIGRATION 08/09.
-- KHÔNG CHẠY TRÊN DATABASE ĐÃ CÓ DỮ LIỆU; KHÔNG CHẠY 06_rollback.sql KHI CÀI MỚI.
-- LỆNH: mariadb --default-character-set=utf8mb4 -u root -p < 07_full_install.sql
-- TẠO DATABASE/SCHEMA VÀ DỮ LIỆU DANH MỤC; KHÔNG TẠO DB USER HAY CREDENTIALS.
-- =============================================================================

-- =============================================================================
-- BƯỚC 1: TẠO DATABASE VÀ CẤU HÌNH BỘ MÃ
-- =============================================================================
CREATE DATABASE IF NOT EXISTS `note_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `note_db`;

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET foreign_key_checks = 0;

-- =============================================================================
-- BƯỚC 2: KHỞI TẠO 32 BẢNG QUAN HỆ CHUẨN HÓA 3NF
-- =============================================================================

-- Bảng 1: users
CREATE TABLE IF NOT EXISTS `users` (
  `id` CHAR(36) NOT NULL COMMENT 'UUID v4 định danh tài khoản',
  `email` VARCHAR(191) NOT NULL COMMENT 'Email đăng nhập duy nhất',
  `password_hash` VARCHAR(255) NOT NULL COMMENT 'Mã băm mật khẩu Argon2id hoặc Bcrypt',
  `full_name` VARCHAR(100) NOT NULL COMMENT 'Họ và tên hiển thị',
  `avatar_url` VARCHAR(255) DEFAULT NULL COMMENT 'Đường dẫn ảnh đại diện',
  `title` VARCHAR(100) DEFAULT NULL COMMENT 'Chức danh nghề nghiệp',
  `bio` TEXT DEFAULT NULL COMMENT 'Tiểu sử cá nhân',
  `theme_preference` ENUM('light', 'dark', 'auto') NOT NULL DEFAULT 'auto' COMMENT 'Chế độ giao diện (light, dark, auto)',
  `language` VARCHAR(10) NOT NULL DEFAULT 'vi' COMMENT 'Ngôn ngữ giao diện (vi, en)',
  `storage_used` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Dung lượng đã sử dụng (bytes)',
  `storage_limit` BIGINT UNSIGNED NOT NULL DEFAULT 1073741824 COMMENT 'Hạn mức lưu trữ tối đa (bytes, mặc định 1GB)',
  `failed_recovery_attempts` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Số lần nhập sai mã khôi phục liên tiếp',
  `recovery_locked_until` DATETIME DEFAULT NULL COMMENT 'Thời điểm khóa chức năng khôi phục nếu brute-force',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm đăng ký tài khoản (UTC)',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Thời điểm cập nhật hồ sơ (UTC)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tài khoản người dùng độc lập';

-- Bảng 2: user_recovery_codes
CREATE TABLE IF NOT EXISTS `user_recovery_codes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Khóa chính tự tăng',
  `user_id` CHAR(36) NOT NULL COMMENT 'Tài khoản sở hữu mã khôi phục',
  `code_hash` CHAR(64) NOT NULL COMMENT 'Mã băm SHA-256 của Recovery Code',
  `used_at` DATETIME DEFAULT NULL COMMENT 'Thời điểm sử dụng mã (NULL = còn hiệu lực)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm sinh mã',
  PRIMARY KEY (`id`),
  KEY `idx_recovery_user_unused` (`user_id`, `used_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Mã khôi phục mật khẩu dự phòng';

-- Bảng 3: user_sessions
CREATE TABLE IF NOT EXISTS `user_sessions` (
  `id` CHAR(36) NOT NULL COMMENT 'UUID v4 định danh phiên',
  `user_id` CHAR(36) NOT NULL COMMENT 'Tài khoản đăng nhập',
  `session_token_hash` CHAR(64) NOT NULL COMMENT 'Mã băm SHA-256 của Session Token',
  `device_info` VARCHAR(255) NOT NULL COMMENT 'Thông tin thiết bị và trình duyệt',
  `ip_address` VARCHAR(45) NOT NULL COMMENT 'Địa chỉ IPv4 hoặc IPv6',
  `is_revoked` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Cờ thu hồi phiên chủ động (1 = đã thu hồi)',
  `last_active_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tương tác gần nhất',
  `expires_at` DATETIME NOT NULL COMMENT 'Thời điểm hết hạn phiên',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm khởi tạo phiên',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sessions_token_hash` (`session_token_hash`),
  KEY `idx_sessions_user_expires` (`user_id`, `expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Phiên làm việc người dùng';

-- Bảng 4: folders
CREATE TABLE IF NOT EXISTS `folders` (
  `id` CHAR(36) NOT NULL COMMENT 'UUID v4 định danh thư mục',
  `user_id` CHAR(36) NOT NULL COMMENT 'Tài khoản sở hữu thư mục',
  `parent_id` CHAR(36) DEFAULT NULL COMMENT 'Thư mục cha (NULL nếu là thư mục gốc)',
  `name` VARCHAR(150) NOT NULL COMMENT 'Tên thư mục',
  `color` VARCHAR(30) DEFAULT NULL COMMENT 'Mã màu nhận diện giao diện',
  `icon` VARCHAR(50) NOT NULL DEFAULT 'folder' COMMENT 'Tên icon 2D Lucide',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tạo thư mục',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Thời điểm cập nhật thư mục',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_folders_user_id` (`user_id`, `id`),
  KEY `idx_folders_user_parent` (`user_id`, `parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Thư mục phân cấp quản lý tài liệu';

-- Bảng 5: documents
CREATE TABLE IF NOT EXISTS `documents` (
  `id` CHAR(36) NOT NULL COMMENT 'UUID v4 định danh tài liệu',
  `user_id` CHAR(36) NOT NULL COMMENT 'Tài khoản sở hữu tài liệu',
  `folder_id` CHAR(36) DEFAULT NULL COMMENT 'Thư mục chứa tài liệu (NULL nếu ở gốc)',
  `name` VARCHAR(255) NOT NULL COMMENT 'Tên hiển thị của tài liệu',
  `original_name` VARCHAR(255) NOT NULL COMMENT 'Tên file gốc khi người dùng tải lên',
  `file_type` VARCHAR(20) NOT NULL COMMENT 'Định dạng mở rộng (pdf, docx, xlsx, pptx, txt, md, epub...)',
  `mime_type` VARCHAR(100) NOT NULL COMMENT 'MIME type chuẩn (application/pdf...)',
  `file_size` BIGINT UNSIGNED NOT NULL COMMENT 'Kích thước tệp (bytes)',
  `storage_path` VARCHAR(500) NOT NULL COMMENT 'Đường dẫn tương đối lưu file vật lý trên Storage',
  `sha256_checksum` CHAR(64) NOT NULL COMMENT 'Mã băm SHA-256 đối soát toàn vẹn',
  `processing_status` ENUM('pending', 'processing', 'ready', 'failed') NOT NULL DEFAULT 'ready' COMMENT 'Trạng thái xử lý tài liệu',
  `extracted_text` LONGTEXT DEFAULT NULL COMMENT 'Toàn văn bản trích xuất phục vụ tìm kiếm toàn văn',
  `summary` LONGTEXT DEFAULT NULL COMMENT 'Tóm tắt do người dùng hoặc AI tạo',
  `is_starred` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Cờ đánh dấu tài liệu yêu thích',
  `is_archived` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Cờ lưu trữ tài liệu',
  `deleted_at` DATETIME DEFAULT NULL COMMENT 'Thời điểm xóa mềm (NULL = đang hoạt động)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tải lên',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Thời điểm sửa đổi metadata',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_documents_user_id` (`user_id`, `id`),
  KEY `idx_documents_user_deleted` (`user_id`, `deleted_at`, `created_at` DESC),
  KEY `idx_documents_folder` (`folder_id`),
  KEY `idx_documents_checksum` (`sha256_checksum`),
  FULLTEXT KEY `ft_documents_content` (`name`, `extracted_text`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Metadata tài liệu số trong thư viện';

-- Bảng 6: notes
CREATE TABLE IF NOT EXISTS `notes` (
  `id` CHAR(36) NOT NULL COMMENT 'UUID v4 định danh ghi chú',
  `user_id` CHAR(36) NOT NULL COMMENT 'Tài khoản sở hữu ghi chú',
  `folder_id` CHAR(36) DEFAULT NULL COMMENT 'Thư mục phân loại (nếu có)',
  `document_id` CHAR(36) DEFAULT NULL COMMENT 'Tài liệu liên kết (NULL nếu là ghi chú độc lập)',
  `title` VARCHAR(255) NOT NULL COMMENT 'Tiêu đề ghi chú',
  `category` VARCHAR(100) DEFAULT NULL COMMENT 'Danh mục chủ đề ghi chú',
  `content` LONGTEXT DEFAULT NULL COMMENT 'Nội dung ghi chú HTML/Markdown',
  `tags_json` LONGTEXT NOT NULL COMMENT 'Danh sách thẻ của ghi chú dạng JSON',
  `is_pinned` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Cờ đánh dấu ghim lên đầu',
  `is_favorite` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Cờ đánh dấu yêu thích',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tạo ghi chú',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Thời điểm chỉnh sửa gần nhất',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_notes_user_id` (`user_id`, `id`),
  KEY `idx_notes_user_doc` (`user_id`, `document_id`),
  KEY `idx_notes_folder` (`folder_id`),
  FULLTEXT KEY `ft_notes_text` (`title`, `content`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Ghi chú cá nhân và ghi chú tài liệu';

-- Bảng 7: tags
CREATE TABLE IF NOT EXISTS `tags` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Khóa chính tự tăng',
  `user_id` CHAR(36) NOT NULL COMMENT 'Tài khoản sở hữu nhãn',
  `name` VARCHAR(50) NOT NULL COMMENT 'Tên nhãn từ khóa',
  `color` VARCHAR(30) DEFAULT NULL COMMENT 'Mã màu nhận diện',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tạo',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tags_user_name` (`user_id`, `name`),
  UNIQUE KEY `uq_tags_user_id` (`user_id`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Nhãn phân loại từ khóa tự do';

-- Bảng 8: document_tags
CREATE TABLE IF NOT EXISTS `document_tags` (
  `document_id` CHAR(36) NOT NULL COMMENT 'Tài liệu được gắn thẻ',
  `tag_id` BIGINT UNSIGNED NOT NULL COMMENT 'Nhãn được gắn',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm gắn thẻ',
  PRIMARY KEY (`document_id`, `tag_id`),
  KEY `idx_doc_tags_tag` (`tag_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng kết hợp N-N Tài liệu và Nhãn';

-- Bảng 9: collections
CREATE TABLE IF NOT EXISTS `collections` (
  `id` CHAR(36) NOT NULL COMMENT 'UUID v4 định danh bộ sưu tập',
  `user_id` CHAR(36) NOT NULL COMMENT 'Tài khoản sở hữu bộ sưu tập',
  `name` VARCHAR(150) NOT NULL COMMENT 'Tên bộ sưu tập',
  `description` TEXT DEFAULT NULL COMMENT 'Mô tả mục tiêu bộ sưu tập',
  `color` VARCHAR(30) DEFAULT NULL COMMENT 'Mã màu nhận diện',
  `tags_json` LONGTEXT NOT NULL COMMENT 'Danh sách thẻ của bộ sưu tập dạng JSON',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tạo',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Thời điểm sửa đổi',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_collections_user_id` (`user_id`, `id`),
  KEY `idx_collections_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bộ sưu tập chuyên đề';

-- Bảng 10: flashcard_decks
CREATE TABLE IF NOT EXISTS `flashcard_decks` (
  `id` CHAR(36) NOT NULL COMMENT 'UUID v4 định danh bộ thẻ',
  `user_id` CHAR(36) NOT NULL COMMENT 'Tài khoản sở hữu bộ thẻ',
  `document_id` CHAR(36) DEFAULT NULL COMMENT 'Tài liệu nguồn liên quan (nếu có)',
  `name` VARCHAR(150) NOT NULL COMMENT 'Tên bộ thẻ',
  `description` TEXT DEFAULT NULL COMMENT 'Mô tả bộ thẻ',
  `color` VARCHAR(20) NOT NULL DEFAULT '#10b981' COMMENT 'Màu nhận diện bộ thẻ',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tạo',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Thời điểm cập nhật',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_decks_user_id` (`user_id`, `id`),
  KEY `idx_decks_user` (`user_id`),
  KEY `idx_decks_doc` (`document_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bộ thẻ ghi nhớ Flashcard';

-- Bảng 11: flashcards
CREATE TABLE IF NOT EXISTS `flashcards` (
  `id` CHAR(36) NOT NULL COMMENT 'UUID v4 định danh thẻ',
  `deck_id` CHAR(36) NOT NULL COMMENT 'Bộ thẻ chứa thẻ này',
  `front_text` TEXT NOT NULL COMMENT 'Nội dung câu hỏi mặt trước',
  `back_text` TEXT NOT NULL COMMENT 'Nội dung câu trả lời mặt sau',
  `is_known` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Trạng thái người học đã ghi nhớ (1 = đã nhớ)',
  `review_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Số lần đã ôn tập thẻ này',
  `last_reviewed_at` DATETIME DEFAULT NULL COMMENT 'Thời điểm ôn tập gần nhất',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tạo thẻ',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Thời điểm cập nhật thẻ',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_flashcards_deck_id` (`deck_id`, `id`),
  KEY `idx_cards_deck_known` (`deck_id`, `is_known`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Thẻ ghi nhớ Flashcard chi tiết';

-- Bảng 12: collection_items
CREATE TABLE IF NOT EXISTS `collection_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Khóa chính tự tăng',
  `collection_id` CHAR(36) NOT NULL COMMENT 'Bộ sưu tập chứa phần tử',
  `document_id` CHAR(36) DEFAULT NULL COMMENT 'Tài liệu (nếu phần tử là tài liệu)',
  `note_id` CHAR(36) DEFAULT NULL COMMENT 'Ghi chú (nếu phần tử là ghi chú)',
  `deck_id` CHAR(36) DEFAULT NULL COMMENT 'Bộ thẻ (nếu phần tử là bộ thẻ flashcard)',
  `added_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm thêm vào',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_coll_items_doc` (`collection_id`, `document_id`),
  UNIQUE KEY `uq_coll_items_note` (`collection_id`, `note_id`),
  UNIQUE KEY `uq_coll_items_deck` (`collection_id`, `deck_id`),
  KEY `idx_coll_items_document` (`document_id`),
  KEY `idx_coll_items_note` (`note_id`),
  KEY `idx_coll_items_deck` (`deck_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Phần tử trong bộ sưu tập (Khóa ngoại tường minh)';

-- Bảng 13: archives
CREATE TABLE IF NOT EXISTS `archives` (
  `id` CHAR(36) NOT NULL COMMENT 'UUID v4 định danh gói nén',
  `user_id` CHAR(36) NOT NULL COMMENT 'Tài khoản sở hữu gói nén',
  `name` VARCHAR(255) NOT NULL COMMENT 'Tên hiển thị gói nén',
  `original_name` VARCHAR(255) NOT NULL COMMENT 'Tên file gốc khi upload',
  `format` ENUM('zip', '7z') NOT NULL COMMENT 'Định dạng gói nén (zip, 7z)',
  `file_size` BIGINT UNSIGNED NOT NULL COMMENT 'Kích thước tệp nén (bytes)',
  `uncompressed_size` BIGINT UNSIGNED NOT NULL COMMENT 'Tổng dung lượng thực tế sau giải nén (bytes, chống Zip Bomb)',
  `max_ratio` DECIMAL(6,2) NOT NULL DEFAULT 1.00 COMMENT 'Tỉ lệ bung nén (uncompressed_size / file_size)',
  `file_count` INT UNSIGNED NOT NULL COMMENT 'Tổng số file bên trong gói nén',
  `storage_path` VARCHAR(500) NOT NULL COMMENT 'Đường dẫn lưu trữ gói nén gốc trên đĩa',
  `sha256_checksum` CHAR(64) NOT NULL COMMENT 'Mã băm SHA-256 đối soát toàn vẹn gói nén',
  `scan_status` ENUM('clean', 'warning', 'quarantined', 'rejected') NOT NULL DEFAULT 'clean' COMMENT 'Trạng thái quét an toàn',
  `manifest_json` LONGTEXT NOT NULL COMMENT 'Cây thư mục và danh sách metadata các file bên trong dạng JSON',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tải lên',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Thời điểm cập nhật',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_archives_user_id` (`user_id`, `id`),
  KEY `idx_archives_user` (`user_id`, `created_at` DESC),
  CONSTRAINT `chk_archives_ratio` CHECK (`max_ratio` >= 0.00)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Gói nén ZIP và 7Z gốc';

-- Bảng 14: archive_extracted_files
CREATE TABLE IF NOT EXISTS `archive_extracted_files` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Khóa chính tự tăng',
  `archive_id` CHAR(36) NOT NULL COMMENT 'Gói nén nguồn',
  `document_id` CHAR(36) NOT NULL COMMENT 'Tài liệu đích đã tạo trong thư viện',
  `inner_path` VARCHAR(500) NOT NULL COMMENT 'Đường dẫn tương đối bên trong gói nén ban đầu',
  `extracted_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm giải nén',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_arch_extract_path` (`archive_id`, `inner_path`),
  KEY `idx_arch_extract_doc` (`document_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Liên kết file giải nén từ gói nén vào thư viện';

-- Bảng 15: ai_providers
CREATE TABLE IF NOT EXISTS `ai_providers` (
  `id` VARCHAR(50) NOT NULL COMMENT 'Mã nhà cung cấp (gemini, openai, claude, groq, openrouter, custom)',
  `name` VARCHAR(100) NOT NULL COMMENT 'Tên hiển thị (Google Gemini, OpenAI, Groq Cloud...)',
  `api_base_url` VARCHAR(255) NOT NULL COMMENT 'URL endpoint API gốc',
  `auth_header_format` VARCHAR(100) NOT NULL COMMENT 'Định dạng header xác thực (Bearer {KEY}, x-goog-api-key)',
  `icon` VARCHAR(50) NOT NULL DEFAULT 'sparkles' COMMENT 'Icon hiển thị UI',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Trạng thái kích hoạt',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Danh mục nhà cung cấp AI hệ thống hỗ trợ';

-- Bảng 16: ai_models
CREATE TABLE IF NOT EXISTS `ai_models` (
  `id` VARCHAR(100) NOT NULL COMMENT 'Mã model định danh (gemini-1.5-flash, gpt-4o...)',
  `provider_id` VARCHAR(50) NOT NULL COMMENT 'Nhà cung cấp sở hữu model',
  `display_name` VARCHAR(150) NOT NULL COMMENT 'Tên hiển thị trên giao diện',
  `context_window` INT UNSIGNED NOT NULL COMMENT 'Độ dài ngữ cảnh tối đa (tokens)',
  `max_output_tokens` INT UNSIGNED NOT NULL COMMENT 'Số token đầu ra tối đa',
  `supports_vision` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Hỗ trợ xử lý hình ảnh và tài liệu PDF trực tiếp',
  `is_default` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Cờ đánh dấu model khuyên dùng mặc định của provider',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ai_models_provider` (`provider_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Danh mục model AI và thông số kỹ thuật';

-- Bảng 17: ai_connections
CREATE TABLE IF NOT EXISTS `ai_connections` (
  `id` CHAR(36) NOT NULL COMMENT 'UUID v4 định danh kết nối',
  `user_id` CHAR(36) NOT NULL COMMENT 'Tài khoản sở hữu kết nối',
  `provider_id` VARCHAR(50) NOT NULL COMMENT 'Nhà cung cấp AI tham chiếu',
  `name` VARCHAR(100) NOT NULL COMMENT 'Tên kết nối do người dùng đặt',
  `api_endpoint` VARCHAR(255) DEFAULT NULL COMMENT 'Custom API Endpoint nếu người dùng dùng Local/Proxy',
  `encrypted_api_key` VARBINARY(512) NOT NULL COMMENT 'Khóa API đã mã hóa bằng AES-256-GCM',
  `encryption_iv` VARBINARY(16) NOT NULL COMMENT 'Initialization Vector ngẫu nhiên cho mã hóa',
  `encryption_tag` VARBINARY(16) NOT NULL COMMENT 'Authentication Tag xác thực tính toàn vẹn',
  `key_version` INT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Phiên bản Master Key dùng để mã hóa (hỗ trợ xoay vòng khóa)',
  `api_key_masked` VARCHAR(64) NOT NULL COMMENT 'Chuỗi làm mờ API Key chỉ để hiển thị UI',
  `default_model_id` VARCHAR(100) NOT NULL COMMENT 'Model mặc định được chọn',
  `is_connected` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Trạng thái kiểm tra kết nối (1 = thành công)',
  `last_tested_at` DATETIME DEFAULT NULL COMMENT 'Thời điểm kiểm tra kết nối gần nhất',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tạo kết nối',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Thời điểm sửa kết nối',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_connections_user_id` (`user_id`, `id`),
  KEY `idx_ai_conn_user_provider` (`user_id`, `provider_id`),
  KEY `idx_ai_conn_model` (`default_model_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Cấu hình kết nối AI BYOK của người dùng';

-- Bảng 18: ai_conversations
CREATE TABLE IF NOT EXISTS `ai_conversations` (
  `id` CHAR(36) NOT NULL COMMENT 'UUID v4 định danh cuộc trò chuyện',
  `user_id` CHAR(36) NOT NULL COMMENT 'Tài khoản sở hữu cuộc trò chuyện',
  `connection_id` CHAR(36) DEFAULT NULL COMMENT 'Kết nối AI BYOK được sử dụng',
  `model_name` VARCHAR(100) NOT NULL COMMENT 'Tên model đã sử dụng',
  `title` VARCHAR(200) NOT NULL COMMENT 'Tiêu đề cuộc trò chuyện',
  `pinned_document_id` CHAR(36) DEFAULT NULL COMMENT 'Tài liệu nguồn được ghim làm ngữ cảnh hỏi đáp',
  `total_tokens_used` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Tổng số token tiêu thụ trong cuộc trò chuyện',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_conversations_user_id` (`user_id`, `id`),
  KEY `idx_ai_conv_user_time` (`user_id`, `updated_at` DESC),
  KEY `idx_ai_conv_doc` (`pinned_document_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Các phiên trò chuyện với Trợ lý AI';

-- Bảng 19: ai_messages
CREATE TABLE IF NOT EXISTS `ai_messages` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Khóa chính tự tăng',
  `conversation_id` CHAR(36) NOT NULL COMMENT 'Cuộc trò chuyện chứa tin nhắn',
  `role` ENUM('user', 'assistant', 'system') NOT NULL COMMENT 'Vai trò người gửi (user, assistant, system)',
  `content` LONGTEXT NOT NULL COMMENT 'Nội dung tin nhắn (hỗ trợ Markdown, code blocks)',
  `prompt_tokens` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Số token đầu vào',
  `completion_tokens` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Số token sinh ra',
  `references_json` JSON DEFAULT NULL COMMENT 'Nguồn tài liệu trích dẫn tham chiếu',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ai_msg_conv_time` (`conversation_id`, `created_at` ASC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Chi tiết tin nhắn trong cuộc trò chuyện AI';

-- Bảng 20: ai_tasks
CREATE TABLE IF NOT EXISTS `ai_tasks` (
  `id` CHAR(36) NOT NULL COMMENT 'UUID v4 định danh tác vụ',
  `user_id` CHAR(36) NOT NULL COMMENT 'Tài khoản sở hữu tác vụ',
  `source_document_id` CHAR(36) DEFAULT NULL COMMENT 'Tài liệu nguồn liên quan',
  `connection_id` CHAR(36) DEFAULT NULL COMMENT 'Kết nối AI BYOK dùng để thực thi',
  `name` VARCHAR(150) NOT NULL COMMENT 'Tên quy trình / tác vụ',
  `description` TEXT DEFAULT NULL COMMENT 'Mô tả chi tiết tác vụ',
  `trigger_type` ENUM('manual', 'on_upload', 'on_extract') NOT NULL DEFAULT 'manual' COMMENT 'Cơ chế kích hoạt',
  `status` ENUM('queued', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'queued' COMMENT 'Trạng thái tác vụ',
  `progress` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Tiến độ xử lý (0-100%)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tạo tác vụ',
  `completed_at` DATETIME DEFAULT NULL COMMENT 'Thời điểm hoàn thành tác vụ',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tasks_user_id` (`user_id`, `id`),
  KEY `idx_ai_tasks_user_status` (`user_id`, `status`),
  KEY `idx_ai_tasks_doc` (`source_document_id`),
  CONSTRAINT `chk_ai_tasks_progress` CHECK (`progress` <= 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Quy trình xử lý AI tự động';

-- Bảng 21: ai_task_logs
CREATE TABLE IF NOT EXISTS `ai_task_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Khóa chính tự tăng',
  `task_id` CHAR(36) NOT NULL COMMENT 'Tác vụ liên quan',
  `step_name` VARCHAR(100) NOT NULL COMMENT 'Tên bước thực hiện',
  `status` ENUM('running', 'success', 'failed') NOT NULL DEFAULT 'running' COMMENT 'Trạng thái bước',
  `duration_ms` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Thời gian thực thi (mili-giây)',
  `tokens_used` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Số token đã tiêu thụ',
  `input_summary` TEXT DEFAULT NULL COMMENT 'Đầu vào tóm lược',
  `output_summary` LONGTEXT DEFAULT NULL COMMENT 'Đầu ra kết quả',
  `error_message` TEXT DEFAULT NULL COMMENT 'Thông báo lỗi chi tiết nếu có',
  `executed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm chạy bước',
  PRIMARY KEY (`id`),
  KEY `idx_task_logs_task` (`task_id`, `executed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Nhật ký thực thi từng bước tác vụ AI';

-- Bảng 22: ai_contexts
CREATE TABLE IF NOT EXISTS `ai_contexts` (
  `id` CHAR(36) NOT NULL COMMENT 'UUID v4 định danh AI Context',
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
  UNIQUE KEY `uq_contexts_user_id` (`user_id`, `id`),
  KEY `idx_ai_context_user` (`user_id`, `updated_at` DESC),
  CONSTRAINT `chk_ai_contexts_progress` CHECK (`learning_progress` <= 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Kho ngữ cảnh tri thức AI Capsule';

-- Bảng 23: ai_context_versions
CREATE TABLE IF NOT EXISTS `ai_context_versions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Khóa chính tự tăng',
  `context_id` CHAR(36) NOT NULL COMMENT 'AI Context được chụp snapshot',
  `version_tag` VARCHAR(20) NOT NULL COMMENT 'Số hiệu phiên bản snapshot (ví dụ 1.1.0)',
  `snapshot_json` LONGTEXT NOT NULL COMMENT 'Bản sao lưu toàn bộ dữ liệu JSON',
  `change_note` VARCHAR(255) DEFAULT NULL COMMENT 'Ghi chú lý do cập nhật phiên bản',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tạo snapshot',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_context_version_tag` (`context_id`, `version_tag`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Lịch sử snapshot phiên bản AI Context';

-- Bảng 24: quizzes
CREATE TABLE IF NOT EXISTS `quizzes` (
  `id` CHAR(36) NOT NULL COMMENT 'UUID v4 định danh bài quiz',
  `user_id` CHAR(36) NOT NULL COMMENT 'Tài khoản sở hữu bài thi',
  `document_id` CHAR(36) DEFAULT NULL COMMENT 'Tài liệu nguồn liên quan',
  `title` VARCHAR(200) NOT NULL COMMENT 'Tiêu đề bài trắc nghiệm',
  `description` TEXT DEFAULT NULL COMMENT 'Mô tả bài trắc nghiệm',
  `time_limit_sec` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Thời gian làm bài tối đa (giây, 0 = không giới hạn)',
  `passing_score` TINYINT UNSIGNED NOT NULL DEFAULT 80 COMMENT 'Điểm phần trăm tối thiểu để đạt',
  `max_attempts` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Số lần làm lại tối đa (0 = không giới hạn)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tạo',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Thời điểm cập nhật',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_quizzes_user_id` (`user_id`, `id`),
  KEY `idx_quizzes_user` (`user_id`),
  KEY `idx_quizzes_doc` (`document_id`),
  CONSTRAINT `chk_quizzes_passing_score` CHECK (`passing_score` <= 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bài kiểm tra trắc nghiệm';

-- Bảng 25: quiz_questions
CREATE TABLE IF NOT EXISTS `quiz_questions` (
  `id` CHAR(36) NOT NULL COMMENT 'UUID v4 định danh câu hỏi',
  `quiz_id` CHAR(36) NOT NULL COMMENT 'Bài quiz chứa câu hỏi',
  `question_text` TEXT NOT NULL COMMENT 'Nội dung câu hỏi',
  `question_type` VARCHAR(30) NOT NULL DEFAULT 'single_choice' COMMENT 'Loại câu hỏi',
  `order_index` INT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Thứ tự hiển thị câu hỏi',
  `explanation` TEXT DEFAULT NULL COMMENT 'Giải thích đáp án chi tiết',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tạo',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_questions_quiz_id` (`quiz_id`, `id`),
  KEY `idx_questions_quiz_order` (`quiz_id`, `order_index`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Câu hỏi trắc nghiệm';

-- Bảng 26: quiz_options
CREATE TABLE IF NOT EXISTS `quiz_options` (
  `id` CHAR(36) NOT NULL COMMENT 'UUID v4 định danh đáp án',
  `question_id` CHAR(36) NOT NULL COMMENT 'Câu hỏi chứa đáp án',
  `option_text` TEXT NOT NULL COMMENT 'Nội dung đáp án',
  `is_correct` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Cờ xác định đáp án đúng (1 = đúng)',
  `order_index` TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Thứ tự đáp án (1=A, 2=B, 3=C, 4=D)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_options_question_id` (`question_id`, `id`),
  KEY `idx_options_question` (`question_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Các lựa chọn đáp án trắc nghiệm';

-- Bảng 27: quiz_attempts
CREATE TABLE IF NOT EXISTS `quiz_attempts` (
  `id` CHAR(36) NOT NULL COMMENT 'UUID v4 định danh lượt làm bài',
  `quiz_id` CHAR(36) NOT NULL COMMENT 'Bài quiz được làm',
  `user_id` CHAR(36) NOT NULL COMMENT 'Tài khoản làm bài',
  `score` DECIMAL(5,2) NOT NULL COMMENT 'Điểm số đạt được (0.00-100.00)',
  `correct_answers` INT UNSIGNED NOT NULL COMMENT 'Số câu trả lời đúng',
  `total_questions` INT UNSIGNED NOT NULL COMMENT 'Tổng số câu hỏi',
  `duration_sec` INT UNSIGNED NOT NULL COMMENT 'Thời gian hoàn thành (giây)',
  `started_at` DATETIME NOT NULL COMMENT 'Thời điểm bắt đầu làm bài',
  `completed_at` DATETIME NOT NULL COMMENT 'Thời điểm nộp bài',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_attempts_user_id` (`user_id`, `id`),
  KEY `idx_attempts_user_quiz` (`user_id`, `quiz_id`, `completed_at` DESC),
  KEY `idx_attempts_quiz` (`quiz_id`),
  CONSTRAINT `chk_quiz_attempts_score` CHECK (`score` >= 0.00 AND `score` <= 100.00)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Lượt làm bài trắc nghiệm';

-- Bảng 28: quiz_attempt_answers
CREATE TABLE IF NOT EXISTS `quiz_attempt_answers` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Khóa chính tự tăng',
  `attempt_id` CHAR(36) NOT NULL COMMENT 'Lượt làm bài liên quan',
  `question_id` CHAR(36) NOT NULL COMMENT 'Câu hỏi được trả lời',
  `selected_option_id` CHAR(36) NOT NULL COMMENT 'Đáp án người học đã chọn',
  `is_correct` TINYINT(1) NOT NULL COMMENT 'Kết quả câu trả lời đúng hay sai',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_attempt_question` (`attempt_id`, `question_id`),
  KEY `idx_ans_option` (`selected_option_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Chi tiết câu trả lời từng lượt làm bài';

-- Bảng 29: shared_links
CREATE TABLE IF NOT EXISTS `shared_links` (
  `id` CHAR(36) NOT NULL COMMENT 'UUID v4 định danh liên kết chia sẻ',
  `user_id` CHAR(36) NOT NULL COMMENT 'Tài khoản phát hành liên kết',
  `document_id` CHAR(36) NOT NULL COMMENT 'Tài liệu được chia sẻ',
  `title` VARCHAR(255) NOT NULL COMMENT 'Tiêu đề hiển thị công khai',
  `token_hash` CHAR(64) NOT NULL COMMENT 'Mã băm SHA-256 của chuỗi bảo mật Share Token',
  `password_hash` VARCHAR(255) DEFAULT NULL COMMENT 'Mã băm mật khẩu bảo vệ liên kết nếu có',
  `allow_download` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Cờ cho phép tải file gốc (1 = cho phép)',
  `expires_at` DATETIME DEFAULT NULL COMMENT 'Thời điểm hết hạn (NULL = vô thời hạn)',
  `views_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Số lượt truy cập đã ghi nhận',
  `failed_pass_attempts` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Số lần nhập sai mật khẩu liên kết',
  `pass_locked_until` DATETIME DEFAULT NULL COMMENT 'Thời điểm khóa nhập mật khẩu nếu brute-force',
  `is_revoked` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Cờ thu hồi liên kết tức thì (1 = đã thu hồi)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tạo liên kết',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Thời điểm cập nhật',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_shared_links_token` (`token_hash`),
  KEY `idx_shared_links_user` (`user_id`),
  KEY `idx_shared_links_doc` (`document_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Liên kết chia sẻ tài liệu ra ngoài';

-- Bảng 30: share_access_logs
CREATE TABLE IF NOT EXISTS `share_access_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Khóa chính tự tăng',
  `shared_link_id` CHAR(36) NOT NULL COMMENT 'Liên kết chia sẻ được truy cập',
  `action` ENUM('view', 'download') NOT NULL DEFAULT 'view' COMMENT 'Hành vi truy cập (view, download)',
  `ip_address` VARCHAR(45) NOT NULL COMMENT 'Địa chỉ IPv4/IPv6 của người truy cập',
  `user_agent` VARCHAR(255) NOT NULL COMMENT 'Trình duyệt và thiết bị của người truy cập',
  `accessed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm truy cập',
  PRIMARY KEY (`id`),
  KEY `idx_share_logs_link_time` (`shared_link_id`, `accessed_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Nhật ký lượt truy cập liên kết chia sẻ';

-- Bảng 31: activity_logs
CREATE TABLE IF NOT EXISTS `activity_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Khóa chính tự tăng',
  `user_id` CHAR(36) NOT NULL COMMENT 'Tài khoản phát sinh hành động',
  `event_type` VARCHAR(50) NOT NULL COMMENT 'Mã loại sự kiện (document_upload, archive_extract...)',
  `description` VARCHAR(255) NOT NULL COMMENT 'Mô tả tóm tắt hành động',
  `entity_type` VARCHAR(30) DEFAULT NULL COMMENT 'Loại thực thể bị tác động',
  `entity_id` VARCHAR(36) DEFAULT NULL COMMENT 'ID của thực thể bị tác động',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm ghi nhận sự kiện',
  PRIMARY KEY (`id`),
  KEY `idx_act_logs_user_time` (`user_id`, `created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Nhật ký hoạt động hệ thống (Audit Trail)';

-- Bảng 32: notifications
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` CHAR(36) NOT NULL COMMENT 'UUID v4 định danh thông báo',
  `user_id` CHAR(36) NOT NULL COMMENT 'Tài khoản nhận thông báo',
  `title` VARCHAR(150) NOT NULL COMMENT 'Tiêu đề thông báo',
  `message` TEXT NOT NULL COMMENT 'Nội dung chi tiết thông báo',
  `type` ENUM('learning', 'ai', 'share', 'system') NOT NULL DEFAULT 'system' COMMENT 'Phân loại thông báo',
  `icon` VARCHAR(50) NOT NULL DEFAULT 'bell' COMMENT 'Tên icon Lucide',
  `is_read` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Cờ đánh dấu đã đọc (1 = đã đọc)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm gửi thông báo',
  PRIMARY KEY (`id`),
  KEY `idx_notif_user_read` (`user_id`, `is_read`, `created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Thông báo hệ thống gửi đến người dùng';

-- =============================================================================
-- BƯỚC 3: THIẾT LẬP RÀNG BUỘC KHÓA NGOẠI (FOREIGN KEYS) VÀ COMPOSITE FK
-- =============================================================================

ALTER TABLE `user_recovery_codes`
  ADD CONSTRAINT `fk_recovery_user`
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `user_sessions`
  ADD CONSTRAINT `fk_sessions_user`
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `folders`
  ADD CONSTRAINT `fk_folders_user`
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_folders_parent_composite`
  FOREIGN KEY (`user_id`, `parent_id`) REFERENCES `folders` (`user_id`, `id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `documents`
  ADD CONSTRAINT `fk_documents_user`
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_documents_folder_composite`
  FOREIGN KEY (`folder_id`) REFERENCES `folders` (`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `notes`
  ADD CONSTRAINT `fk_notes_user`
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_notes_folder_composite`
  FOREIGN KEY (`folder_id`) REFERENCES `folders` (`id`)
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_notes_document_composite`
  FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `tags`
  ADD CONSTRAINT `fk_tags_user`
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `document_tags`
  ADD CONSTRAINT `fk_doctags_document`
  FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_doctags_tag`
  FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `collections`
  ADD CONSTRAINT `fk_collections_user`
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `collection_items`
  ADD CONSTRAINT `fk_coll_items_collection`
  FOREIGN KEY (`collection_id`) REFERENCES `collections` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_coll_items_document`
  FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_coll_items_note`
  FOREIGN KEY (`note_id`) REFERENCES `notes` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_coll_items_deck`
  FOREIGN KEY (`deck_id`) REFERENCES `flashcard_decks` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `archives`
  ADD CONSTRAINT `fk_archives_user`
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `archive_extracted_files`
  ADD CONSTRAINT `fk_archext_archive`
  FOREIGN KEY (`archive_id`) REFERENCES `archives` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_archext_document`
  FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ai_models`
  ADD CONSTRAINT `fk_models_provider`
  FOREIGN KEY (`provider_id`) REFERENCES `ai_providers` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ai_connections`
  ADD CONSTRAINT `fk_aiconn_user`
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_aiconn_provider`
  FOREIGN KEY (`provider_id`) REFERENCES `ai_providers` (`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_aiconn_model`
  FOREIGN KEY (`default_model_id`) REFERENCES `ai_models` (`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ai_conversations`
  ADD CONSTRAINT `fk_aiconv_user`
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_aiconv_connection_composite`
  FOREIGN KEY (`connection_id`) REFERENCES `ai_connections` (`id`)
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_aiconv_document_composite`
  FOREIGN KEY (`pinned_document_id`) REFERENCES `documents` (`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ai_messages`
  ADD CONSTRAINT `fk_aimsg_conversation`
  FOREIGN KEY (`conversation_id`) REFERENCES `ai_conversations` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ai_tasks`
  ADD CONSTRAINT `fk_aitasks_user`
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_aitasks_document_composite`
  FOREIGN KEY (`source_document_id`) REFERENCES `documents` (`id`)
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_aitasks_connection_composite`
  FOREIGN KEY (`connection_id`) REFERENCES `ai_connections` (`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ai_task_logs`
  ADD CONSTRAINT `fk_tasklogs_task`
  FOREIGN KEY (`task_id`) REFERENCES `ai_tasks` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ai_contexts`
  ADD CONSTRAINT `fk_aicontext_user`
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ai_context_versions`
  ADD CONSTRAINT `fk_contextver_context`
  FOREIGN KEY (`context_id`) REFERENCES `ai_contexts` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `flashcard_decks`
  ADD CONSTRAINT `fk_decks_user`
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_decks_document_composite`
  FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `flashcards`
  ADD CONSTRAINT `fk_cards_deck`
  FOREIGN KEY (`deck_id`) REFERENCES `flashcard_decks` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `quizzes`
  ADD CONSTRAINT `fk_quizzes_user`
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_quizzes_document_composite`
  FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `quiz_questions`
  ADD CONSTRAINT `fk_questions_quiz`
  FOREIGN KEY (`quiz_id`) REFERENCES `quizzes` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `quiz_options`
  ADD CONSTRAINT `fk_options_question`
  FOREIGN KEY (`question_id`) REFERENCES `quiz_questions` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `quiz_attempts`
  ADD CONSTRAINT `fk_attempts_quiz`
  FOREIGN KEY (`quiz_id`) REFERENCES `quizzes` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_attempts_user`
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `quiz_attempt_answers`
  ADD CONSTRAINT `fk_ans_attempt`
  FOREIGN KEY (`attempt_id`) REFERENCES `quiz_attempts` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_ans_question`
  FOREIGN KEY (`question_id`) REFERENCES `quiz_questions` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_ans_question_option_composite`
  FOREIGN KEY (`question_id`, `selected_option_id`) REFERENCES `quiz_options` (`question_id`, `id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `shared_links`
  ADD CONSTRAINT `fk_shared_user`
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_shared_document_composite`
  FOREIGN KEY (`user_id`, `document_id`) REFERENCES `documents` (`user_id`, `id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `share_access_logs`
  ADD CONSTRAINT `fk_sharelogs_link`
  FOREIGN KEY (`shared_link_id`) REFERENCES `shared_links` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `activity_logs`
  ADD CONSTRAINT `fk_actlogs_user`
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `notifications`
  ADD CONSTRAINT `fk_notif_user`
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- BƯỚC 4: TẠO TRIGGERS BẢO MẬT & TÍNH TOÀN VẸN
-- =============================================================================

DELIMITER $$

CREATE OR REPLACE TRIGGER `trg_archives_calc_ratio_before_insert`
BEFORE INSERT ON `archives`
FOR EACH ROW
BEGIN
  IF NEW.file_size > 0 THEN
    SET NEW.max_ratio = ROUND(NEW.uncompressed_size / NEW.file_size, 2);
  END IF;
  
  IF NEW.max_ratio > 50.00 THEN
    SET NEW.scan_status = 'rejected';
  END IF;
END$$

CREATE OR REPLACE TRIGGER `trg_documents_soft_delete_revoke_shares`
AFTER UPDATE ON `documents`
FOR EACH ROW
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    UPDATE `shared_links`
    SET `is_revoked` = 1, `updated_at` = CURRENT_TIMESTAMP
    WHERE `document_id` = NEW.id AND `is_revoked` = 0;
  END IF;
END$$

CREATE OR REPLACE TRIGGER `trg_documents_increase_storage`
AFTER INSERT ON `documents`
FOR EACH ROW
BEGIN
  UPDATE `users`
  SET `storage_used` = `storage_used` + NEW.file_size,
      `updated_at` = CURRENT_TIMESTAMP
  WHERE `id` = NEW.user_id;
END$$

CREATE OR REPLACE TRIGGER `trg_documents_decrease_storage`
AFTER DELETE ON `documents`
FOR EACH ROW
BEGIN
  UPDATE `users`
  SET `storage_used` = GREATEST(CAST(`storage_used` AS SIGNED) - CAST(OLD.file_size AS SIGNED), 0),
      `updated_at` = CURRENT_TIMESTAMP
  WHERE `id` = OLD.user_id;
END$$

DELIMITER ;

-- =============================================================================
-- BƯỚC 5: NẠP DỮ LIỆU DANH MỤC HỆ THỐNG (REFERENCE / CATALOG DATA)
-- =============================================================================

INSERT INTO `ai_providers` (`id`, `name`, `api_base_url`, `auth_header_format`, `icon`, `is_active`) VALUES
('gemini', 'Google Gemini', 'https://generativelanguage.googleapis.com/v1beta', 'x-goog-api-key', 'sparkles', 1),
('openai', 'OpenAI', 'https://api.openai.com/v1', 'Bearer {KEY}', 'bot', 1),
('claude', 'Anthropic Claude', 'https://api.anthropic.com/v1', 'x-api-key', 'brain', 1),
('groq', 'Groq Cloud', 'https://api.groq.com/openai/v1', 'Bearer {KEY}', 'zap', 1),
('openrouter', 'OpenRouter', 'https://openrouter.ai/api/v1', 'Bearer {KEY}', 'globe', 1),
('custom', 'Custom OpenAI-Compatible', 'http://localhost:11434/v1', 'Bearer {KEY}', 'server', 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `api_base_url` = VALUES(`api_base_url`);

INSERT INTO `ai_models` (`id`, `provider_id`, `display_name`, `context_window`, `max_output_tokens`, `supports_vision`, `is_default`) VALUES
('gemini-1.5-flash', 'gemini', 'Gemini 1.5 Flash (Tốc độ cao & Ngữ cảnh 1M)', 1048576, 8192, 1, 1),
('gemini-1.5-pro', 'gemini', 'Gemini 1.5 Pro (Lập luận sâu & Ngữ cảnh 2M)', 2097152, 8192, 1, 0),
('gemini-2.0-flash-exp', 'gemini', 'Gemini 2.0 Flash Experimental', 1048576, 8192, 1, 0),
('gpt-4o', 'openai', 'GPT-4o (Đa phương tiện Omni)', 128000, 16384, 1, 1),
('gpt-4o-mini', 'openai', 'GPT-4o Mini (Tiết kiệm chi phí)', 128000, 16384, 1, 0),
('o3-mini', 'openai', 'o3-mini (Lập luận toán học & logic)', 200000, 100000, 0, 0),
('claude-3-5-sonnet-20241022', 'claude', 'Claude 3.5 Sonnet (Đọc hiểu & Viết văn bản)', 200000, 8192, 1, 1),
('claude-3-5-haiku-20241022', 'claude', 'Claude 3.5 Haiku (Phản hồi cực nhanh)', 200000, 8192, 1, 0),
('llama-3.3-70b-versatile', 'groq', 'Llama 3.3 70B Versatile (Groq LPU tốc độ cao)', 128000, 32768, 0, 1),
('llama-3.1-8b-instant', 'groq', 'Llama 3.1 8B Instant (Độ trễ mili-giây)', 128000, 8192, 0, 0),
('mixtral-8x7b-32768', 'groq', 'Mixtral 8x7B (MoE Architecture)', 32768, 32768, 0, 0),
('deepseek/deepseek-r1', 'openrouter', 'DeepSeek R1 (Mô hình suy luận mã nguồn mở)', 64000, 8000, 0, 1),
('anthropic/claude-3.5-sonnet', 'openrouter', 'Claude 3.5 Sonnet (Qua OpenRouter)', 200000, 8192, 1, 0),
('meta-llama/llama-3.3-70b-instruct', 'openrouter', 'Meta Llama 3.3 70B (Qua OpenRouter)', 128000, 32768, 0, 0),
('custom-model', 'custom', 'Custom Model (Ollama / LocalAI / vLLM)', 32768, 4096, 0, 1)
ON DUPLICATE KEY UPDATE `display_name` = VALUES(`display_name`), `context_window` = VALUES(`context_window`);

SET foreign_key_checks = 1;

-- =============================================================================
-- HOÀN TẤT CÀI ĐẶT TOÀN BỘ 32 BẢNG CHO CƠ SỞ DỮ LIỆU NOTE (MARIADB)
-- =============================================================================
