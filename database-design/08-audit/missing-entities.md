# BÁO CÁO RÀ SOÁT CÁC THỰC THỂ CÒN THIẾU (MISSING ENTITIES AUDIT)

---

## 1. TỔNG HỢP CÁC THỰC THỂ THIẾU THEO MỨC ĐỘ NGHIÊM TRỌNG

Qua đối chiếu chi tiết giữa giao diện thực tế của ứng dụng NOTE (đặc biệt là module `ai-assistant.js`, `settings.js`, `archives.js`) và thiết kế cơ sở dữ liệu hiện tại, phát hiện **4 nhóm thực thể quan trọng còn thiếu hoặc chưa được tách bạch chuẩn hóa**:

| Nhóm thực thể thiếu | Phân hệ nghiệp vụ | Mức độ nghiêm trọng | Tác động chính |
|---|---|:---:|---|
| **`ai_conversations` & `ai_messages`** | AI Assistant (Hội thoại) | **CRITICAL** | Thiếu hoàn toàn nơi lưu vết lịch sử trò chuyện với AI của người dùng. |
| **`ai_providers` & `ai_models`** | AI BYOK (Danh mục hệ thống) | **HIGH** | Trộn lẫn danh mục nhà cung cấp/model hệ thống hỗ trợ với cấu hình API Key cá nhân. |
| **`uncompressed_size` & Archive Security Specs** | Gói nén ZIP/7Z | **HIGH** | Thiếu các trường định lượng để phát hiện Zip Bomb trước khi giải nén. |
| **`user_security_attempts` / Failed Logins** | Tài khoản & Bảo mật | **MEDIUM** | Thiếu cơ chế khóa chống Brute-force khi nhập sai Recovery Code liên tiếp. |

---

## 2. CHI TIẾT TỪNG THỰC THỂ THIẾU VÀ ĐỀ XUẤT THIẾT KẾ

### [CRITICAL] 2.1. Phân hệ AI Assistant: Thiếu `ai_conversations` và `ai_messages`

- **Vị trí nghiệp vụ:** Màn hình AI Assistant (`src/js/modules/note/ai-assistant.js`).
- **Nguyên nhân:** Thiết kế trước đây nhầm lẫn giữa **Quy trình AI nền (`ai_tasks`)**, **Ngữ cảnh tri thức (`ai_contexts`)** và **Lịch sử hội thoại trò chuyện (Chat History)**, dẫn đến việc bỏ quên hoàn toàn bảng lưu trữ các phiên hội thoại tương tác trực tiếp của người dùng.
- **Hậu quả:** Khi người dùng trò chuyện, hỏi đáp tài liệu, sinh dàn ý hay giải thích khái niệm, sau khi tải lại trang toàn bộ tin nhắn chat sẽ bị mất sạch, không thể xem lại các phiên hội thoại cũ.
- **Đề xuất bổ sung:**

#### Thực thể `AI_CONVERSATION` (Bảng: `ai_conversations`)
- Quản lý từng phiên hội thoại chat:
  - `id`: CHAR(36) PK (UUID v4).
  - `user_id`: CHAR(36) FK $\to$ `users(id)` (ON DELETE CASCADE).
  - `connection_id`: CHAR(36) FK $\to$ `ai_connections(id)` (ON DELETE SET NULL) — Kết nối AI dùng cho phiên này.
  - `model_name`: VARCHAR(100) NOT NULL — Model sử dụng (ví dụ: `gemini-1.5-flash`).
  - `title`: VARCHAR(200) NOT NULL — Tiêu đề cuộc trò chuyện (tự động tóm tắt từ tin nhắn đầu).
  - `pinned_document_id`: CHAR(36) FK $\to$ `documents(id)` (ON DELETE SET NULL) — Tài liệu được ghim làm ngữ cảnh hỏi đáp (nếu có).
  - `total_tokens_used`: INT UNSIGNED DEFAULT 0 — Tổng token đã dùng trong cuộc trò chuyện.
  - `created_at`: DATETIME NOT NULL.
  - `updated_at`: DATETIME NOT NULL.

#### Thực thể `AI_MESSAGE` (Bảng: `ai_messages`)
- Từng tin nhắn trong cuộc trò chuyện:
  - `id`: BIGINT UNSIGNED AUTO_INCREMENT PK.
  - `conversation_id`: CHAR(36) FK $\to$ `ai_conversations(id)` (ON DELETE CASCADE).
  - `role`: ENUM('user', 'assistant', 'system') NOT NULL.
  - `content`: LONGTEXT NOT NULL — Nội dung tin nhắn (hỗ trợ Markdown, code blocks).
  - `prompt_tokens`: INT UNSIGNED DEFAULT 0.
  - `completion_tokens`: INT UNSIGNED DEFAULT 0.
  - `references_json`: JSON DEFAULT NULL — Danh sách trích dẫn nguồn tài liệu tham chiếu (document_id, snippet, page).
  - `created_at`: DATETIME NOT NULL.

---

### [HIGH] 2.2. Phân hệ AI BYOK: Tách bạch `ai_providers` và `ai_models`

