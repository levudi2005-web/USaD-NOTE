# ĐỀ XUẤT ĐIỀU CHỈNH VÀ NÂNG CẤP MÔ HÌNH DỮ LIỆU (RECOMMENDED CHANGES)

---

## 1. TỔNG QUAN PHƯƠNG ÁN NÂNG CẤP (BLUEPRINT COMPARISON)

Để giải quyết triệt để các phát hiện trong quá trình audit (đặc biệt là thiếu lịch sử chat AI, thiếu danh mục provider/model, và rủi ro mồ côi dữ liệu trong collection_items), mô hình dữ liệu NOTE được đề xuất nâng cấp từ **28 bảng lên 32 bảng chuẩn hóa**:

```
+-----------------------------------------------------------------------------------------------+
|                                SO SÁNH TRƯỚC VÀ SAU ĐIỀU CHỈNH                                |
+-------------------------------+-------------------------------+-------------------------------+
| Tiêu chí                      | Mô hình ban đầu (28 bảng)     | Mô hình Đề xuất (32 bảng)     |
+-------------------------------+-------------------------------+-------------------------------+
| AI Chat History               | KHÔNG CÓ (Thiếu nghiêm trọng) | ĐẦY ĐỦ: `ai_conversations`,   |
|                               |                               |         `ai_messages`         |
+-------------------------------+-------------------------------+-------------------------------+
| Danh mục AI Provider & Model  | Gộp chuỗi trong connections   | TÁCH CHUẨN 3NF: `ai_providers`|
|                               |                               |                 `ai_models`   |
+-------------------------------+-------------------------------+-------------------------------+
| Collection Items Integrity    | Đa hình (Polymorphic lỏng)    | Khóa ngoại tường minh có CHECK|
|                               | Rủi ro bản ghi mồ côi         | Ràng buộc toàn vẹn 100%       |
+-------------------------------+-------------------------------+-------------------------------+
| Toàn vẹn Đáp án Quiz          | Độc lập question & option     | Khóa ngoại tổ hợp ràng buộc   |
|                               | Có thể nộp sai đáp án         | Đáp án thuộc đúng câu hỏi     |
+-------------------------------+-------------------------------+-------------------------------+
| Kiểm soát Zip Bomb            | Chỉ lưu kích thước nén        | Lưu `uncompressed_size` và    |
|                               |                               | tính `compression_ratio`      |
+-------------------------------+-------------------------------+-------------------------------+
| Xoay vòng khóa AI Key         | Thiếu phiên bản khóa mã hóa   | Thêm `key_version`            |
+-------------------------------+-------------------------------+-------------------------------+
| Chống Brute-force Recovery    | Không giới hạn số lần thử     | Thêm `failed_recovery_attempts`|
|                               |                               | và `recovery_locked_until`    |
+-------------------------------+-------------------------------+-------------------------------+
```

---

## 2. DANH SÁCH 32 BẢNG QUAN HỆ TRONG MÔ HÌNH ĐỀ XUẤT

```
Nhóm 1: Tài khoản & Bảo mật (3 bảng)
  1. users (Bổ sung failed_recovery_attempts, recovery_locked_until)
  2. user_recovery_codes
  3. user_sessions (Bổ sung is_revoked)

Nhóm 2: Tài liệu & Thư viện (7 bảng)
  4. folders (Thêm UNIQUE (user_id, id) chống cross-tenant)
  5. documents (Thêm UNIQUE (user_id, id) chống cross-tenant)
  6. notes
  7. tags
  8. document_tags
  9. collections
  10. collection_items (Chuẩn hóa khóa ngoại tường minh thay cho polymorphic)

Nhóm 3: Gói nén ZIP/7Z (2 bảng)
  11. archives (Bổ sung uncompressed_size, max_ratio)
  12. archive_extracted_files

Nhóm 4: AI BYOK Catalog & Connections (3 bảng)
  13. ai_providers (MỚI: Danh mục Gemini, OpenAI, Claude, Groq, OpenRouter, Custom)
  14. ai_models (MỚI: Danh mục model, context window, vision support)
  15. ai_connections (Chuẩn hóa FK -> ai_providers, ai_models; thêm key_version)

Nhóm 5: AI Assistant & Hội thoại (2 bảng)
  16. ai_conversations (MỚI: Phiên trò chuyện, ghim tài liệu ngữ cảnh)
  17. ai_messages (MỚI: Từng tin nhắn, role, tokens, references trích dẫn nguồn)

Nhóm 6: Quy trình AI tự động (2 bảng)
  18. ai_tasks
  19. ai_task_logs

Nhóm 7: AI Context Capsule (2 bảng)
  20. ai_contexts
  21. ai_context_versions

Nhóm 8: Flashcard (2 bảng)
  22. flashcard_decks
  23. flashcards

Nhóm 9: Quiz & Trắc nghiệm (5 bảng)
  24. quizzes
  25. quiz_questions
  26. quiz_options (Thêm UNIQUE (question_id, id))
  27. quiz_attempts
  28. quiz_attempt_answers (Khóa ngoại tổ hợp question_id + selected_option_id)

Nhóm 10: Chia sẻ Ngoại vi (2 bảng)
  29. shared_links (Bổ sung failed_pass_attempts, pass_locked_until)
  30. share_access_logs

Nhóm 11: Vận hành & Giám sát (2 bảng)
  31. activity_logs
  32. notifications
```

