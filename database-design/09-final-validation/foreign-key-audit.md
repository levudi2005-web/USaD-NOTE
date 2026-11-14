# KIỂM TOÁN CHI TIẾT KHÓA NGOẠI (FOREIGN KEY AUDIT REPORT)

---

## 1. MỤC TIÊU KIỂM TOÁN
1. Khảo sát 100% các cặp bảng cha - con có quan hệ tham chiếu trong hệ thống NOTE.
2. Kiểm tra tính tương thích tuyệt đối giữa kiểu dữ liệu của Cột khóa ngoại (Foreign Key Column) và Cột được tham chiếu (Referenced Column).
3. Đảm bảo toàn bộ các cột được tham chiếu đều có chỉ mục duy nhất (`PRIMARY KEY` hoặc `UNIQUE KEY`) tương ứng trên bảng cha.
4. Đánh giá tính chặt chẽ của các Khóa ngoại Tổ hợp (Composite Foreign Keys) để bảo vệ đa người dùng và chống sai lệch dữ liệu.

---

## 2. KẾT QUẢ KIỂM TOÁN TƯƠNG THÍCH KIỂU DỮ LIỆU VÀ CHỈ MỤC

### 2.1. Nhóm Khóa chính UUID v4 (CHAR(36))
- Mọi quan hệ giữa thực thể nghiệp vụ chính (`users`, `folders`, `documents`, `collections`, `archives`, `ai_connections`, `quizzes`, `flashcard_decks`, `shared_links`) đều sử dụng `CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci` đồng nhất cho cả bên tham chiếu và bên được tham chiếu.
- **Kết luận:** **100% MATCH**, không có hiện tượng ép kiểu ngầm (Implicit Type Casting), cho phép MariaDB tận dụng tối đa Index Lookup.

### 2.2. Nhóm Khóa chính Số tự tăng (BIGINT UNSIGNED)
- Các quan hệ con kỹ thuật (`ai_task_logs -> ai_tasks`, `quiz_attempt_answers -> quiz_attempts`, `share_access_logs -> shared_links`, `archive_extracted_files -> archives`) đều sử dụng `BIGINT UNSIGNED` đồng nhất giữa PK và FK.
- **Kết luận:** **100% MATCH**.

### 2.3. Kiểm toán Chỉ mục Đón đầu cho Khóa ngoại Tổ hợp (Composite Unique Index Audit)
MariaDB yêu cầu: Khi bảng con tạo Khóa ngoại tổ hợp `(col_a, col_b) REFERENCES parent(col_a, col_b)`, bảng cha BẮT BUỘC phải có một ràng buộc `UNIQUE` hoặc `PRIMARY KEY` bao trùm đúng thứ tự hai cột đó.
Dưới đây là bảng đối soát chi tiết trên 32 bảng đã tạo trong `01_create_tables.sql`:

```
+--------------------------+-----------------------+---------------------------------------+-------------+
| Bảng cha (Parent)        | Cột được tham chiếu   | Ràng buộc duy nhất trên bảng cha      | Trạng thái  |
+--------------------------+-----------------------+---------------------------------------+-------------+
| folders                  | (user_id, id)         | UNIQUE KEY `uq_folders_user_id_id`    | HỢP LỆ (OK) |
| documents                | (user_id, id)         | UNIQUE KEY `uq_documents_user_id_id`  | HỢP LỆ (OK) |
| ai_connections           | (user_id, id)         | UNIQUE KEY `uq_aiconn_user_id_id`     | HỢP LỆ (OK) |
| quizzes                  | (user_id, id)         | UNIQUE KEY `uq_quizzes_user_id_id`    | HỢP LỆ (OK) |
| quiz_questions           | (quiz_id, id)         | UNIQUE KEY `uq_quiz_q_quiz_id_id`     | HỢP LỆ (OK) |
| quiz_options             | (question_id, id)     | UNIQUE KEY `uq_quiz_opt_q_id_id`      | HỢP LỆ (OK) |
+--------------------------+-----------------------+---------------------------------------+-------------+
```

---

## 3. KIỂM TOÁN TÌNH HUỐNG NGHIỆP VỤ ĐẶC THÙ

### 3.1. Ngăn chặn gian lận nộp nhầm đáp án trong Quiz
- **Rủi ro ban đầu (Mô hình 28 bảng):** Bảng `quiz_attempt_answers` chỉ có `question_id` và `selected_option_id` độc lập. Kẻ tấn công hoặc lỗi client có thể gửi `question_id` của Câu hỏi 1 nhưng `selected_option_id` lại là ID đáp án của Câu hỏi 10.
- **Giải pháp kiểm toán triệt để (Mô hình 32 bảng):**
  - Khởi tạo `UNIQUE KEY uq_quiz_opt_q_id_id (question_id, id)` trên bảng `quiz_options`.
  - Khai báo Khóa ngoại tổ hợp trên `quiz_attempt_answers`:
    ```sql
    CONSTRAINT `fk_qans_question_option` FOREIGN KEY (`question_id`, `selected_option_id`)
      REFERENCES `quiz_options` (`question_id`, `id`) ON DELETE CASCADE ON UPDATE CASCADE
    ```
  - **Kết quả:** MariaDB tự động từ chối bất kỳ giao dịch nào nộp một `selected_option_id` không thực sự thuộc về `question_id` đó.

### 3.2. Ngăn chặn rò rỉ phân loại tài liệu chéo tài khoản (Cross-Tenant Folder Leakage)
- **Rủi ro ban đầu:** `documents.folder_id` chỉ tham chiếu `folders.id`. Một người dùng độc hại có thể cập nhật `folder_id` của mình trỏ đến thư mục của người dùng khác nếu đoán được ID.
- **Giải pháp kiểm toán triệt để:**
  - Khai báo Khóa ngoại tổ hợp:
    ```sql
    CONSTRAINT `fk_documents_user_folder` FOREIGN KEY (`user_id`, `folder_id`)
      REFERENCES `folders` (`user_id`, `id`) ON DELETE SET NULL ON UPDATE CASCADE
    ```
  - **Kết quả:** Không bao giờ xảy ra tình trạng tài liệu của User A nằm trong thư mục của User B.
