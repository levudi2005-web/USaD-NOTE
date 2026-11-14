# TÀI LIỆU PHÂN TÍCH YÊU CẦU NGHIỆP VỤ HỆ THỐNG NOTE (BUSINESS REQUIREMENTS)

---

## 1. TỔNG QUAN HỆ THỐNG VÀ CÁC QUYẾT ĐỊNH KIẾN TRÚC ĐÃ THỐNG NHẤT

Hệ thống **NOTE** là một nền tảng Web Application chuyên nghiệp phục vụ quản lý tài liệu, đọc tài liệu đa định dạng, ghi chú cá nhân và tăng cường năng suất học tập thông qua Trợ lý Trí tuệ Nhân tạo (AI).

### Các nguyên tắc kiến trúc cốt lõi bất di bất dịch:
1. **Kiến trúc Multi-account (Đa tài khoản cá nhân độc lập):**
   - Mỗi tài khoản thuộc quyền sở hữu của một người dùng duy nhất (`user_id`).
   - Tuyệt đối **không có vai trò Super Admin hay quản trị viên nội bộ** can thiệp vào dữ liệu người dùng.
   - Tuyệt đối **không có cơ chế cộng tác nhóm** (team collaboration, shared workspace, workspace members).
   - Mọi truy vấn và nghiệp vụ phải luôn được cô lập chặt chẽ theo `user_id`.
2. **Cơ sở dữ liệu MariaDB:**
   - Hệ quản trị CSDL quan hệ chính: **MariaDB 10.6+ / 11.x**.
   - Storage Engine chuẩn hóa: **InnoDB** (bảo đảm tính toàn vẹn giao dịch ACID, Foreign Key constraints).
   - Character set: **`utf8mb4`** với Collation: **`utf8mb4_unicode_ci`** hỗ trợ trọn vẹn tiếng Việt có dấu, ký tự đa ngôn ngữ và emoji.
3. **Mô hình AI BYOK (Bring Your Own Key):**
   - Người dùng tự cung cấp API Key của các nhà cung cấp AI.
   - API Key **không bao giờ được lưu trữ dưới dạng plaintext**; bắt buộc mã hóa đối xứng AES-256-GCM ở tầng máy chủ ứng dụng trước khi ghi vào cơ sở dữ liệu.
   - Hệ thống không tự động chuyển đổi sang provider/model trả phí khác khi chưa được người dùng cấu hình.
4. **Mô hình Hybrid Storage (Lưu trữ lai):**
   - Cơ sở dữ liệu MariaDB chỉ lưu trữ: Metadata, cấu trúc thư mục, quan hệ logic, nội dung ghi chú text, manifest gói nén và các chỉ mục tìm kiếm.
   - Tệp nhị phân tài liệu (PDF, DOCX, XLSX, ZIP, ảnh...) được lưu trữ an toàn trên file system/object storage độc lập (Local Disk VPS / MinIO / S3).
   - Đường dẫn tương đối (`storage_path`) và Checksum (SHA-256) được lưu trong CSDL để đối soát tính toàn vẹn.
5. **Cơ chế Chia sẻ Tài liệu ra Bên ngoài (External Sharing):**
   - Cho phép chia sẻ tài liệu ra ngoài thông qua liên kết (Token bảo mật).
   - Người nhận liên kết **không bắt buộc phải có tài khoản NOTE**.
   - Hỗ trợ thiết lập mật khẩu bảo vệ, giới hạn thời gian hết hạn (expiration date), quyền xem/tải xuống và khả năng thu hồi (revoke) ngay lập tức.

---

## 2. PHÂN TÍCH NGHIỆP VỤ CHI TIẾT THEO PHÂN HỆ

### 2.1. Phân hệ Quản lý Tài khoản & Xác thực (Account & Authentication)
- **Đăng ký / Đăng nhập:**
  - Định danh duy nhất bằng `email` và `password`.
  - Không triển khai quy trình gửi email xác minh (Zero Email Dependency), giúp hệ thống hoạt động độc lập không cần SMTP relay bên ngoài.
  - Mật khẩu phải được băm bảo mật bằng thuật toán hiện đại (`Argon2id` hoặc `Bcrypt`) kèm salt ngẫu nhiên trước khi lưu vào CSDL (`password_hash`).
