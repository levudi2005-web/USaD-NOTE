# BÁO CÁO KIỂM ĐỊNH VÀ ĐÁNH GIÁ MÔ HÌNH DỮ LIỆU (VALIDATION REPORT)

---

## 1. MỤC ĐÍCH KIỂM ĐỊNH

Báo cáo này tổng hợp kết quả thẩm định toàn diện mô hình cơ sở dữ liệu hệ thống NOTE qua 3 cấp độ: Khái niệm (MCD), Logic (MLD) và Vật lý (MPD) trên MariaDB, bảo đảm đáp ứng 100% các nguyên tắc thiết kế khắt khe và các quy tắc nghiệp vụ đã thống nhất.

---

## 2. CHECKLIST KIỂM ĐỊNH CHI TIẾT (11 TIÊU CHÍ VÀNG)

### Tiêu chí 1: 100% Bảng có Khóa chính (Primary Key)
- **Kiểm tra:** Duyệt qua toàn bộ 28 bảng trong hệ thống.
- **Kết quả: ĐẠT (PASS)**
- **Chi tiết:**
  - 14 bảng thực thể độc lập sử dụng `CHAR(36)` (UUID v4) làm PK.
  - 13 bảng nhật ký, phần tử con và bảng liên kết sử dụng `BIGINT UNSIGNED AUTO_INCREMENT` làm PK.
  - 1 bảng kết hợp N-N thuần túy (`document_tags`) sử dụng Khóa chính tổng hợp `PRIMARY KEY (document_id, tag_id)`.
  - Không có bất kỳ bảng nào thiếu khóa chính.

### Tiêu chí 2: Khóa ngoại (Foreign Key) trỏ đúng cột PK / UNIQUE
- **Kiểm tra:** Rà soát tất cả 40 ràng buộc Foreign Key.
- **Kết quả: ĐẠT (PASS)**
- **Chi tiết:**
  - Tất cả các FK trỏ về `users(id)` đều trỏ chính xác đến PK kiểu `CHAR(36)`.
  - FK `document_id` trỏ đúng `documents(id)` (`CHAR(36)`).
  - FK `folder_id` trỏ đúng `folders(id)` (`CHAR(36)`).
  - FK `archive_id` trỏ đúng `archives(id)` (`CHAR(36)`).
  - FK `quiz_id` trỏ đúng `quizzes(id)` (`CHAR(36)`).
  - FK `question_id` trỏ đúng `quiz_questions(id)` (`CHAR(36)`).
  - FK `selected_option_id` trỏ đúng `quiz_options(id)` (`CHAR(36)`).
  - FK `attempt_id` trỏ đúng `quiz_attempts(id)` (`CHAR(36)`).
  - FK `shared_link_id` trỏ đúng `shared_links(id)` (`CHAR(36)`).

### Tiêu chí 3: Tương thích kiểu dữ liệu giữa PK và FK
- **Kiểm tra:** So sánh kiểu dữ liệu vật lý giữa cột khóa ngoại và cột tham chiếu.
- **Kết quả: ĐẠT (PASS)**
- **Chi tiết:**
  - Cặp PK/FK UUID: Cùng kiểu `CHAR(36)` chuẩn xác, cùng charset `utf8mb4` và collation `utf8mb4_unicode_ci`.
  - Cặp PK/FK số: `BIGINT UNSIGNED` trỏ chính xác đến `BIGINT UNSIGNED`.

### Tiêu chí 4: Xử lý triệt để quan hệ Nhiều - Nhiều (N-N)
- **Kiểm tra:** Kiểm tra các mối quan hệ đa chiều trong bài toán.
- **Kết quả: ĐẠT (PASS)**
- **Chi tiết:**
  - Quan hệ giữa `DOCUMENT` và `TAG`: Đã phân rã thành bảng kết hợp `document_tags` với PK tổ hợp `(document_id, tag_id)`.
  - Quan hệ giữa `COLLECTION` và các tài nguyên đa dạng: Đã phân rã thành bảng liên kết `collection_items` với cặp định danh `(item_type, item_id)` kèm chỉ mục bảo đảm toàn vẹn.
  - Quan hệ giải nén giữa `ARCHIVE` và `DOCUMENT`: Đã phân rã thành bảng liên kết trích xuất `archive_extracted_files` kèm đường dẫn con `inner_path`.

### Tiêu chí 5: Không có bảng mồ côi (No Orphan Tables)
- **Kiểm tra:** Duyệt cây quan hệ đồ thị (Graph Traversal).
- **Kết quả: ĐẠT (PASS)**
- **Chi tiết:**
  - Tất cả 28 bảng đều có ít nhất một đường dẫn quan hệ trực tiếp hoặc gián tiếp dẫn về `users(id)`.
  - Đồ thị quan hệ liên thông hoàn toàn, không có bảng cô lập.

### Tiêu chí 6: Kiểm soát vòng phụ thuộc (Cyclical Dependency)
- **Kiểm tra:** Phát hiện chu trình phụ thuộc có thể gây deadlock hoặc lỗi khi xóa/tạo bảng.
- **Kết quả: ĐẠT (PASS)**
- **Chi tiết:**
  - Bảng `folders` có quan hệ đệ quy (`parent_id` trỏ về `folders.id`), được cấu hình `ON DELETE CASCADE` tự nhiên.
  - Không có chu trình phụ thuộc chéo nguy hiểm dạng A -> B -> C -> A. Thứ tự tạo bảng và thứ tự xóa bảng (Drop order) hoàn toàn tuyến tính.