---

## 3. ĐẶC TẢ CHI TIẾT CÁC BẢNG MỚI BỔ SUNG

### 3.1. Bảng `ai_providers` (Danh mục Nhà cung cấp AI)
```sql
CREATE TABLE `ai_providers` (
  `id` VARCHAR(50) NOT NULL COMMENT 'Mã nhà cung cấp (gemini, openai, claude, groq, openrouter, custom)',
  `name` VARCHAR(100) NOT NULL COMMENT 'Tên hiển thị (Google Gemini, OpenAI, Groq Cloud...)',
  `api_base_url` VARCHAR(255) NOT NULL COMMENT 'URL endpoint API gốc',
  `auth_header_format` VARCHAR(100) NOT NULL COMMENT 'Định dạng header xác thực (Bearer {KEY}, x-goog-api-key)',
  `icon` VARCHAR(50) NOT NULL DEFAULT 'sparkles' COMMENT 'Icon hiển thị UI',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Trạng thái kích hoạt',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Danh mục nhà cung cấp AI hệ thống hỗ trợ';
```

### 3.2. Bảng `ai_models` (Danh mục Model AI)
```sql
CREATE TABLE `ai_models` (
  `id` VARCHAR(100) NOT NULL COMMENT 'Mã model định danh (gemini-1.5-flash, gpt-4o...)',
  `provider_id` VARCHAR(50) NOT NULL COMMENT 'Nhà cung cấp sở hữu model',
  `display_name` VARCHAR(150) NOT NULL COMMENT 'Tên hiển thị trên giao diện',
  `context_window` INT UNSIGNED NOT NULL COMMENT 'Độ dài ngữ cảnh tối đa (tokens)',
  `max_output_tokens` INT UNSIGNED NOT NULL COMMENT 'Số token đầu ra tối đa',
  `supports_vision` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Hỗ trợ xử lý hình ảnh và tài liệu PDF trực tiếp',
  `is_default` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Cờ đánh dấu model khuyên dùng mặc định của provider',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ai_models_provider` (`provider_id`),
  CONSTRAINT `fk_models_provider` FOREIGN KEY (`provider_id`) REFERENCES `ai_providers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Danh mục model AI và thông số kỹ thuật';
```

### 3.3. Bảng `ai_conversations` (Cuộc trò chuyện với AI)
```sql
CREATE TABLE `ai_conversations` (
  `id` CHAR(36) NOT NULL COMMENT 'UUID cuộc trò chuyện',
  `user_id` CHAR(36) NOT NULL COMMENT 'Tài khoản sở hữu cuộc trò chuyện',
  `connection_id` CHAR(36) DEFAULT NULL COMMENT 'Kết nối AI BYOK được sử dụng',
  `model_name` VARCHAR(100) NOT NULL COMMENT 'Tên model đã sử dụng',
  `title` VARCHAR(200) NOT NULL COMMENT 'Tiêu đề cuộc trò chuyện',
  `pinned_document_id` CHAR(36) DEFAULT NULL COMMENT 'Tài liệu nguồn được ghim làm ngữ cảnh hỏi đáp',
  `total_tokens_used` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Tổng số token tiêu thụ trong cuộc trò chuyện',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ai_conv_user_time` (`user_id`, `updated_at` DESC),
  KEY `idx_ai_conv_doc` (`pinned_document_id`),
  CONSTRAINT `fk_aiconv_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_aiconv_connection` FOREIGN KEY (`connection_id`) REFERENCES `ai_connections` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_aiconv_document` FOREIGN KEY (`pinned_document_id`) REFERENCES `documents` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Các phiên trò chuyện với Trợ lý AI';
```

### 3.4. Bảng `ai_messages` (Tin nhắn trong cuộc trò chuyện)
```sql
CREATE TABLE `ai_messages` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Khóa chính tự tăng',
  `conversation_id` CHAR(36) NOT NULL COMMENT 'Cuộc trò chuyện chứa tin nhắn',
  `role` ENUM('user', 'assistant', 'system') NOT NULL COMMENT 'Vai trò người gửi',
  `content` LONGTEXT NOT NULL COMMENT 'Nội dung tin nhắn (hỗ trợ Markdown, code blocks)',
  `prompt_tokens` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Số token đầu vào',
  `completion_tokens` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Số token sinh ra',
  `references_json` JSON DEFAULT NULL COMMENT 'Nguồn tài liệu trích dẫn tham chiếu (mảng các đoạn văn/trang)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ai_msg_conv_time` (`conversation_id`, `created_at` ASC),
  CONSTRAINT `fk_aimsg_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `ai_conversations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Chi tiết tin nhắn trong cuộc trò chuyện AI';
```

---

## 4. QUY TRÌNH HÀNH ĐỘNG TIẾP THEO

- Toàn bộ các đề xuất trên đang được giữ ở dạng **Báo cáo Thẩm định độc lập (Audit Report)**.
- **Không tự ý ghi đè hay thay đổi bất kỳ tệp thiết kế gốc nào** cho đến khi bạn xem xét và phê duyệt phương án nâng cấp từ 28 bảng lên 32 bảng này.
- Khi nhận được sự đồng thuận của bạn, tôi sẽ tiến hành cập nhật đồng bộ các file MCD, MLD, MPD, Data Dictionary và chuẩn bị sẵn sàng cho bước sinh mã SQL DDL.
