# THIẾT KẾ CƠ SỞ DỮ LIỆU HỆ THỐNG NOTE (SAP POWERDESIGNER & MARIADB)

---

## 1. GIỚI THIỆU TỔNG QUAN

Thư mục này chứa toàn bộ tài liệu và mô hình thiết kế cơ sở dữ liệu hoàn chỉnh cho hệ thống **NOTE** — Nền tảng quản lý tài liệu, đọc tài liệu và hỗ trợ học tập cá nhân tích hợp Trí tuệ Nhân tạo (AI BYOK).

Toàn bộ quy trình thiết kế được thực hiện tuần tự, chặt chẽ theo phương pháp luận mô hình hóa Merise và tiêu chuẩn thiết kế cơ sở dữ liệu chuyên nghiệp:
1. **Khảo sát & Phân tích nghiệp vụ (Analysis)**
2. **Mô hình Khái niệm Dữ liệu — MCD (Conceptual Data Model)**
3. **Mô hình Logic Dữ liệu — MLD (Logical Data Model)**
4. **Mô hình Vật lý Dữ liệu — MPD (Physical Data Model cho MariaDB)**
5. **Kiểm định mô hình (Validation & Rules Check)**
6. **Chiến lược Sao lưu & Phục hồi trên VPS (Disaster Recovery)**

---

## 2. CẤU TRÚC THƯ MỤC BÀN GIAO

```
database-design/
├── 01-analysis/
│   ├── business-requirements.md       # Phân tích chi tiết 9 phân hệ nghiệp vụ & ràng buộc
│   ├── entity-list.md                 # Đặc tả 28 thực thể, vai trò, thuộc tính & mối quan hệ
│   └── design-decisions.md            # Báo cáo các quyết định kiến trúc: Multi-tenant, BYOK, Hybrid Storage
├── 02-mcd/
│   ├── NOTE-MCD.cdm                   # File mô hình Conceptual Data Model chuẩn SAP PowerDesigner XML
│   └── NOTE-MCD.md                    # Tài liệu đặc tả MCD, bảng Cardinality & sơ đồ Mermaid ERD
├── 03-mld/
│   ├── NOTE-MLD.ldm                   # File mô hình Logical Data Model chuẩn SAP PowerDesigner XML
│   └── NOTE-MLD.md                    # Quy tắc chuyển đổi Merise, cấu trúc quan hệ & chứng minh chuẩn 3NF
├── 04-mpd/
│   ├── NOTE-MPD.pdm                   # File mô hình Physical Data Model cho MariaDB (SAP PowerDesigner XML)
│   └── NOTE-MPD.md                    # Đặc tả vật lý 28 bảng MariaDB InnoDB, kiểu dữ liệu, PK/FK/INDEX
├── 05-data-dictionary/
│   ├── data-dictionary.csv            # Từ điển dữ liệu toàn diện (UTF-8 BOM, tương thích Microsoft Excel)
│   └── relationships.csv              # Danh bạ 40 mối quan hệ Foreign Key & quy tắc ON DELETE/UPDATE
├── 06-sql/                            # SQL MariaDB
│   ├── 00-05_*.sql                    # Các phần schema rời để tham khảo/phát triển
│   ├── 06_rollback.sql                # XÓA schema; không dùng khi cài đặt
│   ├── 07_full_install.sql            # File duy nhất để cài database mới/trống
│   ├── 08_workspace_api_migration.sql # Migration cho database NOTE đã tồn tại
│   └── 09_archive_security_migration.sql
├── 07-documentation/
│   ├── database-architecture.md       # Sơ đồ kiến trúc tổng thể, luồng dữ liệu & tối ưu MariaDB trên VPS
│   ├── backup-restore-plan.md         # Kế hoạch sao lưu Lean 3-2-1, bash script, cronjob & quy trình khôi phục
│   └── validation-report.md           # Báo cáo thẩm định 11 tiêu chí vàng của Database Architect
└── README.md                          # Tài liệu hướng dẫn tổng quan và thao tác với PowerDesigner
```