### Tiêu chí 7: Quy tắc toàn vẹn khi Xóa (ON DELETE Rules)
- **Kiểm tra:** Phân tích rủi ro mất mát dữ liệu ngoài ý muốn khi xóa đối tượng cha.
- **Kết quả: ĐẠT (PASS)**
- **Chi tiết:**
  - Khi xóa `User`: Toàn bộ dữ liệu con liên quan được cấu hình `ON DELETE CASCADE` dọn dẹp sạch sẽ (bảo vệ quyền riêng tư cá nhân theo chuẩn GDPR).
  - Khi xóa `Folder`: Các tài liệu bên trong được giữ an toàn bằng `ON DELETE SET NULL` (đưa tài liệu về thư mục gốc thay vì xóa mất tài liệu quan trọng của người dùng).
  - Khi xóa `Document`: Các ghi chú (`notes`), bộ thẻ (`flashcard_decks`), bài quiz (`quizzes`) gắn kèm tài liệu được cấu hình `ON DELETE SET NULL`, bảo đảm ghi chú và kiến thức học tập vẫn được giữ nguyên vẹn.
  - Khi xóa `Archive`: Bảng liên kết `archive_extracted_files` bị xóa (`CASCADE`), nhưng tài liệu đã đưa vào thư viện vẫn tồn tại độc lập.

### Tiêu chí 8: Nguy cơ truy cập chéo dữ liệu người dùng (Cross-Tenant Leakage)
- **Kiểm tra:** Tính cô lập dữ liệu giữa các tài khoản cá nhân.
- **Kết quả: ĐẠT (PASS)**
- **Chi tiết:**
  - 100% các bảng nghiệp vụ chính đều chứa trường `user_id`.
  - Không chia sẻ không gian chung, không có tài khoản quản trị chung.
  - Tầng ứng dụng áp dụng quy tắc lọc bắt buộc `WHERE user_id = :current_user_id` trên mọi câu lệnh.

### Tiêu chí 9: Bảo vệ thông tin nhạy cảm (Sensitive Data Protection)
- **Kiểm tra:** Mật khẩu, Recovery Code, API Key, Share Token.
- **Kết quả: ĐẠT (PASS)**
- **Chi tiết:**
  - **Mật khẩu người dùng:** Băm bằng Argon2id/Bcrypt (`password_hash`), không bao giờ lưu mật khẩu gốc.
  - **Recovery Code:** Băm một chiều bằng SHA-256 (`code_hash`), dùng 1 lần hủy ngay (`used_at IS NOT NULL`).
  - **AI API Key:** Mã hóa đối xứng AES-256-GCM (`encrypted_api_key`, `encryption_iv`, `encryption_tag`), khóa giải mã nằm ở biến môi trường server; CSDL chỉ lưu mặt nạ (`api_key_masked`) phục vụ hiển thị.
  - **Share Token:** CSDL chỉ lưu mã băm SHA-256 (`token_hash`), token thô chỉ xuất hiện trên URL của người nhận.

### Tiêu chí 10: Chỉ mục hiệu năng (Performance Indexing)
- **Kiểm tra:** Đáp ứng các truy vấn tần suất cao trong thực tế.
- **Kết quả: ĐẠT (PASS)**
- **Chi tiết:**
  - Các cột khóa ngoại đều được đánh B-Tree Index tự động hoặc tường minh.
  - Chỉ mục tổ hợp tối ưu hóa: `idx_documents_user_deleted(user_id, deleted_at, created_at DESC)` giúp tải danh sách tài liệu đang hoạt động tức thì.
  - Chỉ mục Full-text `ft_documents_content(name, extracted_text)` và `ft_notes_text(title, content)` hỗ trợ tìm kiếm toàn văn tiếng Việt tốc độ cao.
  - Chỉ mục duy nhất `uq_users_email`, `uq_sessions_token_hash`, `uq_shared_links_token` tăng tốc độ xác thực tức thì (O(1)).

### Tiêu chí 11: Chuẩn hóa 3NF và hạn chế lạm dụng JSON
- **Kiểm tra:** Tách bạch dữ liệu quan hệ và dữ liệu bán cấu trúc.
- **Kết quả: ĐẠT (PASS)**
- **Chi tiết:**
  - Không lạm dụng JSON cho các quan hệ cần ràng buộc khóa ngoại (như danh sách đáp án trắc nghiệm, câu trả lời thi, thẻ phân loại).
  - Chỉ sử dụng cột kiểu `JSON / LONGTEXT` cho dữ liệu bán cấu trúc có kích thước biến động hoặc mang tính lưu trữ snapshot lịch sử (`manifest_json`, `knowledge_points_json`, `snapshot_json`).

---

## 3. KẾT LUẬN THẨM ĐỊNH

Mô hình dữ liệu NOTE đáp ứng trọn vẹn và hoàn hảo mọi yêu cầu kỹ thuật, không có lỗi cấu trúc, không có quan hệ mồ côi, bảo mật nhiều lớp và sẵn sàng 100% để chuyển giao cũng như sinh mã SQL DDL triển khai thực tế.
