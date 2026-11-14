# BÁO CÁO CÁC QUYẾT ĐỊNH KIẾN TRÚC CƠ SỞ DỮ LIỆU (DESIGN DECISIONS)

---

## 1. QUYẾT ĐỊNH VỀ PHẠM VI VÀ SỐ LƯỢNG BẢNG

### 1.1. Mục tiêu ban đầu và Phân tích thực tế
- **Yêu cầu ban đầu:** Mục tiêu là khoảng 20 bảng lõi, ưu tiên thiết kế gọn gàng, không tạo bảng thừa nhưng không được hy sinh tính toàn vẹn dữ liệu.
- **Kết quả thiết kế chuẩn hóa:** Hệ thống NOTE bao gồm **24 bảng quan hệ** đạt chuẩn **3NF (Third Normal Form)**, phản ánh chính xác 9 phân hệ nghiệp vụ bắt buộc.

### 1.2. So sánh giữa Phương án Tối giản Ép 20 bảng vs Phương án Chuẩn hóa 24 bảng

| Phân hệ nghiệp vụ | Phương án Ép 20 bảng (Dùng JSON để gộp) | Phương án Chuẩn hóa 24 bảng (Khuyên dùng) | Lý do kiến trúc & Lợi ích thực tế |
|---|---|---|---|
| **Quiz & Trắc nghiệm** | Gộp câu hỏi, đáp án, và bài làm vào 2 cột JSON trong bảng `quizzes` và `quiz_attempts` (2 bảng) | Tách thành `quizzes`, `quiz_questions`, `quiz_options`, `quiz_attempts`, `quiz_attempt_answers` (5 bảng) | Trắc nghiệm cần thống kê câu hỏi hay sai, tính tỉ lệ chọn từng đáp án A/B/C/D, kiểm tra đáp án đúng. Nhồi nhét vào JSON sẽ làm mất khả năng ràng buộc Foreign Key và cản trở truy vấn phân tích học tập. |
| **Gói nén ZIP/7Z** | Lưu file đã giải nén vào JSON mảng `extracted_files` trong bảng `archives` (1 bảng) | Tách thành `archives` và bảng liên kết trích xuất `archive_extracted_files` (2 bảng) | Cho phép truy vấn ngược 2 chiều: Từ 1 tài liệu trong thư viện biết ngay nó xuất xứ từ gói nén nào, và ngược lại 1 gói nén đã trích xuất ra những tài liệu nào. Đảm bảo toàn vẹn khi tài liệu bị xóa. |
| **Bộ sưu tập (Collections)** | Dùng cột JSON mảng `document_ids`, `note_ids` | Chuẩn hóa bảng liên kết đa năng `collection_items` | Đảm bảo tính toàn vẹn khóa ngoại khi tài liệu hoặc ghi chú bị xóa thì tự động dọn dẹp khỏi bộ sưu tập (ON DELETE CASCADE). |
| **AI Context** | Lưu toàn bộ lịch sử snapshot vào 1 mảng JSON | Tách `ai_contexts` (thực thể chính) và `ai_context_versions` (lịch sử snapshot) | Kích thước snapshot ngữ cảnh có thể lên đến hàng trăm KB. Tách riêng bảng version giúp bảng chính cực kỳ gọn nhẹ, tốc độ đọc danh sách nhanh vượt trội. |

> **Kết luận:** Phương án 24 bảng là cấu trúc tối ưu nhất, tuân thủ nguyên tắc "Không dùng JSON để né thiết kế quan hệ SQL khi dữ liệu cần truy vấn và duy trì toàn vẹn khóa ngoại".

---

## 2. QUYẾT ĐỊNH VỀ HỆ QUẢN TRỊ CSDL VÀ ENGINE

- **Hệ quản trị CSDL:** MariaDB (khuyến nghị phiên bản 10.6 LTS trở lên hoặc 11.x).
- **Storage Engine:** Bắt buộc **`InnoDB`** cho toàn bộ 24 bảng.
  - Hỗ trợ giao dịch đầy đủ (ACID Transaction), khóa dòng (Row-level locking).
  - Hỗ trợ đầy đủ ràng buộc khóa ngoại `FOREIGN KEY` với các hành vi `ON DELETE CASCADE`, `ON DELETE SET NULL`, `ON DELETE RESTRICT`.
- **Bảng mã ký tự & Sắp thứ tự (Charset & Collation):**
  - **`utf8mb4`**: Lưu trữ đầy đủ bộ ký tự Unicode 4-byte (tiếng Việt có dấu, emoji, ký tự toán học, ký tự quốc tế).
  - **`utf8mb4_unicode_ci`**: Quy tắc so sánh văn bản đa ngôn ngữ chính xác, không phân biệt hoa thường khi tìm kiếm.

---

## 3. CƠ CHẾ BẢO MẬT DỮ LIỆU ĐA TÀI KHOẢN (MULTI-ACCOUNT ISOLATION)

- **Không tồn tại vai trò Quản trị viên (No Super Admin):**
  - Không có bảng `roles`, `permissions` phức tạp vì hệ thống là không gian cá nhân của từng người dùng độc lập.
- **Không có thành viên không gian làm việc (No Workspace Members):**
  - Tuyệt đối không tạo bảng `workspace_members` để tránh cồng kềnh và vi phạm nguyên tắc kiến trúc đã thống nhất.