- **Khôi phục mật khẩu (Recovery Codes):**
  - Vì không gửi email đặt lại mật khẩu, người dùng được cấp một tập danh sách **Recovery Codes** khi đăng ký hoặc khi chủ động tái tạo trong màn hình Cài đặt.
  - Recovery Code được lưu dưới dạng băm (`code_hash`). Khi người dùng quên mật khẩu, họ nhập Recovery Code để đặt lại mật khẩu mới. Mỗi mã chỉ dùng được 1 lần (`used_at IS NOT NULL`).
- **Quản lý Phiên đăng nhập (Session Management):**
  - Hỗ trợ đăng nhập đa thiết bị (Desktop, Laptop, Mobile).
  - Bảng phiên lưu vết: `session_token_hash`, `device_info`, `ip_address`, `last_active_at`, `expires_at`.
  - Người dùng có thể chủ động hủy phiên từ xa hoặc đăng xuất khỏi tất cả thiết bị.
- **Xóa tài khoản:**
  - Hỗ trợ xóa tài khoản triệt để. Khi xóa tài khoản, toàn bộ dữ liệu tài liệu, ghi chú, flashcard, AI context của người dùng sẽ bị xóa dây chuyền (Cascade) hoặc hủy kích hoạt an toàn.

### 2.2. Phân hệ Quản lý Tài liệu & Cấu trúc Thư mục (Document & File Management)
- **Cấu trúc Thư mục cây phân cấp (Hierarchical Folders):**
  - Quan hệ đệ quy (Adjacency List model): `folders.parent_id REFERENCES folders.id`.
  - Hỗ trợ thư mục gốc (`parent_id IS NULL`) và các thư mục con đa cấp.
  - Tùy chỉnh màu sắc (`color`) và icon trực quan.
- **Quản lý Tài liệu (Documents):**
  - Hỗ trợ đa định dạng: PDF, DOCX, DOC, XLSX, XLS, PPTX, PPT, TXT, MD, CSV, JPG, PNG, WEBP, EPUB.
  - Lưu trữ đầy đủ metadata kỹ thuật: `file_name`, `original_name`, `file_size`, `mime_type`, `file_extension`, `sha256_checksum`, `storage_path`.
  - Trạng thái xử lý (`processing_status`): `pending`, `processing`, `ready`, `failed`.
  - Hỗ trợ xóa mềm (`deleted_at IS NOT NULL`) cho phép khôi phục khi thao tác nhầm và xóa vĩnh viễn (purge) để giải phóng dung lượng.
- **Ghi chú & Đánh dấu (Notes & Annotations):**
  - Người dùng có thể tạo ghi chú độc lập hoặc liên kết trực tiếp với tài liệu (`document_id`).
  - Hỗ trợ ghim (`pinned`), yêu thích (`favorite`), danh mục (`category`) và nội dung rich-text HTML/Markdown.
- **Thẻ phân loại (Tags) & Bộ sưu tập (Collections):**
  - Phân loại tài liệu đa chiều qua quan hệ nhiều - nhiều giữa `documents` và `tags`.
  - Bộ sưu tập (`collections`) đóng vai trò gom nhóm chuyên đề các tài liệu, ghi chú và bộ thẻ phục vụ cho một dự án hoặc mục tiêu học tập cụ thể.

### 2.3. Phân hệ Quản lý Gói nén ZIP / 7Z (Archive Management)
Đây là nghiệp vụ chính thức và cốt lõi của NOTE:
- **Lưu trữ gói nén gốc (Archives):**
  - Upload gói nén `.zip` hoặc `.7z`.
  - Lưu thông tin gói nén: tên file, kích thước nén, định dạng (`zip`, `7z`), tổng số file bên trong, đường dẫn lưu trữ, mã băm SHA-256.
- **Duyệt cây thư mục và danh sách file (Manifest Inspection):**
  - Đọc danh sách file bên trong gói nén mà không giải nén ra đĩa vật lý.
  - Lưu cấu trúc cây thư mục và metadata của từng tệp con dưới dạng JSON Manifest (`manifest_json`).
