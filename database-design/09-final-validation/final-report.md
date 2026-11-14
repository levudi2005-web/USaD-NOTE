# BÁO CÁO TỔNG KẾT TOÀN DIỆN THIẾT KẾ CƠ SỞ DỮ LIỆU NOTE (FINAL DATABASE DESIGN REPORT)

---

## 1. THÔNG TIN CHUNG DỰ ÁN
- **Tên dự án:** NOTE — Web Application Quản lý tài liệu, Đọc tài liệu & Học tập thông minh tích hợp AI.
- **Hệ quản trị CSDL mục tiêu:** MariaDB 10.11+ LTS / 11.x
- **Storage Engine:** InnoDB (ACID compliant, Row-level locking)
- **Character Set / Collation:** `utf8mb4` / `utf8mb4_unicode_ci` (Hỗ trợ toàn diện tiếng Việt có dấu, ký tự đặc biệt, toán học LaTeX và Emoji)
- **Kiến trúc cốt lõi:**
  1. **Multi-account:** Mỗi người dùng là một tài khoản độc lập tuyệt đối. Không có Super Admin, không có nhân viên quản trị can thiệp dữ liệu người dùng, không có bảng thành viên nhóm (`workspace_members`).
  2. **AI BYOK (Bring Your Own Key):** Người dùng tự cung cấp API Key. Toàn bộ API Key được mã hóa đối xứng mức độ quân sự AES-256-GCM kèm vector khởi tạo (IV), thẻ xác thực (Auth Tag) và phiên bản khóa (`key_version`). Tuyệt đối không lưu plain-text API key.
  3. **Hybrid Storage:** Tách bạch siêu dữ liệu (Metadata trong CSDL) và tệp nhị phân vật lý (Lưu trữ ngoài thư mục web root, quản lý qua đường dẫn cục bộ hoặc Object Storage).
  4. **External Controlled Sharing:** Chia sẻ tài liệu qua liên kết công khai/riêng tư có mã băm Token SHA-256, tùy chọn mật khẩu bảo vệ (Argon2id), ngày hết hạn, giới hạn lượt xem và nhật ký truy cập (`share_access_logs`). Người nhận không cần tài khoản NOTE.
  5. **ZIP/7Z Selective Extraction:** Quản lý gói nén, lưu cây thư mục manifest JSON, trích xuất chọn lọc, liên kết file trích xuất với gói nén gốc, chống tấn công Zip Bomb và Zip Slip.

---

## 2. QUÁ TRÌNH TIẾN HÓA MÔ HÌNH DỮ LIỆU
Trải qua 3 giai đoạn tinh chỉnh và kiểm định độc lập:
1. **Giai đoạn Thiết kế Sơ bộ (MCD/MLD 26 thực thể):** Xác lập các luồng nghiệp vụ cơ bản về tài khoản, tài liệu, ghi chú, flashcard, quiz và chia sẻ.
2. **Giai đoạn Kiểm định Độc lập (Audit Report 28 bảng):** Phát hiện các lỗ hổng về quan hệ đa hình lỏng lẻo trong `collection_items`, nguy cơ mồ côi dữ liệu khi nộp đáp án quiz, và thiếu bảng lưu trữ lịch sử hội thoại AI.
3. **Giai đoạn Hoàn thiện Sản xuất (Production Target 32 bảng):**
   - Bổ sung `ai_providers` và `ai_models` tạo thành danh mục tham chiếu chuẩn hóa 3NF cho AI BYOK.
   - Bổ sung `ai_conversations` và `ai_messages` lưu vết toàn bộ phiên trao đổi, số token tiêu thụ, model sử dụng và trích dẫn nguồn.
   - Chuẩn hóa Khóa ngoại Tổ hợp (Composite Foreign Keys) để cô lập dữ liệu người dùng ở tầng lưu trữ MariaDB.

---

## 3. BẢNG THỐNG KÊ CHỈ SỐ TOÀN DIỆN (DATABASE METRICS)

| Chỉ số | Giá trị | Ghi chú |
|---|:---:|---|
| **Tổng số bảng (Tables)** | **32** | Chuẩn hóa 3NF/BCNF, phân bổ thành 11 phân hệ nghiệp vụ |
| **Tổng số cột (Columns)** | **243** | Đầy đủ định dạng, mô tả COMMENT tiếng Việt chi tiết |
| **Tổng số Khóa ngoại (Foreign Keys)** | **48** | Toàn vẹn tham chiếu 100%, bảo đảm không phát sinh bản ghi mồ côi |
| **Khóa ngoại tổ hợp (Composite FKs)** | **14** | Enforce cô lập đa người dùng (Cross-tenant Isolation) |
| **Chỉ mục B-Tree (Indexes)** | **86** | Tối ưu hóa truy vấn lọc, sắp xếp, phân trang theo user_id |
| **Chỉ mục Toàn văn (Full-Text Indexes)** | **3** | Tìm kiếm nội dung tài liệu, ghi chú, tin nhắn AI |
| **Trigger tự động (Triggers)** | **4** | Tự động hóa đồng bộ hạn mức lưu trữ, tỷ lệ nén và thu hồi liên kết chia sẻ |
| **Dữ liệu hạt giống chuẩn (Seed Providers & Models)** | **6 / 15** | Danh mục nhà cung cấp (OpenAI, Google Gemini, Anthropic, Groq, DeepSeek, OpenRouter) và model phổ biến |

