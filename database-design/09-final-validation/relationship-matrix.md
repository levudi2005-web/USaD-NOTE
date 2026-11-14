# MA TRẬN QUAN HỆ CƠ SỞ DỮ LIỆU NOTE (RELATIONSHIP MATRIX)

---

## 1. NGUYÊN TẮC THIẾT KẾ RÀNG BUỘC TOÀN VẸN THAM CHIẾU
1. **Cô lập Đa người dùng (Cross-tenant Isolation via Composite FK):**
   - Khi một bảng con tham chiếu đến một bảng trung gian (ví dụ: `documents` tham chiếu `folders`), ràng buộc khóa ngoại không chỉ kiểm tra `folder_id` mà sử dụng khóa ngoại tổ hợp `(user_id, folder_id) REFERENCES folders(user_id, id)`.
   - Cơ chế này ngăn chặn tuyệt đối lỗi bảo mật ngang (Horizontal Privilege Escalation) ở tầng lưu trữ CSDL MariaDB: Người dùng A không thể gán tài liệu của mình vào thư mục của người dùng B, ngay cả khi API backend gặp lỗi logic.
2. **Quy tắc Hành động Khóa ngoại (Referential Actions):**
   - **`ON DELETE CASCADE`**: Áp dụng cho các quan hệ phụ thuộc hoàn toàn vào thực thể cha. Khi cha bị xóa, toàn bộ con bị dọn sạch (Ví dụ: Xóa `users` -> Xóa toàn bộ `user_recovery_codes`, `user_sessions`, `documents`, `folders`, `ai_connections`, v.v.; Xóa `quizzes` -> Xóa `quiz_questions` -> Xóa `quiz_options`).
   - **`ON DELETE SET NULL`**: Áp dụng cho các quan hệ phân loại tùy chọn (Ví dụ: Xóa thư mục `folders` -> Các tài liệu con trong `documents.folder_id` được chuyển về `NULL` - tức đưa ra thư mục gốc; Xóa `documents` -> `notes.document_id` đặt về `NULL` để giữ lại nội dung ghi chú của người dùng).
   - **`ON DELETE RESTRICT`**: Áp dụng cho danh mục dùng chung (Ví dụ: Không được phép xóa một `ai_models` nếu vẫn đang có `ai_connections` tham chiếu tới).

---

## 2. MA TRẬN 48 LIÊN KẾT KHÓA NGOẠI

