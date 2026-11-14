# DANH BẠ CHI TIẾT 32 BẢNG CƠ SỞ DỮ LIỆU NOTE (TABLE INVENTORY)

---

## 1. PHÂN BỔ BẢNG THEO PHÂN HỆ NGHIỆP VỤ

```
+-------------------------------------------------------------------------------------------------------+
|                                    DANH BẠ 32 BẢNG DỮ LIỆU NOTE                                       |
+-----+-------------------------+----------------------+--------------------+-------+-------------------+
| STT | Tên bảng                | Phân hệ              | Khóa chính (PK)    | Số cột| Storage Engine    |
+-----+-------------------------+----------------------+--------------------+-------+-------------------+
| 1   | users                   | 1. Tài khoản         | CHAR(36) UUID v4   | 15    | InnoDB            |
| 2   | user_recovery_codes     | 1. Tài khoản         | BIGINT UNSIGNED    | 5     | InnoDB            |
| 3   | user_sessions           | 1. Tài khoản         | CHAR(36) UUID v4   | 8     | InnoDB            |
| 4   | folders                 | 2. Tài liệu & Kho    | CHAR(36) UUID v4   | 8     | InnoDB            |
| 5   | documents               | 2. Tài liệu & Kho    | CHAR(36) UUID v4   | 18    | InnoDB            |
| 6   | notes                   | 2. Tài liệu & Kho    | CHAR(36) UUID v4   | 9     | InnoDB            |
| 7   | tags                    | 2. Tài liệu & Kho    | CHAR(36) UUID v4   | 5     | InnoDB            |
| 8   | document_tags           | 2. Tài liệu & Kho    | Composite (Doc,Tag)| 3     | InnoDB            |
| 9   | collections             | 2. Tài liệu & Kho    | CHAR(36) UUID v4   | 8     | InnoDB            |
| 10  | collection_items        | 2. Tài liệu & Kho    | BIGINT UNSIGNED    | 6     | InnoDB            |
| 11  | archives                | 3. Gói nén ZIP/7Z    | CHAR(36) UUID v4   | 13    | InnoDB            |
| 12  | archive_extracted_files | 3. Gói nén ZIP/7Z    | BIGINT UNSIGNED    | 6     | InnoDB            |
| 13  | ai_providers            | 4. AI Danh mục       | CHAR(36) UUID v4   | 7     | InnoDB            |
| 14  | ai_models               | 4. AI Danh mục       | CHAR(36) UUID v4   | 11    | InnoDB            |
| 15  | ai_connections          | 4. AI BYOK           | CHAR(36) UUID v4   | 12    | InnoDB            |
| 16  | ai_conversations        | 5. AI Chat           | CHAR(36) UUID v4   | 8     | InnoDB            |
| 17  | ai_messages             | 5. AI Chat           | CHAR(36) UUID v4   | 10    | InnoDB            |
| 18  | ai_tasks                | 6. AI Tự động hóa    | CHAR(36) UUID v4   | 13    | InnoDB            |
| 19  | ai_task_logs            | 6. AI Tự động hóa    | BIGINT UNSIGNED    | 6     | InnoDB            |
| 20  | ai_contexts             | 7. AI Context        | CHAR(36) UUID v4   | 10    | InnoDB            |
| 21  | ai_context_versions     | 7. AI Context        | BIGINT UNSIGNED    | 8     | InnoDB            |
| 22  | flashcard_decks         | 8. Flashcards        | CHAR(36) UUID v4   | 8     | InnoDB            |
| 23  | flashcards              | 8. Flashcards        | CHAR(36) UUID v4   | 9     | InnoDB            |
| 24  | quizzes                 | 9. Quiz              | CHAR(36) UUID v4   | 10    | InnoDB            |
| 25  | quiz_questions          | 9. Quiz              | CHAR(36) UUID v4   | 8     | InnoDB            |
| 26  | quiz_options            | 9. Quiz              | CHAR(36) UUID v4   | 6     | InnoDB            |
| 27  | quiz_attempts           | 9. Quiz              | CHAR(36) UUID v4   | 9     | InnoDB            |
| 28  | quiz_attempt_answers    | 9. Quiz              | BIGINT UNSIGNED    | 7     | InnoDB            |
| 29  | shared_links            | 10. Chia sẻ ngoại vi | CHAR(36) UUID v4   | 15    | InnoDB            |
| 30  | share_access_logs       | 10. Chia sẻ ngoại vi | BIGINT UNSIGNED    | 6     | InnoDB            |
| 31  | activity_logs           | 11. Vận hành         | BIGINT UNSIGNED    | 9     | InnoDB            |
| 32  | notifications           | 11. Vận hành         | CHAR(36) UUID v4   | 8     | InnoDB            |
+-----+-------------------------+----------------------+--------------------+-------+-------------------+
```

