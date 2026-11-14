# NOTE Phase 2 — Audit và remediation status

## 1. Phạm vi và cách kiểm tra

- Đã rà soát 10 script SQL trong `database-design/06-sql/` (00–09), migration Supabase chia sẻ cũ, 32 ORM models, schemas, API routes, storage helpers và frontend.
- Hai script tạo bảng (`01_create_tables.sql`, `07_full_install.sql`) khai báo đủ 32 bảng và tên cột khớp với 32 bảng ORM. Đây là đối chiếu tĩnh; chưa phải kết quả introspection trên database.
- Frontend có 15 view trong `app.hbs`, cộng trang xác thực và trang public share: **17 module người dùng**. Template có 8 form, 119 nút, 37 input, 10 select, 9 textarea và 173 tên thuộc tính `data-*` duy nhất. Số đếm control này không bao gồm control được tạo động bằng JavaScript.
- Đã rà soát 79 route handlers trên 12 router API. Không phát hiện Alembic hoặc migration runner/version ledger trong backend.

## 2. Database và migration

### Kết nối trực tiếp

- Cấu hình đang trỏ tới endpoint TiDB Cloud tương thích giao thức MySQL trên cổng 4000, database `banhangonline`; đây **không phải MariaDB `note_db`** theo kiến trúc và SQL scripts của NOTE.
- Có thử duy nhất truy vấn nhận diện server trong `START TRANSACTION READ ONLY`; kết nối thất bại với `OperationalError` code `1105`. Không đọc schema, không chạy DDL/DML, không backup và không thay đổi database.
- Môi trường khai báo `DB_SSL_MODE=REQUIRED`, nhưng `Settings` không có trường `DB_SSL_MODE` và SQLAlchemy engine không truyền TLS options. `DB_USERNAME` cũng không phải trường cấu hình; code dùng `DB_USER`.
- Vì chưa kết nối được và target hiện tại không phải database NOTE đã xác nhận, không thể xác minh trực tiếp phiên bản, database thực tế, bảng/cột, index, unique, FK, dữ liệu hiện hữu hoặc lịch sử migration. Không chạy migration 08; script này dùng `USE note_db`, còn cấu hình hiện tại là database khác.

### Kết quả đối chiếu tĩnh

1. **Đã sửa trong source SQL:** `07_full_install.sql` đặt `chk_quizzes_passing_score` vào `quizzes`; `04_constraints.sql` vốn đã gắn constraint đúng bảng.
2. **Đã sửa trong ORM/schema:** `Tag.id` và `DocumentTag.tag_id` dùng kiểu BIGINT UNSIGNED trên MySQL/MariaDB; `TagResponse.id` là integer.
3. **Đã sửa trong ORM:** mặc định `AiTask.status="queued"` khớp enum SQL.
4. **Đã sửa trong ORM:** mặc định `Notification.type="system"` khớp enum SQL.
5. **Đã sửa trong ORM:** `AiConversation.model_name`, `SharedLink.title` và `QuizAttemptAnswer.selected_option_id` hiện NOT NULL như DDL.
6. **Đã đồng bộ trong source:** backend giới hạn độ sâu archive tối đa 20 thư mục; trigger SQL từ chối compression ratio trên 50x. Migration `09_archive_security_migration.sql` được tạo để cập nhật trigger database hiện hữu, nhưng chưa chạy.
7. Chỉ một số quan hệ có composite FK bảo đảm cùng owner; các quan hệ document/folder, note/document/folder và collection item chủ yếu dựa vào kiểm tra quyền trong API. Comment trong SQL mô tả một số composite FK không đúng với định nghĩa FK thực tế.
8. `06_rollback.sql` DROP toàn bộ 32 bảng; đây là script phá hủy dữ liệu, không phải rollback an toàn. `07_full_install.sql` dùng `CREATE TABLE IF NOT EXISTS` nhưng các `ALTER TABLE` thêm FK/index không có cơ chế migration/version/idempotency đầy đủ; không nên chạy lại trên database đã tồn tại.
9. `08_workspace_api_migration.sql` là thay đổi DDL, có thao tác drop/add constraint và không được chạy trong phiên audit này. Chưa có backup vì không thực hiện thay đổi database.

