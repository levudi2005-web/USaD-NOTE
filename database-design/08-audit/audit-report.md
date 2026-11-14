# BÁO CÁO TOÀN DIỆN VÒNG AUDIT ĐỘC LẬP CƠ SỞ DỮ LIỆU NOTE (INDEPENDENT DATABASE AUDIT)

---

## 1. MỤC TIÊU VÀ NGUYÊN TẮC AUDIT

- **Mục tiêu:** Thực hiện kiểm toán độc lập, khách quan và chuyên sâu trên toàn bộ thiết kế cơ sở dữ liệu NOTE (gồm MCD, MLD, MPD, Data Dictionary, Backup Plan và 28 bảng đã tạo).
- **Nguyên tắc tuân thủ tuyệt đối:**
  - **Không sinh SQL** trong giai đoạn này.
  - **Không triển khai database** lên bất kỳ môi trường VPS nào.
  - **Không xóa hoặc ghi đè** lên các file thiết kế gốc tại các thư mục `01` đến `07`.
  - Báo cáo minh bạch, phân loại rõ mức độ nghiêm trọng và đưa ra phương án xử lý cụ thể.

---

## 2. MA TRẬN TỔNG HỢP CÁC PHÁT HIỆN KIỂM TOÁN (FINDINGS MATRIX)

Hội đồng thẩm định đã phát hiện **12 vấn đề**, phân bổ theo 4 cấp độ nghiêm trọng:

```
+---------------------------------------------------------------------------------------------------+
|                                 BẢNG TỔNG HỢP CÁC ĐIỂM KIỂM TOÁN                                  |
+----+-----------------------------------------------------+---------------+-------------+----------+
| STT| Nội dung phát hiện                                  | Vị trí        | Phân loại   | Mức độ   |
+----+-----------------------------------------------------+---------------+-------------+----------+
| 01 | Thiếu bảng lưu vết lịch sử trò chuyện AI Assistant  | AI Domain     | Thực thể    | CRITICAL |
|    | (`ai_conversations` & `ai_messages`)                |               |             |          |
+----+-----------------------------------------------------+---------------+-------------+----------+
| 02 | Nguy cơ gán dữ liệu chéo tài khoản qua FK đơn lẻ    | documents,    | Quan hệ &   | CRITICAL |
|    | (Cross-tenant Data Injection)                       | notes, quiz   | Bảo mật     |          |
+----+-----------------------------------------------------+---------------+-------------+----------+
| 03 | Thiếu danh mục chuẩn hóa nhà cung cấp & Model       | AI Domain     | Chuẩn 3NF   | HIGH     |
|    | (`ai_providers` & `ai_models`)                      |               |             |          |
+----+-----------------------------------------------------+---------------+-------------+----------+
| 04 | Bảng `collection_items` dùng đa hình lỏng lẻo       | collections   | Quan hệ     | HIGH     |
|    | (Polymorphic) gây nguy cơ bản ghi mồ côi (Orphans)  |               |             |          |
+----+-----------------------------------------------------+---------------+-------------+----------+
| 05 | Không ràng buộc `selected_option_id` phải thuộc     | quiz_answers  | Quan hệ     | HIGH     |
|    | chính `question_id` đó trong kết quả trắc nghiệm    |               |             |          |
+----+-----------------------------------------------------+---------------+-------------+----------+
| 06 | Xung đột vòng đời: Xóa mềm tài liệu nhưng liên kết  | shared_links  | Nghiệp vụ   | HIGH     |
|    | chia sẻ ngoại vi vẫn hoạt động công khai            | documents     |             |          |
+----+-----------------------------------------------------+---------------+-------------+----------+
| 07 | Thiếu thông số kiểm soát tấn công Zip Bomb          | archives      | ZIP/7Z      | HIGH     |
|    | (`uncompressed_size`, `max_ratio`)                  |               |             |          |
+----+-----------------------------------------------------+---------------+-------------+----------+
| 08 | Thiếu trường `key_version` hỗ trợ xoay vòng khóa    | ai_connections| Bảo mật     | HIGH     |
|    | mã hóa chủ (Master Key Rotation) cho AI BYOK        |               |             |          |
+----+-----------------------------------------------------+---------------+-------------+----------+
| 09 | Thiếu cơ chế khóa chống dò quét (Brute-force) khi   | users         | Bảo mật     | MEDIUM   |
|    | nhập sai Recovery Code nhiều lần liên tiếp          | recovery_codes|             |          |
+----+-----------------------------------------------------+---------------+-------------+----------+
| 10 | File XML PowerDesigner thiếu tọa độ đồ họa Symbols  | 02-mcd, 04-mpd| Công cụ     | MEDIUM   |
|    | (Diagram Sheet có thể bị trống khi mở)              |               |             |          |
+----+-----------------------------------------------------+---------------+-------------+----------+
| 11 | Thiếu cờ thu hồi phiên chủ động (`is_revoked`)      | user_sessions | Bảo mật     | MEDIUM   |
+----+-----------------------------------------------------+---------------+-------------+----------+
| 12 | File XML PDM thiếu nhúng tệp DBMS resource XDB      | 04-mpd        | Công cụ     | LOW      |
+----+-----------------------------------------------------+---------------+-------------+----------+
```

---

## 3. TỔNG HỢP ĐÁNH GIÁ THEO 6 TRỌNG TÂM YÊU CẦU

