# BÁO CÁO KIỂM THỬ VÀ XÁC MINH CÚ PHÁP SQL (SQL VERIFICATION & TEST RESULTS)

---

## 1. PHƯƠNG PHÁP VÀ MÔI TRƯỜNG KIỂM THỬ
- **Môi trường:** Python AST Static Parser & Dependency Graph Validator trên hệ thống Windows.
- **Phạm vi kiểm thử:** Bộ 8 tệp SQL trong `database-design/06-sql/`:
  - `00_create_database.sql`
  - `01_create_tables.sql`
  - `02_primary_unique_indexes.sql`
  - `03_foreign_keys.sql`
  - `04_constraints.sql`
  - `05_seed_reference_data.sql`
  - `06_rollback.sql`
  - `07_full_install.sql`

---

## 2. KẾT QUẢ XÁC MINH TĨNH (STATIC ANALYSIS)

### 2.1. Đồ thị Phụ thuộc Tạo bảng (Table Dependency DAG)
Kiểm tra thứ tự khởi tạo 32 bảng trong `01_create_tables.sql`:
- **Nguyên tắc:** Bảng cha không phụ thuộc phải được tạo trước bảng con có khóa ngoại.
- **Kết quả kiểm toán:**
  1. `users`, `ai_providers` (Cấp 0 - Độc lập tuyệt đối) -> Tạo đầu tiên.
  2. `user_recovery_codes`, `user_sessions`, `folders`, `ai_models`, `tags`, `activity_logs`, `notifications` (Cấp 1).
  3. `documents`, `ai_connections` (Cấp 2).
  4. `notes`, `document_tags`, `collections`, `archives`, `ai_conversations`, `ai_tasks`, `ai_contexts`, `flashcard_decks`, `quizzes` (Cấp 3).
  5. `collection_items`, `archive_extracted_files`, `ai_messages`, `ai_task_logs`, `ai_context_versions`, `flashcards`, `quiz_questions`, `quiz_attempts`, `shared_links` (Cấp 4).
  6. `quiz_options` (Cấp 5).
  7. `quiz_attempt_answers`, `share_access_logs` (Cấp 6).
- **Kết luận:** **PASSED (0 chu trình phụ thuộc vòng / Circular Dependency = 0)**.

### 2.2. Kiểm tra Cú pháp MariaDB 10.11+ LTS
- Toàn bộ câu lệnh `CREATE TABLE` đều chỉ định rõ `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`.
- Sử dụng cú pháp `COMMENT` chuẩn mực cho từng cột và từng bảng.
- Định dạng trigger đúng tiêu chuẩn `DELIMITER // ... END // DELIMITER ;`.
- Dữ liệu hạt giống (Seed Data) trong `05_seed_reference_data.sql` sử dụng cú pháp `INSERT IGNORE` bảo đảm tính bất biến (Idempotent), chạy lại nhiều lần không bị lỗi trùng khóa chính.

---

## 3. CÔNG BỐ MINH BẠCH VỀ MÔI TRƯỜNG THỰC TẾ
> [!IMPORTANT]
> **Tuân thủ Nguyên tắc Trung thực Kỹ thuật:**
> Trong môi trường sandbox làm việc hiện tại, máy trạm cục bộ không cài đặt sẵn tiến trình dịch vụ MariaDB Server đang chạy (Không có `mysqld.exe` hoặc Docker daemon).
> Do đó, kết quả kiểm tra trên đây là **Static Syntax & Dependency Validation (Phân tích cú pháp tĩnh và đồ thị phụ thuộc)**. Bộ SQL CHƯA được thực thi trực tiếp trên một instance MariaDB vật lý trong phiên làm việc này.

---

## 4. HƯỚNG DẪN KIỂM THỬ THỰC TẾ TRÊN MÁY CHỦ MARIADB
Người dùng hoặc kỹ sư DevOps có thể thực hiện kiểm thử trực tiếp trên máy chủ MariaDB 10.11+ bằng 1 dòng lệnh duy nhất:

### Cách 1: Sử dụng Script Cài đặt Toàn diện (Khuyến nghị)
```bash
# Mở Terminal tại thư mục chứa file SQL:
cd d:\NOTE\database-design\06-sql

# Chạy tệp cài đặt nguyên khối:
mariadb -u root -p < 07_full_install.sql
```

### Cách 2: Chạy theo từng module riêng lẻ
```bash
mariadb -u root -p < 00_create_database.sql
mariadb -u root -p note_db < 01_create_tables.sql
mariadb -u root -p note_db < 02_primary_unique_indexes.sql
mariadb -u root -p note_db < 03_foreign_keys.sql
mariadb -u root -p note_db < 04_constraints.sql
mariadb -u root -p note_db < 05_seed_reference_data.sql
```

### Cách 3: Kiểm tra tính hoàn nguyên (Rollback Test)
```bash
mariadb -u root -p note_db < 06_rollback.sql
```
