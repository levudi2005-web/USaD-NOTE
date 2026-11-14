# BÁO CÁO ĐÁNH GIÁ BẢO MẬT CƠ SỞ DỮ LIỆU (SECURITY REVIEW)

---

## 1. TỔNG QUAN ĐÁNH GIÁ AN TOÀN THÔNG TIN

Cơ sở dữ liệu của NOTE chứa nhiều thông tin nhạy cảm của người dùng cá nhân (tài liệu nội bộ, ghi chú tri thức, API Key bên thứ ba). Đánh giá bảo mật này rà soát các rủi ro từ tầng vật lý, tầng lược đồ CSDL (Schema) đến tầng giao tiếp ứng dụng.

---

## 2. PHÂN TÍCH RỦI RO BẢO MẬT VÀ PHƯƠNG ÁN KIỂM SOÁT

### 2.1. Cô lập dữ liệu Đa tài khoản (Multi-Tenant Isolation)
- **Đánh giá rủi ro: [HIGH]**
- **Thực trạng:** 100% các bảng đều có cột `user_id`. Tuy nhiên, việc chỉ phụ thuộc vào câu lệnh `WHERE user_id = :user_id` ở tầng ứng dụng tiềm ẩn rủi ro khi lập trình viên quên thêm điều kiện hoặc lỗi logic ORM.
- **Biện pháp tăng cường:**
  - Áp dụng **Composite Foreign Key** (`user_id`, `resource_id`) như đã nêu trong báo cáo `relationship-errors.md`. Khi đó, MariaDB sẽ từ chối ở tầng nhân lưu trữ mọi thao tác liên kết tài nguyên sai người sở hữu.

---

### 2.2. Khôi phục mật khẩu (Recovery Codes)
- **Đánh giá rủi ro: [HIGH]**
- **Thực trạng:**
  - Mã khôi phục được lưu dưới dạng băm một chiều `code_hash = SHA-256(code)` là phương án tốt, chống rò rỉ khi database bị dump.
  - Tuy nhiên, bảng `user_recovery_codes` **chưa có cơ chế đếm số lần thử sai (Rate limiting / Brute-force protection)**.
- **Biện pháp tăng cường:**
  - Bổ sung vào bảng `users`:
    - `failed_recovery_attempts TINYINT UNSIGNED DEFAULT 0`
    - `recovery_locked_until DATETIME DEFAULT NULL`
  - Nếu người dùng nhập sai mã khôi phục 5 lần liên tiếp, tự động khóa chức năng khôi phục trong 60 phút và ghi nhật ký cảnh báo bảo mật vào `activity_logs`.

---

### 2.3. Quản lý Phiên đăng nhập (Session Security)
- **Đánh giá rủi ro: [MEDIUM]**
- **Thực trạng:**
  - Bảng `user_sessions` lưu `session_token_hash = SHA-256(token)`, token thô được truyền qua Cookie `HttpOnly, Secure, SameSite=Strict`.
  - Nhưng hiện tại bảng thiếu cờ thu hồi chủ động (`is_revoked` hoặc `revoked_at`). Khi người dùng bấm "Đăng xuất khỏi tất cả thiết bị khác", hệ thống chỉ có thể dùng lệnh `DELETE`.
- **Biện pháp tăng cường:**
  - Bổ sung cột `is_revoked TINYINT(1) DEFAULT 0` để lưu vết lịch sử phiên bị hủy thay vì xóa cứng ngay, giúp kiểm toán bảo mật và phát hiện dấu hiệu chiếm đoạt phiên (Session Hijacking).

---

### 2.4. Quản lý khóa AI BYOK (API Key Encryption)
- **Đánh giá rủi ro: [HIGH]**
- **Thực trạng:**
  - Khóa API được mã hóa bằng thuật toán đối xứng AES-256-GCM (`encrypted_api_key`, `encryption_iv`, `encryption_tag`). Khóa chủ (Master Key) nằm ở biến môi trường của ứng dụng.
  - Tuy nhiên, thiết kế **thiếu trường phiên bản khóa chủ (`key_version`)**.
- **Hậu quả:** Khi hệ thống cần xoay vòng khóa mã hóa chủ (Master Key Rotation) theo định kỳ bảo mật, các khóa API cũ được mã hóa bằng Version 1 sẽ không thể giải mã được nếu không biết bản ghi nào thuộc phiên bản khóa nào!
- **Biện pháp tăng cường:**
  - Bổ sung vào bảng `ai_connections`:
    `key_version INT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Phiên bản Master Encryption Key dùng để mã hóa'`

---

### 2.5. Bảo mật Liên kết chia sẻ ngoại vi (Shared Links)
- **Đánh giá rủi ro: [MEDIUM]**
- **Thực trạng:**
  - Chuỗi Share Token thô không lưu trong database; chỉ lưu `token_hash = SHA-256(token)`.
  - Mật khẩu liên kết được băm bằng Argon2id.
  - Thiếu giới hạn tần suất nhập mật khẩu liên kết. Kẻ tấn công có thể brute-force mật khẩu của một liên kết công khai.
- **Biện pháp tăng cường:**
  - Bổ sung vào bảng `shared_links`:
    - `failed_pass_attempts INT UNSIGNED DEFAULT 0`
    - `pass_locked_until DATETIME DEFAULT NULL`

---

### 2.6. Xóa vĩnh viễn tài khoản & Tệp nhị phân trên đĩa (Data Purge & Physical Storage Sync)
- **Đánh giá rủi ro: [HIGH]**
- **Thực trạng:**
  - Khi người dùng chọn "Xóa tài khoản vĩnh viễn", lệnh `DELETE FROM users WHERE id = :id` sẽ kích hoạt `ON DELETE CASCADE` dọn dẹp sạch toàn bộ các bảng trong CSDL.
  - Tuy nhiên, **các tệp nhị phân trên ổ đĩa vật lý (`storage_path` của documents và archives) KHÔNG tự động bị xóa bởi MariaDB!**
- **Hậu quả:**
  - Tệp vật lý bị bỏ rơi trên ổ cứng VPS (Orphan Storage Files), vừa lãng phí dung lượng đĩa, vừa vi phạm quy định quyền riêng tư người dùng (quyền được lãng quên - GDPR Right to Erasure).
- **Biện pháp tăng cường:**
  - Thiết kế quy trình xóa 2 pha (Two-phase Purge Workflow):
    1. Khi nhận lệnh xóa tài khoản, ứng dụng truy vấn danh sách toàn bộ `storage_path` của người dùng.
    2. Thực hiện xóa vật lý các tệp trên đĩa lưu trữ.
    3. Cuối cùng mới thực thi lệnh `DELETE FROM users` trong MariaDB Transaction.

---

### 2.7. Phòng vệ Gói nén ZIP/7Z (Zip Bomb & Zip Slip Defense)
- **Đánh giá rủi ro: [HIGH]**
- **Thực trạng:**
  - CSDL cần lưu trữ thông tin kiểm định để tầng ứng dụng chặn đứng tấn công trước khi giải nén.
- **Biện pháp tăng cường:**
  - Cột `uncompressed_size` và `scan_status` phải được kiểm tra cưỡng chế:
    - Nếu `manifest_json` chứa bất kỳ file nào có đường dẫn chứa `../`, `..\` hoặc ký tự tuyệt đối: tự động đánh dấu `scan_status = 'rejected'` và cấm mọi thao tác giải nén.
    - Nếu tỉ lệ nén vượt quá 100 lần (Zip Bomb threshold): từ chối xử lý.