---

## 2. CHI TIẾT TỪNG NHÓM BẢNG

### Nhóm 1: Tài khoản & Xác thực (Account Domain)
1. **`users`**
   - **Mục đích:** Quản lý tài khoản người dùng, băm mật khẩu, hạn mức lưu trữ, chống tấn công brute-force khôi phục mật khẩu.
   - **Cột đặc thù:** `failed_recovery_attempts` (INT), `recovery_locked_until` (DATETIME), `storage_used`, `storage_limit`.
2. **`user_recovery_codes`**
   - **Mục đích:** Danh sách mã khôi phục một lần khi mất mật khẩu. Mã lưu dạng băm SHA-256 (`code_hash`).
3. **`user_sessions`**
   - **Mục đích:** Quản lý phiên làm việc trên các thiết bị. Hỗ trợ thu hồi phiên đăng nhập từ xa qua cờ `is_revoked`.

### Nhóm 2: Tài liệu & Lưu trữ (Document & Storage Domain)
4. **`folders`**
   - **Mục đích:** Phân cấp cây thư mục quản lý tài liệu. Hỗ trợ đệ quy cha-con (`parent_id`) trong cùng một `user_id`.
5. **`documents`**
   - **Mục đích:** Siêu dữ liệu tài liệu upload. Lưu trữ SHA-256 checksum, MIME type, kích thước byte, cờ `is_starred`, `is_archived`, `is_deleted` (xóa mềm).
6. **`notes`**
   - **Mục đích:** Ghi chú cá nhân độc lập hoặc gắn kèm tài liệu đang đọc. Hỗ trợ định dạng Markdown/HTML.
7. **`tags`**
   - **Mục đích:** Từ khóa phân loại do người dùng định nghĩa, đảm bảo tên tag duy nhất theo từng tài khoản (`uq_tags_user_name`).
8. **`document_tags`**
   - **Mục đích:** Bảng liên kết nhiều-nhiều (N:N) giữa tài liệu và nhãn tag.
9. **`collections`**
   - **Mục đích:** Bộ sưu tập tài liệu theo chủ đề học tập/làm việc.
10. **`collection_items`**
    - **Mục đích:** Phần tử thuộc bộ sưu tập. Sử dụng các cột khóa ngoại tường minh (`document_id`, `note_id`) kèm ràng buộc CHECK thay cho liên kết đa hình lỏng lẻo.

### Nhóm 3: Quản lý ZIP/7Z (Archive Domain)
11. **`archives`**
    - **Mục đích:** Quản lý gói nén tải lên. Lưu `manifest_json` (cấu trúc cây file), kích thước nén, kích thước giải nén (`uncompressed_size`), tỷ lệ nén (`compression_ratio`) và tỷ lệ nén tối đa cho phép (`max_ratio = 50.0`) nhằm chống Zip Bomb.
12. **`archive_extracted_files`**
    - **Mục đích:** Theo dõi lịch sử giải nén chọn lọc, liên kết file tài liệu trích xuất (`document_id`) với gói nén gốc (`archive_id`).

### Nhóm 4: AI BYOK & Danh mục (AI BYOK Domain)
13. **`ai_providers`**
    - **Mục đích:** Danh mục các đơn vị cung cấp mô hình AI (Google Gemini, OpenAI, Anthropic, Groq, DeepSeek, OpenRouter, Custom).
14. **`ai_models`**
    - **Mục đích:** Danh mục các mô hình AI cụ thể, lưu ngữ cảnh tối đa (`context_window`), hỗ trợ hình ảnh/multimodal (`supports_vision`), hỗ trợ streaming.
15. **`ai_connections`**
    - **Mục đích:** Cấu hình API Key của người dùng (BYOK). Lưu khóa mã hóa AES-256-GCM (`api_key_encrypted`, `api_key_iv`, `api_key_tag`, `key_version`), trạng thái kết nối (`is_active`, `last_tested_at`).