Để cài NOTE mới trên VPS MariaDB, chỉ chuyển `06-sql/07_full_install.sql` và
chạy lệnh import trong file đó. File này đã gồm schema hiện tại và dữ liệu danh
mục; không chạy trên database đã có dữ liệu. `08`/`09` chỉ dành cho database
NOTE hiện hữu sau khi xác minh và backup. `frontend/supabase/migrations` là SQL
PostgreSQL riêng, không dùng với MariaDB.

---

## 3. HƯỚNG DẪN MỞ VÀ LÀM VIỆC VỚI SAP POWERDESIGNER

### Cách 1: Mở trực tiếp các file mô hình đã tạo sẵn
1. Khởi động **SAP PowerDesigner** (phiên bản 15.x, 16.5 hoặc 16.7).
2. Vào menu: `File` -> `Open...`.
3. Trỏ đến các file tương ứng trong thư mục `database-design/`:
   - Để xem Mô hình Khái niệm (MCD): chọn `02-mcd/NOTE-MCD.cdm`.
   - Để xem Mô hình Logic (MLD): chọn `03-mld/NOTE-MLD.ldm`.
   - Để xem Mô hình Vật lý (MPD): chọn `04-mpd/NOTE-MPD.pdm`.
4. PowerDesigner sẽ tự động đọc cấu trúc XML, dựng lại toàn bộ Entities, Attributes, Tables, Columns, Primary Keys, Foreign Keys và Relationships.

### Cách 2: Tự động chuyển đổi giữa các mô hình trong PowerDesigner (Forward Engineering)
- Nếu mở `NOTE-MCD.cdm`, bạn có thể dùng tính năng tích hợp sẵn của PowerDesigner:
  - `Tools` -> `Generate Logical Data Model...` để sinh ra mô hình MLD.
  - `Tools` -> `Generate Physical Data Model...` (chọn DBMS: `MySQL 5.0` hoặc `MariaDB`) để sinh ra mô hình MPD.

### Cách 3: Nhập ngược từ DDL SQL (Reverse Engineering)
1. Trong PowerDesigner, chọn `File` -> `Reverse Engineer` -> `Database...`.
2. Đặt tên Model (ví dụ: `NOTE-MPD`), chọn DBMS là `MySQL 5.0 / MariaDB`.
3. Chọn tùy chọn `Using script files` -> Trỏ đến file DDL SQL -> Nhấn `OK` để PowerDesigner tự động vẽ sơ đồ trực quan.

---

## 4. TÓM TẮT ĐẶC TẢ KỸ THUẬT CỐT LÕI

| Tiêu chí | Đặc tả kỹ thuật NOTE |
|---|---|
| **Hệ quản trị CSDL** | MariaDB 10.6+ / 11.x (Storage Engine: **InnoDB**) |
| **Bảng mã ký tự** | **`utf8mb4`** với Collation: **`utf8mb4_unicode_ci`** |
| **Số lượng bảng** | **28 bảng quan hệ chuẩn hóa 3NF** (hoặc 22 bảng ở phương án rút gọn) |
| **Bảo mật đa tài khoản** | Mỗi tài khoản thuộc 1 người dùng; cô lập 100% bằng `user_id` ở mọi bảng |
| **Bảo mật AI BYOK** | Mã hóa đối xứng **AES-256-GCM** với IV và Auth Tag; hiển thị bằng mặt nạ (`api_key_masked`) |
| **Lưu trữ tệp** | **Hybrid Storage**: Metadata trong MariaDB; Tệp nhị phân trên đĩa lưu trữ an toàn |
| **Chia sẻ ngoài** | Không lưu Token thô; chỉ lưu mã băm **SHA-256** (`token_hash`); hỗ trợ mật khẩu và thời hạn |
| **Mô hình Backup** | **Lean 3-2-1**: Backup cục bộ hàng ngày + Đẩy tự động ra ngoài VPS (Rclone) |
| **RPO / RTO** | RPO <= 24 giờ; RTO <= 2 giờ khi gặp sự cố VPS |
