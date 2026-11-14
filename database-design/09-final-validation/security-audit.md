# BÁO CÁO KIỂM ĐỊNH AN NINH & BẢO MẬT CƠ SỞ DỮ LIỆU (DATABASE SECURITY AUDIT)

---

## 1. MỤC TIÊU VÀ NGUYÊN TẮC BẢO MẬT HỆ THỐNG NOTE
Hệ thống NOTE tuân thủ nguyên tắc **Zero Trust** và **Defense in Depth**:
1. Không có Super Admin hoặc tài khoản nội bộ có đặc quyền xem trộm dữ liệu người dùng.
2. Dữ liệu giữa các tài khoản được cô lập vật lý ở tầng lưu trữ CSDL (Storage Engine Enforcement).
3. Bí mật mã hóa (Mật khẩu, Recovery Code, Token, API Key) áp dụng các tiêu chuẩn mã hóa mạnh nhất hiện nay (Argon2id, SHA-256, AES-256-GCM).

---

## 2. BẢNG TỔNG HỢP KIỂM TOÁN AN NINH CÁC THỰC THỂ DỮ LIỆU

| Thực thể dữ liệu | Cơ chế bảo vệ | Thuật toán / Tiêu chuẩn | Trường lưu trữ trong DB | Biện pháp chống tấn công |
|---|---|---|---|---|
| **Mật khẩu người dùng** | One-way Password Hash | Argon2id / Bcrypt | `users.password_hash` | Chống Rainbow Table, chống Brute-force bằng Salt ngẫu nhiên |
| **Mã khôi phục (Recovery Code)** | One-way Cryptographic Hash | SHA-256 | `user_recovery_codes.code_hash` | Không bao giờ lưu raw code. Khóa tài khoản sau 5 lần thử sai |
| **Session Token** | Fast Hash Lookup | SHA-256 | `user_sessions.session_token_hash` | Token ngẫu nhiên 256-bit trên client, DB chỉ lưu mã băm, có cờ `is_revoked` |
| **AI BYOK API Key** | Symmetric Authenticated Encryption | **AES-256-GCM** | `ai_connections.api_key_encrypted`, `api_key_iv`, `api_key_tag` | Chống giả mạo bản mã, hỗ trợ xoay vòng khóa qua `key_version` |
| **Token Chia sẻ Ngoài** | One-way Cryptographic Hash | SHA-256 | `shared_links.token_hash` | Người nhận chỉ nhận UUID/Secret trong URL, DB kiểm tra qua SHA-256 |
| **Mật khẩu Liên kết Chia sẻ** | One-way Password Hash | Argon2id | `shared_links.password_hash` | Khóa liên kết sau 5 lần nhập sai (`failed_pass_attempts`, `pass_locked_until`) |
| **Tệp nén ZIP/7Z** | Zip Bomb & Zip Slip Defense | Metadata Validation | `archives.uncompressed_size`, `max_ratio`, `checksum_sha256` | Trigger từ chối giải nén nếu tỷ lệ nén vượt `max_ratio = 50.0` |

---

## 3. CƠ CHẾ BẢO VỆ CHUYÊN SÂU

### 3.1. Bảo vệ Khóa API AI (BYOK - Bring Your Own Key)
- Khóa API của người dùng là tài sản nhạy cảm cao, có thể phát sinh chi phí tài chính nếu bị lộ.
- **Kiến trúc lưu trữ:**
  - Khóa chính mã hóa hệ thống (Master Encryption Key - MEK) được quản lý qua biến môi trường của backend (`APP_ENCRYPTION_KEY`), tuyệt đối không lưu trong database.
  - Mỗi bản ghi `ai_connections` lưu:
    - `api_key_encrypted`: Chuỗi byte mã hóa bằng AES-256-GCM.
    - `api_key_iv`: Vector khởi tạo ngẫu nhiên 12 bytes (96 bits) duy nhất cho mỗi lần mã hóa.
    - `api_key_tag`: Thẻ xác thực tính toàn vẹn 16 bytes (128 bits) chống can thiệp bản mã.
    - `key_version`: Phiên bản khóa mã hóa (hỗ trợ xoay vòng khóa không gián đoạn dịch vụ).

### 3.2. Phòng chống Tấn công Zip Bomb và Zip Slip
- **Zip Slip:** Khi giải nén, file con có thể chứa đường dẫn tương đối độc hại (ví dụ `../../etc/passwd`).
  - *Giải pháp CSDL:* Bảng `archive_extracted_files` lưu `inner_path` đã được chuẩn hóa (Sanitized Path) và `target_path` độc lập với hệ điều hành.
- **Zip Bomb:** File nén chỉ 1MB nhưng bung ra 100GB gây cạn kiệt dung lượng đĩa và RAM.
  - *Giải pháp CSDL:*
    - Cột `uncompressed_size` bắt buộc lưu tổng dung lượng thực tế sau giải nén.
    - Cột `compression_ratio` được cập nhật tự động.
    - Trigger `trg_archives_check_ratio` trên MariaDB tự động phát hiện và chặn nếu `compression_ratio > max_ratio (50.0)` hoặc `uncompressed_size > 10GB`.

### 3.3. Tự động Thu hồi Liên kết Chia sẻ khi Xóa mềm Tài liệu
- Khi một tài liệu bị đưa vào thùng rác (`documents.is_deleted = 1`), liên kết chia sẻ công khai không được phép tiếp tục truy cập.
- Trigger `trg_documents_soft_delete_share` trên MariaDB:
  ```sql
  CREATE TRIGGER `trg_documents_soft_delete_share`
  AFTER UPDATE ON `documents`
  FOR EACH ROW
  BEGIN
    IF NEW.is_deleted = 1 AND OLD.is_deleted = 0 THEN
      UPDATE `shared_links`
      SET `is_revoked` = 1, `revoked_at` = NOW()
      WHERE `document_id` = NEW.id AND `is_revoked` = 0;
    END IF;
  END
  ```
- **Kết quả:** Đảm bảo dữ liệu bị xóa mềm lập tức biến mất khỏi không gian công cộng mà không phụ thuộc vào code backend.
