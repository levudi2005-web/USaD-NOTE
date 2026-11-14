# TÀI LIỆU KIẾN TRÚC CƠ SỞ DỮ LIỆU NOTE (DATABASE ARCHITECTURE)

---

## 1. TỔNG QUAN KIẾN TRÚC VÀ CÁC THÀNH PHẦN

Cơ sở dữ liệu hệ thống NOTE được thiết kế theo mô hình **Đa tầng bảo mật (Defense in Depth)**, kết hợp giữa hệ quản trị cơ sở dữ liệu quan hệ **MariaDB** và hệ thống lưu trữ tệp **Hybrid Storage**:

```
+-----------------------------------------------------------------------------------------+
|                                    NOTE CLIENT / BROWSER                                |
+-----------------------------------------------------------------------------------------+
                                             |
                                             | HTTPS / TLS 1.3
                                             v
+-----------------------------------------------------------------------------------------+
|                                 APPLICATION BACKEND SERVER                              |
|  - Multi-account Isolation Middleware (WHERE user_id = :current_user)                   |
|  - Crypto Engine: AES-256-GCM for API Keys, Argon2id for Passwords, SHA-256 for Tokens   |
|  - Zip Security Guard: Path Traversal Check, Bomb Ratio Limit, Manifest Parser          |
+-----------------------------------------------------------------------------------------+
                    |                                                    |
     SQL Connection | (InnoDB)                            File I/O Stream| (Local Disk / S3)
                    v                                                    v
+---------------------------------------+       +-----------------------------------------+
|          MARIADB 10.6+ DATABASE       |       |          SECURE FILE STORAGE            |
|  - 28 Tables (3NF Normalized)         |       |  - Stored outside Web Root              |
|  - Character Set: utf8mb4             |       |  - Named by UUID / Hash                 |
|  - Collation: utf8mb4_unicode_ci      |       |  - Direct Path Access Denied            |
|  - Foreign Key Constraints with ACID  |       |  - Checked against sha256_checksum      |
+---------------------------------------+       +-----------------------------------------+
```

---

## 2. PHÂN BỔ DỮ LIỆU THEO TỪNG VÙNG LƯU TRỮ

| Thành phần dữ liệu | Nơi lưu trữ vật lý | Giải pháp kỹ thuật & Bảo mật |
|---|---|---|
| **Thông tin tài khoản & Phiên** | MariaDB (`users`, `user_sessions`, `user_recovery_codes`) | Mật khẩu băm Argon2id; Session Token băm SHA-256. |
| **Tài liệu nhị phân (PDF, DOCX, ZIP...)** | File Storage (`/var/data/note-storage`) | Lưu ngoài web root, đặt tên theo UUID v4, kiểm soát truy cập qua backend stream. |
| **Metadata tài liệu & Toàn văn** | MariaDB (`documents`, `folders`, `tags`, `document_tags`) | Quản lý đường dẫn tương đối, dung lượng, SHA-256, chỉ mục FULLTEXT trên văn bản trích xuất. |
| **Gói nén ZIP/7Z & Manifest** | MariaDB (`archives`, `archive_extracted_files`) + Storage | File nén gốc trên Storage; cấu trúc cây thư mục JSON trong `manifest_json`; liên kết file trích xuất trong MariaDB. |
| **Khóa AI BYOK** | MariaDB (`ai_connections`) | Mã hóa đối xứng AES-256-GCM với IV và Auth Tag độc lập cho từng bản ghi; chỉ hiển thị chuỗi làm mờ (masked). |
| **Quy trình AI & Lịch sử chạy** | MariaDB (`ai_tasks`, `ai_task_logs`) | Quản lý trạng thái tiến trình, số token tiêu thụ, liên kết tài liệu nguồn. |
| **AI Context Capsule** | MariaDB (`ai_contexts`, `ai_context_versions`) | Tách bảng snapshot lịch sử, lưu phiên bản schema độc lập với phiên bản nội dung. |
| **Flashcard & Trắc nghiệm Quiz** | MariaDB (`flashcard_decks`, `flashcards`, `quizzes`, `quiz_questions`, `quiz_options`, `quiz_attempts`, `quiz_attempt_answers`) | Chuẩn hóa 3NF trọn vẹn, không dùng JSON để lưu đáp án, bảo đảm tính toàn vẹn khóa ngoại. |
| **Liên kết chia sẻ ngoài** | MariaDB (`shared_links`, `share_access_logs`) | Chỉ lưu `token_hash` (SHA-256), mật khẩu liên kết băm Argon2id, cờ thu hồi tức thì và thời hạn tự hủy. |
| **Vận hành & Giám sát** | MariaDB (`activity_logs`, `notifications`) | Bảng nhật ký append-only, tự động xóa bản ghi cũ sau 90 ngày. |

---

## 3. KHUYẾN NGHỊ CẤU HÌNH TỐI ƯU MARIADB CHO VPS TẦNG THẤP (2GB - 4GB RAM)

Khi vận hành trên VPS với cấu hình tiết kiệm (2 vCPU, 2GB đến 4GB RAM), cấu hình file `/etc/mysql/mariadb.conf.d/50-server.cnf` như sau:

```ini
[mysqld]
# 1. Cơ bản và Bộ ký tự
default_storage_engine          = InnoDB
character_set_server            = utf8mb4
collation_server                = utf8mb4_unicode_ci

# 2. Bộ nhớ đệm InnoDB (Dành 50% - 60% tổng RAM của VPS)
# Nếu VPS 2GB RAM: đặt 1024M; nếu VPS 4GB RAM: đặt 2048M
innodb_buffer_pool_size         = 1024M
innodb_buffer_pool_instances     = 1
innodb_log_file_size            = 128M
innodb_log_buffer_size          = 16M

# 3. Cân bằng Tốc độ ghi và Độ bền an toàn dữ liệu
# Giá trị 2 giúp tăng tốc ghi đĩa đáng kể, chỉ mất tối đa 1s giao dịch nếu OS sập nguồn
innodb_flush_log_at_trx_commit  = 2
innodb_flush_method             = O_DIRECT

# 4. Giới hạn kết nối và luồng xử lý
max_connections                 = 50
connect_timeout                 = 10
wait_timeout                    = 60
interactive_timeout             = 60

# 5. Bộ nhớ đệm truy vấn tạm thời
tmp_table_size                  = 32M
max_heap_table_size             = 32M
table_open_cache                = 400
```