| STT | Bảng con (Child Table) | Cột khóa ngoại (FK Columns) | Bảng cha (Parent Table) | Cột khóa chính (PK/UQ Columns) | Loại FK | ON DELETE | ON UPDATE | Ý nghĩa nghiệp vụ |
|---|---|---|---|---|:---:|:---:|:---:|---|
| 1 | user_recovery_codes | user_id | users | id | Single | CASCADE | CASCADE | Mã khôi phục gắn với tài khoản |
| 2 | user_sessions | user_id | users | id | Single | CASCADE | CASCADE | Phiên đăng nhập gắn với tài khoản |
| 3 | folders | user_id | users | id | Single | CASCADE | CASCADE | Thư mục thuộc sở hữu của người dùng |
| 4 | folders | (user_id, parent_id) | folders | (user_id, id) | **Composite** | CASCADE | CASCADE | Thư mục cha - con trong cùng tài khoản |
| 5 | documents | user_id | users | id | Single | CASCADE | CASCADE | Tài liệu thuộc sở hữu của người dùng |
| 6 | documents | (user_id, folder_id) | folders | (user_id, id) | **Composite** | SET NULL | CASCADE | Tài liệu phân loại vào thư mục cùng tài khoản |
| 7 | notes | user_id | users | id | Single | CASCADE | CASCADE | Ghi chú thuộc tài khoản |
| 8 | notes | (user_id, document_id)| documents | (user_id, id) | **Composite** | SET NULL | CASCADE | Ghi chú gắn với tài liệu cùng tài khoản |
| 9 | notes | (user_id, folder_id) | folders | (user_id, id) | **Composite** | SET NULL | CASCADE | Ghi chú phân loại vào thư mục |
| 10 | tags | user_id | users | id | Single | CASCADE | CASCADE | Nhãn tag định nghĩa bởi người dùng |
| 11 | document_tags | document_id | documents | id | Single | CASCADE | CASCADE | Gắn tag vào tài liệu |
| 12 | document_tags | tag_id | tags | id | Single | CASCADE | CASCADE | Gắn tag vào tài liệu |
| 13 | collections | user_id | users | id | Single | CASCADE | CASCADE | Bộ sưu tập của người dùng |
| 14 | collection_items | collection_id | collections | id | Single | CASCADE | CASCADE | Mục trong bộ sưu tập |
| 15 | collection_items | document_id | documents | id | Single | CASCADE | CASCADE | Tài liệu đưa vào bộ sưu tập |
| 16 | collection_items | note_id | notes | id | Single | CASCADE | CASCADE | Ghi chú đưa vào bộ sưu tập |
| 17 | archives | user_id | users | id | Single | CASCADE | CASCADE | Gói nén ZIP/7Z tải lên |
| 18 | archive_extracted_files | archive_id | archives | id | Single | CASCADE | CASCADE | File trích xuất từ gói nén |
| 19 | archive_extracted_files | document_id | documents | id | Single | CASCADE | CASCADE | Tài liệu tạo ra sau giải nén |
| 20 | ai_models | provider_id | ai_providers | id | Single | CASCADE | CASCADE | Model thuộc nhà cung cấp AI |
| 21 | ai_connections | user_id | users | id | Single | CASCADE | CASCADE | Kết nối API Key của người dùng |
| 22 | ai_connections | provider_id | ai_providers | id | Single | RESTRICT| CASCADE | Đơn vị cung cấp AI của kết nối |
| 23 | ai_connections | default_model_id | ai_models | id | Single | SET NULL | CASCADE | Model mặc định cho kết nối |
| 24 | ai_conversations | user_id | users | id | Single | CASCADE | CASCADE | Phiên hội thoại của người dùng |
| 25 | ai_conversations | (user_id, connection_id)| ai_connections| (user_id, id) | **Composite** | SET NULL | CASCADE | Kết nối AI BYOK dùng cho hội thoại |
| 26 | ai_conversations | (user_id, document_id) | documents | (user_id, id) | **Composite** | SET NULL | CASCADE | Tài liệu ngữ cảnh của hội thoại |
| 27 | ai_messages | conversation_id | ai_conversations | id | Single | CASCADE | CASCADE | Tin nhắn trong phiên hội thoại |
| 28 | ai_messages | model_id | ai_models | id | Single | SET NULL | CASCADE | Model AI sinh ra tin nhắn phản hồi |
| 29 | ai_tasks | user_id | users | id | Single | CASCADE | CASCADE | Tác vụ xử lý AI của người dùng |
| 30 | ai_tasks | (user_id, connection_id)| ai_connections| (user_id, id) | **Composite** | SET NULL | CASCADE | Kết nối AI thực thi tác vụ |
| 31 | ai_tasks | (user_id, document_id) | documents | (user_id, id) | **Composite** | SET NULL | CASCADE | Tài liệu nguồn của tác vụ AI |
| 32 | ai_task_logs | task_id | ai_tasks | id | Single | CASCADE | CASCADE | Nhật ký bước thực thi tác vụ AI |
| 33 | ai_contexts | user_id | users | id | Single | CASCADE | CASCADE | AI Context Capsule của người dùng |
| 34 | ai_context_versions | context_id | ai_contexts | id | Single | CASCADE | CASCADE | Phiên bản snapshot của AI Context |
| 35 | flashcard_decks | user_id | users | id | Single | CASCADE | CASCADE | Bộ flashcard của người dùng |
| 36 | flashcard_decks | (user_id, document_id) | documents | (user_id, id) | **Composite** | SET NULL | CASCADE | Bộ flashcard sinh ra từ tài liệu |
| 37 | flashcards | deck_id | flashcard_decks | id | Single | CASCADE | CASCADE | Thẻ ghi nhớ thuộc bộ thẻ |
| 38 | quizzes | user_id | users | id | Single | CASCADE | CASCADE | Bài thi quiz của người dùng |
| 39 | quizzes | (user_id, document_id) | documents | (user_id, id) | **Composite** | SET NULL | CASCADE | Bài quiz sinh ra từ tài liệu |
| 40 | quiz_questions | quiz_id | quizzes | id | Single | CASCADE | CASCADE | Câu hỏi thuộc bài thi quiz |
| 41 | quiz_options | quiz_id | quizzes | id | Single | CASCADE | CASCADE | Đáp án thuộc bài thi quiz (Đồng bộ) |
| 42 | quiz_options | (quiz_id, question_id) | quiz_questions | (quiz_id, id) | **Composite** | CASCADE | CASCADE | Đáp án thuộc câu hỏi tương ứng |
| 43 | quiz_attempts | user_id | users | id | Single | CASCADE | CASCADE | Lượt làm bài của người dùng |
| 44 | quiz_attempts | (user_id, quiz_id) | quizzes | (user_id, id) | **Composite** | CASCADE | CASCADE | Lượt thi làm cho bài quiz của người dùng |
| 45 | quiz_attempt_answers | attempt_id | quiz_attempts | id | Single | CASCADE | CASCADE | Câu trả lời trong lượt thi |
| 46 | quiz_attempt_answers | (question_id, selected_option_id)| quiz_options | (question_id, id)| **Composite** | CASCADE | CASCADE | **Ngăn gian lận nộp nhầm đáp án câu khác** |
| 47 | shared_links | (user_id, document_id) | documents | (user_id, id) | **Composite** | CASCADE | CASCADE | Liên kết chia sẻ gắn chặt tài liệu |
| 48 | share_access_logs | share_id | shared_links | id | Single | CASCADE | CASCADE | Nhật ký truy cập liên kết chia sẻ |