- **Cơ chế giải nén an toàn & liên kết dữ liệu:**
  - Cho phép giải nén toàn bộ hoặc chọn lọc từng file cụ thể (`selective extraction`).
  - File con sau khi giải nén được đăng ký chính thức thành một bản ghi trong bảng `documents`.
  - Bảng liên kết trích xuất (`archive_extracted_files`) ghi nhận: tệp nào trong `documents` bắt nguồn từ tệp con (`inner_path`) của gói nén `archive_id` nào.
- **Bảo mật gói nén (Archive Security Guard):**
  - Chống lỗ hổng **Zip Slip / Path Traversal**: Kiểm tra tên đường dẫn bên trong gói nén, cấm tuyệt đối chứa `../` hoặc ký tự tuyệt đối.
  - Chống **Zip Bomb**: Giới hạn tỉ lệ nén, dung lượng bung nén tối đa, số lượng file tối đa (ví dụ tối đa 500 files, độ sâu thư mục tối đa 5 tầng).
  - Trạng thái quét an toàn (`scan_status`): `pending`, `clean`, `quarantined`, `rejected`.
  - Tuyệt đối không cho phép thực thi mã nguồn hoặc file nhị phân (`.exe`, `.bat`, `.sh`, `.vbs`, `.js`) từ gói nén.

### 2.4. Phân hệ AI BYOK (Bring Your Own Key) & Kết nối Nhà cung cấp
- **Danh mục nhà cung cấp đa dạng:**
  - Hỗ trợ: `Google Gemini`, `OpenAI`, `Anthropic Claude`, `Groq`, `OpenRouter`, và các nhà cung cấp tương thích giao thức `OpenAI-compatible` (Ollama, LocalAI, vLLM, DeepSeek).
- **Lưu trữ & Bảo mật API Key:**
  - Khóa API được mã hóa bằng thuật toán đối xứng: `encrypted_api_key`, `encryption_iv`, `encryption_tag`.
  - Cung cấp chuỗi mặt nạ (`api_key_masked`) để hiển thị an toàn trên giao diện người dùng (chỉ hiển thị 4 ký tự đầu và 4 ký tự cuối, ví dụ: `AIzaSy••••••••••••••••3aB8`).
- **Quản lý cấu hình & Model:**
  - Người dùng có thể tạo nhiều kết nối AI cùng lúc.
  - Cho phép chọn model mặc định (`default_model`) và lưu danh sách model hỗ trợ dạng JSON.
  - Ghi nhận trạng thái kiểm tra kết nối (`is_connected`, `last_tested_at`, `status_message`).

### 2.5. Phân hệ Quy trình AI (AI Workflows & Task Execution)
- **Tác vụ AI tự động:**
  - Tóm tắt tài liệu, giải thích khái niệm, trích xuất thực thể, sinh câu hỏi trắc nghiệm, tạo flashcard tự động.
  - Theo dõi trạng thái tiến trình xử lý: `queued`, `processing`, `completed`, `failed`.
  - Liên kết chặt chẽ với tài liệu nguồn (`source_document_id`).
- **Nhật ký thực thi chi tiết (Execution Logs):**
  - Ghi nhận: thời gian chạy, thời lượng (`duration_ms`), số token tiêu thụ (`tokens_used`), dữ liệu đầu vào tóm lược và phản hồi kết quả đầu ra.
  - Lưu vết thông báo lỗi cụ thể khi có sự cố từ API bên ngoài, hỗ trợ thử lại (retry).

### 2.6. Phân hệ AI Context JSON (Knowledge Capsule)
Khác biệt hoàn toàn với lịch sử chat nhất thời, **AI Context** là kho tri thức có cấu trúc, bền vững và có thể chuyển giao:
- **Cấu trúc dữ liệu AI Context:**
  - `schema_version`: Phiên bản cấu trúc dữ liệu JSON (ví dụ: `1.0.0`).
  - `context_version`: Phiên bản nội dung tri thức (ví dụ: `1.2.0`).
  - `summary`: Tóm tắt tổng quan tri thức tích lũy.
  - `knowledge_points`: Các điểm tri thức cốt lõi (dạng danh sách có cấu trúc).
  - `conclusions`: Các kết luận đã được kiểm chứng.
  - `learning_progress`: Điểm tiến độ hiểu biết (0 - 100%).
  - `open_questions`: Danh sách các câu hỏi còn mở cần làm rõ trong các phiên học sau.
  - `handoff_directive`: Bản chỉ dẫn sư phạm dành cho phiên AI tiếp theo (AI Prompt / Context Handoff).