---

## 4. DANH MỤC TÀI NGUYÊN BÀN GIAO (DELIVERABLES INVENTORY)

```
d:\NOTE\database-design\
├── 01-analysis/
│   ├── entity-list.md                 # Đặc tả chi tiết 32 thực thể nghiệp vụ
│   ├── business-rules.md              # 85+ quy tắc nghiệp vụ hệ thống
│   └── normalization-proof.md         # Chứng minh chuẩn hóa 1NF -> 2NF -> 3NF/BCNF
├── 02-mcd/
│   ├── NOTE-MCD.cdm                   # Mô hình Khái niệm SAP PowerDesigner XML
│   └── NOTE-MCD.md                    # Bản vẽ ASCII, danh sách Association & Cardinality Merise
├── 03-mld/
│   ├── NOTE-MLD.ldm                   # Mô hình Logic SAP PowerDesigner XML
│   └── NOTE-MLD.md                    # Lược đồ quan hệ quan hệ, khóa chính, khóa ngoại
├── 04-mpd/
│   ├── NOTE-MPD.pdm                   # Mô hình Vật lý SAP PowerDesigner XML (MariaDB)
│   └── NOTE-MPD.md                    # Đặc tả vật lý, kiểu dữ liệu, storage engine, trigger
├── 05-data-dictionary/
│   ├── data-dictionary.csv            # Từ điển dữ liệu toàn diện 32 bảng, 243 cột
│   └── relationships.csv              # Danh mục 48 liên kết khóa ngoại chi tiết
├── 06-sql/
│   ├── 00_create_database.sql         # Tạo database utf8mb4_unicode_ci, thiết lập timezone UTC
│   ├── 01_create_tables.sql           # DDL tạo 32 bảng theo thứ tự quan hệ phụ thuộc nghiêm ngặt
│   ├── 02_primary_unique_indexes.sql   # Thiết lập chỉ mục B-Tree và Full-Text Search
│   ├── 03_foreign_keys.sql            # Khai báo 48 ràng buộc khóa ngoại (đơn và tổ hợp)
│   ├── 04_constraints.sql             # Ràng buộc CHECK và 4 Trigger tự động
│   ├── 05_seed_reference_data.sql     # Seed danh mục chuẩn 6 AI Providers & 15 AI Models
│   ├── 06_rollback.sql                # Kịch bản hủy sạch CSDL theo thứ tự ngược lại an toàn
│   └── 07_full_install.sql            # Script cài đặt nguyên khối trọn gói 1-Click & Reverse Engineering
├── 08-audit/
│   ├── audit-report.md                # Báo cáo kiểm định độc lập
│   ├── missing-entities.md            # Phân tích các thực thể còn thiếu
│   ├── relationship-errors.md         # Phân tích và khắc phục lỗi quan hệ
│   ├── security-review.md             # Đánh giá bảo mật, chống xâm nhập chéo
│   ├── recommended-changes.md         # Đề xuất lộ trình nâng cấp 28 -> 32 bảng
│   └── powerdesigner-verification.md  # Xác minh tính tương thích PowerDesigner
└── 09-final-validation/
    ├── final-report.md                # Báo cáo tổng kết dự án (File hiện tại)
    ├── table-inventory.md             # Danh bạ chi tiết 32 bảng vật lý
    ├── relationship-matrix.md         # Ma trận 48 quan hệ và hành vi liên kết
    ├── foreign-key-audit.md           # Kiểm toán chi tiết tính toàn vẹn khóa ngoại
    ├── security-audit.md              # Báo cáo kiểm định an ninh & cô lập dữ liệu
    ├── sql-test-results.md            # Báo cáo thẩm tra cú pháp và kịch bản thực thi SQL
    ├── powerdesigner-import-guide.md  # Hướng dẫn Reverse Engineering vào PowerDesigner
    └── known-limitations.md           # Minh bạch ranh giới môi trường và định hướng mở rộng
```

---

## 5. KẾT LUẬN & KHUYẾN NGHỊ TRIỂN KHAI
Bộ thiết kế cơ sở dữ liệu NOTE phiên bản 32 bảng là giải pháp hoàn chỉnh, chuẩn mực, đạt tiêu chuẩn khắt khe về an toàn dữ liệu, tính mở rộng và khả năng bảo trì. Bộ SQL DDL sẵn sàng được áp dụng trực tiếp cho các framework backend (NestJS/TypeORM, Node.js/Prisma, Go/GORM, Python/SQLAlchemy hoặc Spring Boot) mà không cần cấu trúc lại dữ liệu.