### Nhóm 5: AI Assistant & Lịch sử Hội thoại (AI Chat Domain)
16. **`ai_conversations`**
    - **Mục đích:** Phiên trò chuyện giữa người dùng và AI Assistant, có thể gắn ngữ cảnh tài liệu đang đọc (`document_id`).
17. **`ai_messages`**
    - **Mục đích:** Chi tiết từng lượt tin nhắn (user / assistant / system), lưu số token tiêu thụ, model thực thi và trích dẫn tham chiếu (`references_json`).

### Nhóm 6: Quy trình Tác vụ AI (AI Tasks Domain)
18. **`ai_tasks`**
    - **Mục đích:** Tác vụ xử lý tài liệu nền (Tóm tắt, Giải thích khái niệm, Tạo Quiz, Trích xuất thực thể). Quản lý trạng thái (`pending`, `processing`, `completed`, `failed`).
19. **`ai_task_logs`**
    - **Mục đích:** Nhật ký từng bước xử lý tác vụ AI (Execution trace), hỗ trợ theo dõi tiến độ và xử lý sự cố.

### Nhóm 7: AI Context Capsule (AI Context Domain)
20. **`ai_contexts`**
    - **Mục đích:** Ngữ cảnh nén JSON lưu trữ tri thức trích xuất để đưa vào prompt cho LLM.
21. **`ai_context_versions`**
    - **Mục đích:** Lịch sử phiên bản snapshot của Context Capsule, hỗ trợ rollback, merge và kiểm tra tính hợp lệ JSON Schema.

### Nhóm 8: Flashcards (Flashcard Domain)
22. **`flashcard_decks`**
    - **Mục đích:** Bộ thẻ ghi nhớ học tập, có thể sinh ra từ tài liệu (`document_id`).
23. **`flashcards`**
    - **Mục đích:** Từng thẻ ghi nhớ (mặt trước / mặt sau), theo dõi tiến độ lặp lại ngắt quãng (Spaced Repetition: `box_level`, `next_review_at`).

### Nhóm 9: Quiz & Trắc nghiệm (Quiz Domain)
24. **`quizzes`**
    - **Mục đích:** Đề thi trắc nghiệm ôn tập kiến thức.
25. **`quiz_questions`**
    - **Mục đích:** Câu hỏi trong bài quiz (Trắc nghiệm 1 đáp án, nhiều đáp án, đúng/sai).
26. **`quiz_options`**
    - **Mục đích:** Các đáp án lựa chọn cho từng câu hỏi, cờ `is_correct` xác định đáp án đúng.
27. **`quiz_attempts`**
    - **Mục đích:** Lượt làm bài thi của người dùng, lưu điểm số, tỷ lệ phần trăm và thời gian hoàn thành.
28. **`quiz_attempt_answers`**
    - **Mục đích:** Câu trả lời chi tiết của người dùng trong lượt thi. Sử dụng khóa ngoại tổ hợp `(question_id, selected_option_id)` để ngăn chặn gian lận nộp nhầm đáp án của câu hỏi khác.

### Nhóm 10: Chia sẻ Ngoại vi (Sharing Domain)
29. **`shared_links`**
    - **Mục đích:** Liên kết chia sẻ tài liệu ra ngoài. Bảo vệ bằng mã băm Token SHA-256, mật khẩu Argon2id, khóa bảo vệ sau 5 lần nhập sai (`failed_pass_attempts`, `pass_locked_until`), hạn dùng và trạng thái thu hồi (`is_revoked`).
30. **`share_access_logs`**
    - **Mục đích:** Nhật ký lượt truy cập liên kết chia sẻ từ công chúng (IP, User-Agent, thời điểm).

### Nhóm 11: Vận hành & Giám sát (Operations Domain)
31. **`activity_logs`**
    - **Mục đích:** Nhật ký kiểm toán bảo mật toàn bộ hành vi người dùng (đăng nhập, upload, đổi mật khẩu, cấu hình API Key).
32. **`notifications`**
    - **Mục đích:** Thông báo hệ thống gửi đến người dùng (Hoàn thành tác vụ AI, cảnh báo dung lượng, cảnh báo đăng nhập bất thường).
