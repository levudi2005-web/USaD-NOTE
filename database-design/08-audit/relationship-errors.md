# BÁO CÁO KIỂM TOÁN LỖI QUAN HỆ & RÀNG BUỘC TOÀN VẸN (RELATIONSHIP AUDIT)

---

## 1. TỔNG QUAN CÁC RỦI RO TOÀN VẸN VÀ LIÊN KẾT DỮ LIỆU

Mô hình hiện tại gồm 40 quan hệ Foreign Key. Tuy nhiên, qua quá trình kiểm tra độc lập từ góc độ bảo mật đa tài khoản (Multi-tenant) và tính đúng đắn quan hệ, phát hiện **5 lỗi và lỗ hổng kiến trúc tiềm ẩn** có thể dẫn đến **rò rỉ dữ liệu chéo giữa các người dùng** hoặc **phát sinh bản ghi rác (orphan records)**.

---

## 2. PHÂN TÍCH CHI TIẾT TỪNG LỖI QUAN HỆ

### [CRITICAL] Lỗi 1: Nguy cơ gán dữ liệu chéo tài khoản (Cross-Tenant Association) qua Khóa ngoại đơn
- **Vị trí bảng:**
  - `documents.folder_id` $\to$ `folders.id`
  - `notes.folder_id` $\to$ `folders.id` và `notes.document_id` $\to$ `documents.id`
  - `flashcard_decks.document_id` $\to$ `documents.id`
  - `quizzes.document_id` $\to$ `documents.id`
  - `ai_tasks.source_document_id` $\to$ `documents.id`
- **Nguyên nhân:**
  - Cả bảng cha (`folders`, `documents`) và bảng con (`documents`, `notes`, `quizzes`) đều mang trường `user_id`.
  - Tuy nhiên, ràng buộc Foreign Key hiện tại chỉ là **Khóa ngoại đơn lẻ 1 cột**: `FOREIGN KEY (folder_id) REFERENCES folders(id)`.
  - Ràng buộc này chỉ đảm bảo `folder_id` tồn tại trong bảng `folders`, nhưng **hoàn toàn không thể ngăn chặn việc User A gán tài liệu của mình vào thư mục của User B** ở tầng database!
- **Hậu quả:**
  - Nếu tầng Backend xuất hiện lỗi lập trình (bug) hoặc bị tấn công tham số ID (IDOR - Insecure Direct Object Reference), dữ liệu của User A sẽ bị trộn lẫn vào không gian của User B.
- **Phương án khắc phục chuẩn kiến trúc:**
  - Tạo chỉ mục duy nhất tổ hợp tại bảng cha:
    - Bảng `folders`: `UNIQUE KEY uq_folders_user_id (user_id, id)`
    - Bảng `documents`: `UNIQUE KEY uq_documents_user_id (user_id, id)`
  - Sử dụng **Khóa ngoại tổ hợp 2 cột (Composite Foreign Key)** ở bảng con:
    ```sql
    ALTER TABLE documents
      ADD CONSTRAINT fk_documents_folder_composite
      FOREIGN KEY (user_id, folder_id) REFERENCES folders(user_id, id)
      ON DELETE SET NULL ON UPDATE CASCADE;
    ```
  - Khi đó, MariaDB sẽ cưỡng chế ở cấp độ vật lý: `documents.user_id` **bắt buộc phải bằng** `folders.user_id`. Không có bất kỳ lỗi code nào có thể vượt qua được lớp phòng thủ này!

---

### [HIGH] Lỗi 2: Bảng `collection_items` dùng quan hệ đa hình lỏng lẻo gây bản ghi mồ côi (Orphan Records)
- **Vị trí bảng:** `collection_items(collection_id, item_type, item_id)`.
- **Nguyên nhân:**
  - Thiết kế trước dùng cặp `(item_type, item_id)` mang tính chất "Polymorphic Relationship".
  - MariaDB **không hỗ trợ Foreign Key có điều kiện** (Conditional FK). Do đó, `item_id` chỉ là cột VARCHAR thông thường, không có bất kỳ ràng buộc khóa ngoại nào trỏ đến `documents(id)`, `notes(id)` hay `flashcard_decks(id)`.
- **Hậu quả:**
  - Khi một tài liệu, ghi chú hoặc bộ thẻ bị xóa vĩnh viễn (`DELETE`), dòng tương ứng trong `collection_items` **vẫn tồn tại nguyên vẹn** (trở thành bản ghi mồ côi). Khi người dùng mở bộ sưu tập, giao diện sẽ bị lỗi hoặc cố gắng tải đối tượng đã không còn tồn tại.
