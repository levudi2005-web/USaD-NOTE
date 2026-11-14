# MINH BẠCH GIỚI HẠN MÔI TRƯỜNG & ĐỊNH HƯỚNG TƯƠNG LAI (KNOWN LIMITATIONS & FUTURE WORK)

---

## 1. CÔNG BỐ MINH BẠCH VỀ GIỚI HẠN MÔI TRƯỜNG PHÁT TRIỂN
Tuân thủ nghiêm ngặt nguyên tắc trung thực nghề nghiệp và quy tắc không báo cáo sai sự thật:

1. **Về Phần mềm SAP PowerDesigner:**
   - Trong môi trường container sandbox hiện tại, không có tệp nhị phân thực thi `PowerDesigner.exe` (SAP PowerDesigner là phần mềm thương mại độc quyền chạy trên giao diện đồ họa Windows Desktop).
   - Các tệp `.cdm`, `.ldm`, `.pdm` được sinh ra dưới định dạng cấu trúc XML chuẩn của Sybase/SAP PowerDesigner. Người dùng cần mở các tệp này trên máy trạm Windows có cài đặt PowerDesigner Desktop theo hướng dẫn tại `powerdesigner-import-guide.md`.

2. **Về Tiến trình Dịch vụ MariaDB:**
   - Môi trường sandbox không chứa dịch vụ nền `mariadb-server` hoặc `mysqld` đang chạy cục bộ.
   - Toàn bộ mã nguồn SQL DDL đã được thẩm tra toàn diện qua AST Parser tĩnh, kiểm tra phụ thuộc chu trình (DAG) và kiểm toán kiểu dữ liệu. Script cài đặt `07_full_install.sql` đã sẵn sàng để thực thi trên mọi phiên bản MariaDB 10.11+ LTS thực tế.

---

## 2. NHỮNG ĐIỂM CẦN LƯU Ý KHI MỞ RỘNG QUY MÔ HỆ THỐNG (SCALING & FUTURE ENHANCEMENTS)

Mặc dù thiết kế 32 bảng hiện tại đã hoàn toàn đáp ứng môi trường sản xuất ở quy mô vừa và lớn (hàng triệu bản ghi), khi hệ thống đạt quy mô siêu lớn (Hyper-scale SaaS), đội ngũ kỹ thuật nên cân nhắc các giải pháp tối ưu hóa sau:

### 2.1. Phân vùng Bảng Dữ liệu Lịch sử (Partitioning)
- Hai bảng có tốc độ ghi dồn dập (High-frequency Append-only) là:
  - `activity_logs` (Nhật ký hành động người dùng)
  - `ai_messages` (Chi tiết tin nhắn trao đổi với AI)
- **Định hướng mở rộng:** Khi dung lượng vượt 10 triệu dòng, nên áp dụng **Range Partitioning theo `created_at`** (theo từng tháng hoặc quý) để tối ưu hóa truy vấn dọn dẹp dữ liệu cũ (Pruning / Dropping old partitions) mà không khóa bảng.

### 2.2. Chuyển đổi Lưu trữ File Nhị phân sang S3-Compatible Object Storage
- Trong thiết kế hiện tại, `documents.file_path` và `archives.file_path` lưu đường dẫn tập tin vật lý trên ổ cứng máy chủ (Local File System).
- **Định hướng mở rộng:** Khi triển khai đa máy chủ (Multi-instance Web Cluster), cần chuyển cấu hình đường dẫn này sang lưu trữ Bucket Key của các dịch vụ Object Storage chuẩn S3 (Cloudflare R2, MinIO, AWS S3, Google Cloud Storage) để đảm bảo Stateless Backend.

### 2.3. Mã hóa API Key với KMS (Key Management Service)
- Hiện tại, khóa giải mã hệ thống (Master Encryption Key) được nạp qua biến môi trường của ứng dụng.
- **Định hướng mở rộng:** Khi đạt tiêu chuẩn tuân thủ bảo mật khắt khe (SOC 2, ISO 27001), có thể tích hợp trực tiếp cơ chế giải mã envelope với AWS KMS, Google Cloud KMS hoặc HashiCorp Vault.