- **Lịch sử phiên bản (Version Snapshots):**
  - Mỗi khi cập nhật, hệ thống có thể chụp nhanh (Snapshot) toàn bộ trạng thái vào bảng `ai_context_versions`.
  - Hỗ trợ xem lại lịch sử thay đổi, ghi chú phiên bản, hoàn tác (restore) hoặc hợp nhất (merge) ngữ cảnh.
- **Liên kết nguồn:**
  - Liên kết nhiều tài liệu và ghi chú nguồn tạo nên ngữ cảnh tri thức đó.

### 2.7. Phân hệ Flashcards & Quiz (Active Recall & Spaced Repetition)
- **Flashcard (Thẻ ghi nhớ):**
  - Tổ chức theo bộ thẻ (`flashcard_decks`), liên kết tùy chọn với tài liệu nguồn (`document_id`).
  - Mỗi thẻ (`flashcards`) gồm mặt trước (`front_text`), mặt sau (`back_text`), trạng thái đã nhớ (`is_known`), số lần ôn tập (`review_count`) và thời điểm ôn gần nhất (`last_reviewed_at`).
- **Quiz (Bài thi trắc nghiệm):**
  - Bài kiểm tra (`quizzes`) cấu hình: tiêu đề, mô tả, thời gian làm bài tối đa (`time_limit_sec`), số lần làm bài tối đa.
  - Câu hỏi (`quiz_questions`): nội dung câu hỏi, thứ tự hiển thị, phần giải thích đáp án chi tiết (`explanation`).
  - Đáp án trắc nghiệm (`quiz_options`): nội dung lựa chọn A/B/C/D, cờ đánh dấu đáp án đúng (`is_correct`).
- **Lịch sử làm bài & Phân tích kết quả:**
  - Lượt làm bài (`quiz_attempts`): ghi nhận điểm số đạt được, tổng số câu đúng, thời gian hoàn thành.
  - Chi tiết từng câu trả lời (`quiz_attempt_answers`): lưu lựa chọn của người học (`selected_option_id`) và kết quả đúng/sai, phục vụ xem lại câu sai để khắc phục lỗ hổng kiến thức.

### 2.8. Phân hệ Chia sẻ Ngoại vi (External Sharing)
- **Tạo liên kết chia sẻ:**
  - Mỗi tài liệu có thể tạo một hoặc nhiều liên kết chia sẻ (`shared_links`).
  - Token định danh ngẫu nhiên, dài và khó đoán; CSDL chỉ lưu mã băm SHA-256 của token (`token_hash`) để chống lộ lọt dữ liệu từ database dump.
  - Hỗ trợ đặt mật khẩu bảo vệ (lưu dạng `password_hash`).
  - Hỗ trợ thời hạn truy cập (`expires_at`), cờ cho phép/chặn tải xuống (`allow_download`), thu hồi liên kết tức thì (`is_revoked`).
- **Nhật ký truy cập liên kết (Share Access Logs):**
  - Ghi nhận số lượt truy cập (`views_count`), IP, trình duyệt (User-Agent) và loại hành động (`view` hoặc `download`).

### 2.9. Phân hệ Nhật ký Hoạt động & Thông báo Hệ thống (Operations & Notifications)
- **Thông báo (`notifications`):**
  - Nhắc lịch học tập ôn thẻ, thông báo hoàn thành tác vụ AI nền, cảnh báo lượt xem liên kết chia sẻ.
- **Nhật ký hoạt động (`activity_logs`):**
  - Audit trail ghi nhận các biến động dữ liệu quan trọng (tải lên file, giải nén, cập nhật context, làm bài quiz).