- **Vị trí nghiệp vụ:** Cài đặt AI Provider (`src/js/modules/note/settings.js`).
- **Nguyên nhân:** Thiết kế trước đây hardcode tên provider thành chuỗi và lưu mảng JSON `available_models_json` ngay trong bảng `ai_connections`.
- **Hậu quả:**
  - Không thể chuẩn hóa danh mục nhà cung cấp mà hệ thống NOTE chính thức hỗ trợ (Google Gemini, OpenAI, Claude, Groq, OpenRouter).
  - Không quản lý được thông số kỹ thuật của từng model: Context Window tối đa (ví dụ 1M tokens đối với Gemini 1.5, 128k đối với GPT-4o), khả năng hỗ trợ đa phương tiện (Vision), và URL API gốc mặc định.
- **Đề xuất bổ sung:**

#### Thực thể `AI_PROVIDER` (Bảng: `ai_providers`) — Danh mục hệ thống
- `id`: VARCHAR(50) PK (`gemini`, `openai`, `claude`, `groq`, `openrouter`, `custom`).
- `name`: VARCHAR(100) NOT NULL (Ví dụ: "Google Gemini", "OpenAI", "Groq Cloud").
- `api_base_url`: VARCHAR(255) NOT NULL (Ví dụ: `https://generativelanguage.googleapis.com/v1beta`).
- `auth_header_format`: VARCHAR(100) NOT NULL (Ví dụ: `Bearer {KEY}` hoặc `x-goog-api-key`).
- `is_active`: TINYINT(1) DEFAULT 1.

#### Thực thể `AI_MODEL` (Bảng: `ai_models`) — Danh mục Model hệ thống
- `id`: VARCHAR(100) PK (Ví dụ: `gemini-1.5-flash`, `gpt-4o`, `claude-3-5-sonnet-20241022`).
- `provider_id`: VARCHAR(50) FK $\to$ `ai_providers(id)` (ON DELETE CASCADE).
- `display_name`: VARCHAR(150) NOT NULL.
- `context_window`: INT UNSIGNED NOT NULL (Độ dài ngữ cảnh tối đa, ví dụ: 1048576).
- `max_output_tokens`: INT UNSIGNED NOT NULL.
- `supports_vision`: TINYINT(1) DEFAULT 0 (Hỗ trợ hình ảnh/PDF trực tiếp).
- `is_default`: TINYINT(1) DEFAULT 0.

> **Tối ưu bảng `ai_connections`:**
> `ai_connections.provider` sẽ trở thành Khóa ngoại trỏ đến `ai_providers.id`, và `default_model` trỏ đến `ai_models.id`. Loại bỏ cột `available_models_json` dư thừa, đạt chuẩn 3NF tuyệt đối.

---

### [HIGH] 2.3. Phân hệ Gói nén ZIP/7Z: Bổ sung chỉ số kiểm soát Zip Bomb

- **Vị trí nghiệp vụ:** Quản lý gói nén (`src/js/modules/note/archives.js`).
- **Nguyên nhân:** Bảng `archives` hiện tại chỉ lưu `file_size` (kích thước nén) và `file_count`. Thiếu trường định lượng kích thước sau giải nén thực tế.
- **Hậu quả:** Một gói nén "Zip Bomb" (ví dụ: file nén 5MB nhưng khi bung ra chiếm 50GB) có thể làm cạn kiệt ổ cứng VPS trong chớp mắt trước khi hệ thống phát hiện.
- **Đề xuất điều chỉnh:**
  - Bổ sung vào bảng `archives`:
    - `uncompressed_size`: BIGINT UNSIGNED NOT NULL COMMENT 'Tổng dung lượng thực tế khi giải nén toàn bộ (bytes)'.
    - `max_ratio`: DECIMAL(6,2) NOT NULL DEFAULT 1.00 COMMENT 'Tỉ lệ bung nén (uncompressed_size / file_size)'.
    - Ràng buộc tầng kiểm tra: Nếu `max_ratio > 100.00` hoặc `uncompressed_size > 1073741824` (1GB), tự động đổi `scan_status = 'rejected'` và khóa hành động giải nén.

---

### [MEDIUM] 2.4. Phân hệ Bảo mật: Cơ chế chống Brute-force Recovery Code

- **Vị trí nghiệp vụ:** Khôi phục mật khẩu.
- **Nguyên nhân:** Bảng `user_recovery_codes` chỉ có cờ `used_at`, không đếm số lần nhập sai.
- **Hậu quả:** Kẻ tấn công có thể dùng công cụ dò quét tự động gửi hàng nghìn request thử các mã ngẫu nhiên để chiếm quyền tài khoản.
- **Đề xuất điều chỉnh:**
  - Bổ sung vào bảng `users`:
    - `failed_recovery_attempts`: TINYINT UNSIGNED NOT NULL DEFAULT 0.
    - `recovery_locked_until`: DATETIME DEFAULT NULL.
  - Quy tắc: Nếu nhập sai quá 5 lần liên tiếp, khóa tính năng khôi phục tài khoản trong 60 phút.