- **Phương án khắc phục chuẩn 3NF:**
  - Thay thế cột `item_type` và `item_id` trừu tượng bằng 3 cột khóa ngoại tường minh có `ON DELETE CASCADE`:
    ```sql
    CREATE TABLE collection_items (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      collection_id CHAR(36) NOT NULL,
      document_id CHAR(36) DEFAULT NULL,
      note_id CHAR(36) DEFAULT NULL,
      deck_id CHAR(36) DEFAULT NULL,
      added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      CONSTRAINT chk_collection_item_exclusive CHECK (
        (document_id IS NOT NULL) + (note_id IS NOT NULL) + (deck_id IS NOT NULL) = 1
      ),
      CONSTRAINT fk_coll_document FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      CONSTRAINT fk_coll_note FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
      CONSTRAINT fk_coll_deck FOREIGN KEY (deck_id) REFERENCES flashcard_decks(id) ON DELETE CASCADE
    );
    ```
  - Khi tài liệu bị xóa, CSDL tự động xóa nó khỏi bộ sưu tập một cách tuyệt đối an toàn và nhất quán.

---

### [HIGH] Lỗi 3: Không đảm bảo tính đồng bộ giữa `question_id` và `selected_option_id` trong `quiz_attempt_answers`
- **Vị trí bảng:** `quiz_attempt_answers(attempt_id, question_id, selected_option_id)`.
- **Nguyên nhân:**
  - `question_id` trỏ đến `quiz_questions(id)`.
  - `selected_option_id` trỏ đến `quiz_options(id)`.
  - Nhưng CSDL không có ràng buộc nào ép buộc rằng `selected_option_id` **phải là một đáp án của chính `question_id` đó**!
- **Hậu quả:**
  - Người dùng có thể gửi đáp án của Câu hỏi số 5 gán cho Câu hỏi số 1. Dữ liệu bài thi bị sai lệch, logic chấm điểm tự động có thể tính sai điểm số.
- **Phương án khắc phục:**
  - Thêm ràng buộc tổ hợp trên bảng `quiz_options`:
    `UNIQUE KEY uq_options_question_id (question_id, id)`
  - Đổi khóa ngoại trên `quiz_attempt_answers` thành:
    `FOREIGN KEY (question_id, selected_option_id) REFERENCES quiz_options(question_id, id) ON DELETE CASCADE`.

---

### [HIGH] Lỗi 4: Xung đột vòng đời giữa Xóa mềm Tài liệu và Liên kết chia sẻ đang hoạt động
- **Vị trí bảng:** `documents.deleted_at` vs `shared_links.is_revoked`.
- **Nguyên nhân:**
  - Khi người dùng xóa tài liệu vào thùng rác (`documents.deleted_at = NOW()`), bảng `shared_links` không nhận được bất kỳ tín hiệu nào, cờ `is_revoked` vẫn là `FALSE`.
- **Hậu quả:**
  - Người ngoài có link chia sẻ vẫn có thể xem và tải tài liệu mà chủ sở hữu tưởng rằng mình đã xóa vào thùng rác! Đây là một lỗ hổng nghiêm trọng về quyền riêng tư.
- **Phương án khắc phục:**
  - Thiết lập quy tắc tầng ứng dụng và Database Trigger: Khi `documents.deleted_at IS NOT NULL`, mọi liên kết chia sẻ của tài liệu đó tự động bị vô hiệu hóa hoặc truy vấn xác thực share link bắt buộc phải JOIN với `documents` và kiểm tra điều kiện `documents.deleted_at IS NULL`.

---

### [MEDIUM] Lỗi 5: Ràng buộc Unique trên `archive_extracted_files` cản trở việc giải nén lại
- **Vị trí bảng:** `archive_extracted_files` có `UNIQUE KEY uq_arch_extract_path (archive_id, inner_path)`.
- **Nguyên nhân:**
  - Khóa này giả định một file trong gói nén chỉ được giải nén đúng 1 lần duy nhất.
- **Hậu quả:**
  - Nếu người dùng trích xuất `chuong_1.pdf`, sau đó họ vô tình chỉnh sửa hỏng hoặc xóa file đó trong thư viện tài liệu, họ quay lại màn hình ZIP Manager để bấm "Giải nén lại file này" thì hệ thống sẽ báo lỗi trùng khóa `Duplicate entry`!
- **Phương án khắc phục:**
  - Khi tài liệu bị xóa vĩnh viễn khỏi thư viện, nhờ có `ON DELETE CASCADE` từ `documents(id)`, dòng liên kết trong `archive_extracted_files` sẽ tự động bị xóa, cho phép người dùng giải nén lại file đó từ archive gốc một cách thuận tiện.