## 3. Kiểm kê frontend/API/database

| Module | Trạng thái | Bằng chứng chính |
|---|---|---|
| Auth | CONNECTED | Login/register/profile gọi FastAPI; session và recovery code được ghi vào DB |
| Dashboard | PARTIAL | Tính từ store/bootstrap; storage và AI query vẫn là số tĩnh; task là local state |
| Library / Documents | PARTIAL | Upload gọi API và lưu thêm file vào IndexedDB; ID đổi sau upload nhưng IndexedDB dùng ID cũ; xóa UI gọi soft-delete, chưa có trash/restore flow |
| Folders | PARTIAL | Tạo có gọi API; rename/delete chỉ sửa local state |
| Collections | LOCAL_ONLY | UI create/delete và item lists chỉ cập nhật store; backend CRUD tồn tại nhưng không được gọi |
| ZIP / 7Z Archives | MOCK | UI ZIP phân tích tại browser; 7Z sinh manifest mẫu; extract chỉ tạo metadata document; download chỉ hiện toast; chưa gọi API archive |
| AI Assistant | PARTIAL | Chat và conversation gọi API; lưu câu trả lời thành note/flashcard chỉ cập nhật local state |
| AI Context | PARTIAL | Save/delete gọi API; dữ liệu mẫu và export/import JSON là local; không có API phục hồi version snapshot |
| Flashcards | LOCAL_ONLY | Tạo/ôn thẻ ở store; API deck/card/review có nhưng UI không gọi |
| Quiz | LOCAL_ONLY | Tạo/làm/nộp quiz ở store; API quiz/submit có nhưng UI không gọi |
| AI Workflows | MOCK | Dữ liệu demo và workflow tạo local; nút chạy chỉ báo chưa có dịch vụ thực thi |
| Sharing Manager | CONNECTED | List/create/update/rotate/revoke gọi FastAPI; token không lưu trong list response |
| Public Share | CONNECTED | Viewer gọi public API, kiểm tra password, expiry, revoke và quyền download |
| Settings | PARTIAL | Hồ sơ và BYOK gọi API; clear-data xóa localStorage; một số profile/preferences còn local |
| Notes | PARTIAL | Tạo gọi API; update/delete/pin/favorite chỉ sửa local; toast thành công xảy ra trước khi biết kết quả backend |
| Knowledge Graph | LOCAL_ONLY | Đồ thị và thao tác chỉ dựa trên note state cục bộ |
| Search / Navigation | LOCAL_ONLY | Tìm kiếm phía browser; không có pagination/server-side query UI |

### Tổng trạng thái 17 module

| CONNECTED | PARTIAL | LOCAL_ONLY | MOCK | MISSING |
|---:|---:|---:|---:|---:|
| 3 | 7 | 5 | 2 | 0 |

`MISSING=0` ở đây chỉ áp dụng cho 17 module/view được kiểm kê; một số thao tác/API con vẫn thiếu như liệt kê bên dưới.

## 4. API thiếu và thao tác chưa đồng bộ

- Không có API thực thi/CRUD cho AI workflows; không có API cho các tasks đang được minh họa trong UI.
- Không có CRUD API cho tags và không có API xóa một item khỏi collection.
- Không có API khôi phục AI Context về version snapshot cũ.
- Notes: update/delete/flag trong UI không gọi API; edit/delete có thể thao tác với ID giả của dữ liệu mẫu.
- Folders: rename/delete không gọi API; create thêm local trước, rồi mới đồng bộ ID bất đồng bộ.
- Collections: UI không gọi API cho create/update/delete/add item.
- Flashcards/Quiz: thao tác tạo, review, submit hiện chỉ ở local state; API tương ứng không được UI sử dụng.
- Archives: upload/inspect/extract/delete/download trên UI không gọi backend; 7Z manifest và các document sau extract là dữ liệu giả.
- Notifications: backend read/read-all API tồn tại nhưng state handler trong store chỉ sửa local.
- Bulk controls trong template không có handler tương ứng; không có pagination controls. Global search, filter tài liệu và notes chạy trên state cục bộ. Export toàn workspace xuất JSON từ browser state, không phải dữ liệu đầy đủ từ DB; không có import toàn workspace.
- Document upload tạo ID tạm, lưu file IndexedDB theo ID đó rồi thay ID bằng server ID; sau đó reader không tìm thấy record cục bộ theo ID mới. UI xóa tài liệu gọi soft-delete thay vì xóa vật lý dù thông báo nói tệp máy chủ bị xóa.