### 3.1. Về công cụ SAP PowerDesigner
- **Xác nhận thực tế:** SAP PowerDesigner **không được cài đặt** trên máy trạm Windows này.
- **Hạn chế file XML tự tạo:** Các file `.cdm`, `.ldm`, `.pdm` đã sinh có đúng định dạng thẻ XML của Sybase nhưng thiếu các khối tọa độ hiển thị đồ họa (`<c:Symbols>`) do không chạy qua kernel PowerDesigner.
- **Quy trình chuẩn hóa:** Đã cung cấp tài liệu chi tiết quy trình **Reverse Engineering từ DDL SQL** — đây là phương pháp chuẩn 100% mở được đầy đủ sơ đồ trực quan trên mọi phiên bản PowerDesigner mà không gặp lỗi tài nguyên.
- *Chi tiết tại:* [`08-audit/powerdesigner-verification.md`](file:///d:/NOTE/database-design/08-audit/powerdesigner-verification.md).

### 3.2. Về nghiệp vụ AI (BYOK & Assistant)
- **Điểm phát hiện nghiêm trọng:** Giao diện có module Chat Assistant hoàn chỉnh nhưng cơ sở dữ liệu trước đây **hoàn toàn thiếu nơi lưu trữ lịch sử hội thoại** (`ai_conversations` và `ai_messages`).
- **Điểm thiếu chuẩn hóa:** Danh mục nhà cung cấp (`ai_providers`) và thông số model (`ai_models`) bị gộp vào bảng cấu hình API key cá nhân (`ai_connections`).
- **Phương án giải quyết:** Tách thành kiến trúc 3 tầng: Danh mục hệ thống (`ai_providers`, `ai_models`) $\to$ Kết nối người dùng (`ai_connections`) $\to$ Phiên trò chuyện & Tin nhắn (`ai_conversations`, `ai_messages`).
- *Chi tiết tại:* [`08-audit/missing-entities.md`](file:///d:/NOTE/database-design/08-audit/missing-entities.md).

### 3.3. Về toàn vẹn quan hệ & Chống rò rỉ Cross-Tenant
- **Điểm phát hiện nghiêm trọng:** Dùng Single Foreign Key (`folder_id`, `document_id`) không thể ngăn chặn ở tầng database việc User A gán nhầm tài nguyên của User B.
- **Phương án giải quyết:** Bổ sung ràng buộc `UNIQUE (user_id, id)` trên bảng cha và khuyến nghị áp dụng **Composite Foreign Key** (`user_id`, `resource_id`) để MariaDB cưỡng chế cô lập ở cấp độ vật lý.
- **Xử lý quan hệ đa hình:** Chuyển đổi bảng `collection_items` sang 3 khóa ngoại tường minh có ràng buộc `CHECK` loại trừ để triệt tiêu vĩnh viễn rủi ro bản ghi mồ côi (Orphan records).
- *Chi tiết tại:* [`08-audit/relationship-errors.md`](file:///d:/NOTE/database-design/08-audit/relationship-errors.md).

### 3.4. Về bảo mật thông tin
- Cơ chế băm mật khẩu (Argon2id), băm Recovery Code (SHA-256), mã hóa API Key (AES-256-GCM) và băm Share Token (SHA-256) được đánh giá rất tốt.
- Bổ sung cơ chế chống Brute-force Recovery Code (`failed_recovery_attempts`, `recovery_locked_until`).
- Bổ sung trường `key_version` để đảm bảo có thể xoay vòng Master Encryption Key mà không làm hỏng các API Key cũ.
- Xử lý việc dọn dẹp file nhị phân trên đĩa vật lý khi người dùng xóa tài khoản vĩnh viễn (Two-phase Purge Workflow).
- *Chi tiết tại:* [`08-audit/security-review.md`](file:///d:/NOTE/database-design/08-audit/security-review.md).

### 3.5. Về nghiệp vụ ZIP / 7Z
- Bổ sung chỉ số `uncompressed_size` (kích thước sau giải nén) và `max_ratio` vào bảng `archives` để phát hiện và ngăn chặn triệt để tấn công Zip Bomb trước khi tiến hành giải nén ra đĩa.
- Giữ nguyên cấu trúc Manifest JSON phục vụ đọc cây thư mục tức thời mà không cần giải nén.
- Đảm bảo ràng buộc toàn vẹn giữa `archives` và `archive_extracted_files`.

### 3.6. Về khả năng sao lưu và phục hồi
- Đối soát giữa metadata MariaDB và file vật lý: Khuyến nghị bổ sung script kiểm tra chéo định kỳ (Consistency Check Script) giữa cột `storage_path` trong database và các file thực tế trên ổ cứng VPS để phát hiện các tệp mồ côi hoặc tệp bị thiếu.

---

## 4. KẾT LUẬN VÀ KIẾN NGHỊ HÀNH ĐỘNG

1. **Mô hình ban đầu (28 bảng)** là một nền tảng tốt, đã bao quát hầu hết các nghiệp vụ lớn nhưng **chưa thể đưa vào sản xuất ngay** do còn thiếu lịch sử hội thoại AI và một số lỗ hổng ràng buộc toàn vẹn.
2. **Kiến nghị nâng cấp:** Nâng cấp mô hình lên **32 bảng chuẩn hóa** theo đặc tả tại [`08-audit/recommended-changes.md`](file:///d:/NOTE/database-design/08-audit/recommended-changes.md).
3. **Trạng thái hiện tại:**
   - Các file thiết kế gốc tại `01` đến `07` được **giữ nguyên vẹn 100%**.
   - Báo cáo audit đầy đủ đã sẵn sàng trong thư mục `08-audit/`.
   - **Chờ phản hồi và chỉ đạo của người dùng** trước khi tiến hành cập nhật lại mô hình và sinh mã SQL DDL.