- **Phân quyền tầng ứng dụng dựa trên `user_id`:**
  - Tất cả các bảng nghiệp vụ chính (`folders`, `documents`, `notes`, `collections`, `archives`, `ai_connections`, `ai_tasks`, `ai_contexts`, `flashcard_decks`, `quizzes`, `shared_links`, `activity_logs`, `notifications`) đều mang trực tiếp cột `user_id`.
  - Tầng Backend bắt buộc kiểm tra điều kiện `WHERE user_id = :current_user_id` trên mọi thao tác SELECT/UPDATE/DELETE.
  - Khóa ngoại `user_id REFERENCES users(id) ON DELETE CASCADE` bảo đảm khi người dùng xóa tài khoản, toàn bộ dữ liệu thuộc về người dùng đó được dọn dẹp sạch sẽ.

---

## 4. CHIẾN LƯỢC LƯU TRỮ LAI (HYBRID STORAGE ARCHITECTURE)

- **Nguyên tắc phân định:**
  - **MariaDB Database:** Chỉ quản lý metadata, thuộc tính định dạng, kích thước, mã băm toàn vẹn, quyền sở hữu và quan hệ logic.
  - **File Storage (VPS Local Disk / Object Storage):** Lưu trữ tệp nhị phân thực tế tại thư mục an toàn nằm ngoài web root.
- **Quy tắc đặt tên file vật lý:**
  - Tên file trên đĩa được sinh bằng UUID v4 hoặc Hash SHA-256 (ví dụ: `storage/docs/2026/04/a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf`) nhằm tránh trùng lặp tên file và ngăn chặn tấn công Direct Path Traversal.
  - Tên hiển thị gốc được lưu trong cột `original_name` của bảng `documents`.
- **Kiểm tra tính toàn vẹn (Integrity Check):**
  - Cột `sha256_checksum CHAR(64)` cho phép định kỳ rà soát chống sửa đổi tệp ngoài ý muốn và phát hiện tệp trùng lặp (de-duplication).

---

## 5. BẢO MẬT KHÓA AI THEO MÔ HÌNH BYOK (BRING YOUR OWN KEY)

- **Mã hóa đối xứng AES-256-GCM:**
  - Cột `encrypted_api_key VARBINARY(512)` lưu trữ ciphertext của khóa API.
  - Cột `encryption_iv VARBINARY(16)` lưu Initialization Vector ngẫu nhiên cho từng lần mã hóa.
  - Cột `encryption_tag VARBINARY(16)` lưu Authentication Tag xác thực tính toàn vẹn.
  - Khóa chủ mã hóa (Master Encryption Key) được lưu trong biến môi trường của máy chủ ứng dụng (hoặc Secret Manager), tuyệt đối không lưu trong database.
- **Mặt nạ hiển thị (Display Mask):**
  - Cột `api_key_masked VARCHAR(64)` chỉ lưu chuỗi đã làm mờ (ví dụ: `sk-proj-••••••••••••••••W8a9`), chỉ dùng cho hiển thị trên giao diện người dùng. Không bao giờ giải mã khóa về frontend trừ khi gửi request trực tiếp đến AI Provider.

---

## 6. BẢO MẬT GÓI NÉN ZIP/7Z & TRÍCH XUẤT CHỌN LỌC

- **Kiểm soát an toàn trước giải nén:**
  - Không bung nén toàn bộ tệp ra đĩa khi người dùng mới tải lên.
  - Tầng ứng dụng phân tích header file và sinh cấu trúc JSON Manifest lưu vào cột `manifest_json`.
  - Bộ lọc quét an toàn:
    - Loại bỏ ngay các tệp có ký tự nguy hiểm (`../`, `..\`, đường dẫn bắt đầu bằng `/` hoặc ổ đĩa `C:\`).
    - Giới hạn kích thước bung nén tối đa (ví dụ tối đa 100MB cho 1 gói nén).
    - Cảnh báo hoặc từ chối các tệp thực thi (`.exe`, `.dll`, `.bat`, `.sh`, `.cmd`, `.ps1`, `.scr`).
- **Liên kết nguồn gốc trích xuất:**
  - Bảng `archive_extracted_files` thiết lập quan hệ giữa tệp con bên trong gói nén với tài liệu tương ứng trong bảng `documents`.
  - Ràng buộc `ON DELETE CASCADE` khi xóa gói nén (hoặc giữ lại tài liệu tùy cấu hình nghiệp vụ).

---

## 7. BẢO MẬT LIÊN KẾT CHIA SẺ NGOÀI (PUBLIC / PRIVATE SHARING)

- **Không lưu Token thô:**
  - Token truy cập được sinh dưới dạng chuỗi ngẫu nhiên có độ dài 32 - 64 ký tự an toàn mật mã (ví dụ: `shr_8f9a2b...`).
  - Trong bảng `shared_links`, hệ thống chỉ lưu `token_hash CHAR(64)` (mã băm SHA-256 của token). Khi người ngoài truy cập URL, ứng dụng băm token nhận được và truy vấn theo `token_hash`.
  - Nếu database bị dump, kẻ tấn công không thể suy ngược ra token để mở tài liệu.
- **Mật khẩu bảo vệ liên kết:**
  - Lưu trữ dưới dạng `password_hash VARCHAR(255)` bằng thuật toán Argon2id / Bcrypt.
- **Kiểm soát vòng đời:**
  - Thu hồi liên kết tức thì bằng cờ `is_revoked = 1`.
  - Tự động từ chối truy cập khi `expires_at < NOW()`.