## 5. Bảo mật và nghiệp vụ quan trọng

- **Archive:** Backend kiểm tra Zip Slip, số entry, tổng dung lượng giải nén, compression ratio và độ sâu đường dẫn (tối đa 20 thư mục); selective extraction không thực thi file. Frontend archive không dùng backend guardrails và JSZip nạp ZIP tại browser; 7Z không được inspect thật ở UI.
- **BYOK:** API key được mã hóa AES-GCM; API key dạng rõ không lưu trong localStorage. Custom endpoint được gọi outbound ở backend nhưng chưa có allowlist/guard chống SSRF.
- **Secrets:** `APP_SECRET` và `AI_ENCRYPTION_KEY` có giá trị mặc định cố định trong cấu hình; ứng dụng chưa từ chối khởi động nếu production giữ các giá trị này.
- **Health endpoint:** endpoint unauthenticated trả DB host/name và đường dẫn storage.
- **Browser storage:** access token và workspace state nằm trong localStorage; đây không phải nguồn dữ liệu chính đáng tin cậy cho nghiệp vụ multi-account.
- **Ownership/sharing:** các route chính lọc theo user; share token được hash, có expiry/revoke/password lockout và quyền download. Chưa có rate limit độc lập theo IP.
- **Transactions/storage:** một số upload/extract có cleanup khi commit lỗi; thao tác permanent delete xóa file trước DB commit, nên DB lỗi có thể để metadata trỏ tới file đã mất. Trigger storage SQL cũng lệch mức bảo vệ với backend.

## 6. Kiểm thử baseline

- Backend: **30 passed**; 22 cảnh báo Pydantic deprecation. `pytest` không có sẵn ban đầu, đã cài trong `.venv` để chạy test; không sửa `requirements.txt`.
- Frontend lint: PASS.
- `test:documents`: **10 passed**.
- `test:sharing`: **4 passed**.
- Production build: PASS; có cảnh báo chunk lớn (PDF worker khoảng 1.33 MB, app chunk khoảng 447 KB, PDF chunk khoảng 500 KB).
- MariaDB integration: **chưa chạy**; target hiện tại không đúng MariaDB NOTE và truy vấn nhận diện thất bại.
- Playwright / Edge E2E: **chưa chạy**; workspace không có Playwright package/config hoặc Edge executable phát hiện qua PATH.

## 7. Thay đổi trong lượt audit

- Sửa DDL full-install để constraint điểm đạt quiz thuộc đúng bảng; đồng bộ kiểu ID, defaults và nullability của các ORM fields đã đối chiếu.
- Thêm kiểm tra độ sâu đường dẫn archive (mặc định tối đa 20 thư mục) và test hồi quy; đồng bộ trigger SQL với giới hạn compression ratio 50x.
- Tạo migration `09_archive_security_migration.sql` để thay trigger trên database NOTE hiện hữu. **Migration chưa chạy**, không có backup vì không thực hiện thay đổi database; không có dữ liệu database nào bị sửa.
- Không thay đổi UI/API nghiệp vụ trong lượt này. Bảng kiểm kê 17 module và trạng thái CONNECTED/PARTIAL/LOCAL_ONLY/MOCK/MISSING vẫn là baseline; các mục chưa đồng bộ ở mục 4 chưa được remediation.

## 8. Các phần chưa thể xác minh

- Schema/data/constraints/index/FK thực tế và migration history của MariaDB.
- E2E trên Microsoft Edge và luồng đăng nhập/API với DB thật.
- Tính tương thích/runtime của DDL 08/09 và triggers với server thực tế; cấu hình hiện tại trỏ tới TiDB, không phải MariaDB. Migration 09 chỉ được chạy sau khi xác nhận đúng database và backup.
- Đối soát storage path thực tế và provenance dữ liệu hiện hữu.
