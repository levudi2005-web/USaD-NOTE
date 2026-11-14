# NOTE Phase 2.1 — HTTP 502 và MariaDB

## Trạng thái

**Chưa thể xác nhận hoàn tất.** Đã xử lý cấu hình, phản hồi lỗi và kiểm thử ở mức unit/build; chưa có MariaDB thực để xác minh schema, chạy migration hoặc kiểm thử API end-to-end.

## 1. Kết quả truy vết HTTP 502

### Sơ đồ kiến thức

- Nút “Xem trên bản đồ kiến thức” trong `notes.js` chỉ chuyển sang view `graph`; `graph.js` đọc `getState().notes` và dựng SVG ngay trên frontend.
- View graph **không gọi endpoint HTTP riêng**, không có request payload hay query parameters nào phát sinh khi mở view.
- Khi đăng nhập, request backend liên quan được gọi khi khởi tạo ứng dụng:

  | Thuộc tính | Giá trị |
  |---|---|
  | Method | `GET` |
  | URL | `/api/v1/sync/bootstrap` |
  | Query/body | Không có |
  | Auth | `Authorization: Bearer <token>` |
  | FastAPI route | `sync.bootstrap_workspace` |

- Endpoint lọc dữ liệu theo `user.id`. Vite proxy mặc định chuyển `/api` tới `http://127.0.0.1:8000`.
- Tại thời điểm kiểm tra, cổng 8000 không có listener. Đây là nguyên nhân đủ để proxy không kết nối được FastAPI và trả 502. Không lấy được log/request trong trình duyệt nên chưa thể khẳng định request cụ thể của người dùng.
- Trên server, lỗi DB trước đây rơi vào exception handler tổng quát (500); health check trả 200 kể cả khi DB lỗi. Đã đổi lỗi kết nối/pool thành 503 và health check thành 503 nếu không kết nối được MariaDB.
- Không có API graph riêng. `sync.bootstrap` không trả `note.related`, và `aiContexts.sources` đang trả mảng rỗng; do đó graph từ dữ liệu backend hiện không có đủ quan hệ để tạo cạnh. Đây là thiếu sót chức năng còn mở, không phải request gây 502.

### Xử lý lỗi frontend/proxy

- API client đặt timeout 30 giây; lỗi mạng, timeout và HTTP 502 có thông báo tiếng Việt cụ thể, giữ nguyên HTTP status.
- Vite proxy có target cấu hình được qua `VITE_API_PROXY_TARGET`, timeout 30 giây, log upstream error và trả JSON 502 rõ nghĩa khi FastAPI không có.
- Graph hiển thị trạng thái rỗng khi tài khoản chưa có ghi chú.

## 2. MariaDB và kết nối

- `pymysql` và SQLAlchemy 2.x đã có trong requirements. Backend dùng URL `mysql+pymysql` với `charset=utf8mb4`.
- Engine bổ sung connect/read/write timeout, pool pre-ping, recycle, giới hạn pool và timezone phiên `+00:00`. Compose cấu hình server `utf8mb4`, `utf8mb4_unicode_ci`, UTC và chỉ bind cổng `127.0.0.1`.
- Bỏ đường ghi đè `DATABASE_URL`; cấu hình dùng `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`. DB_HOST thuộc `*.tidbcloud.com` bị từ chối.
- **Kết nối thực tế chưa xác minh:** tiến trình tại thời điểm kiểm tra nhận DB target TiDB Cloud (`port 4000`, database `banhangonline`) từ biến môi trường process; `SELECT VERSION(), DATABASE()` thất bại với PyMySQL error 2003. Truy vấn thử tới `127.0.0.1:3306` cũng thất bại với error 2003.
- Docker CLI không có trong môi trường và cổng MariaDB local không mở. Vì vậy MariaDB version/database thật **chưa xác định**. `MariaDB 11.4` trong [compose.yaml](./compose.yaml) là baseline đề xuất, không phải phiên bản đã chạy xác minh.
- Không ghi/đọc password trong báo cáo; không sửa `backend/.env`.

## 3. Migration và dữ liệu

- Không chạy `07_full_install.sql`, migration 08 hoặc migration 09.
- Không tạo backup vì không thực hiện thay đổi trên database.
- `07_full_install.sql` chỉ dành cho database trống; không chạy trên database hiện hữu.
- Migration 08 có `ADD COLUMN IF NOT EXISTS` và thay constraint archive; chưa kiểm chứng trên phiên bản MariaDB thực tế và không được xem là transaction nguyên tử.
- Migration 09 dùng `CREATE OR REPLACE TRIGGER` để đồng bộ ngưỡng archive; có tính thay thế lặp lại theo cú pháp, nhưng chưa chạy/kiểm chứng trên server.
- Cần xác nhận đúng MariaDB và có bản backup restore được trước khi áp dụng migration nào. Schema, FK, index, dữ liệu và rollback thực tế chưa được xác minh.

## 4. File đã sửa

- `backend/app/core/config.py`: bỏ `DATABASE_URL`, mặc định user ứng dụng `note_app`, từ chối host TiDB Cloud.
- `backend/app/database/session.py`: cấu hình timeout, pool và UTC.
- `backend/app/main.py`: health check truy vấn `VERSION()`/`DATABASE()`, trả 503 khi DB lỗi; log và ánh xạ lỗi DB kết nối/pool sang 503.
- `frontend/vite.config.js`: proxy target tùy chỉnh, timeout và phản hồi JSON 502 có hướng dẫn.
- `frontend/.env.example`: thêm biến proxy development, không thêm credential.
- `frontend/src/js/modules/note/api.js`: timeout và thông báo lỗi dễ hiểu.
- `frontend/src/js/modules/note/graph.js`, `frontend/src/scss/3-components/note.scss`: trạng thái rỗng graph.
- `backend/.env.example`: dùng user ứng dụng và placeholder password riêng cho app/root.
- `compose.yaml`: MariaDB 11.4, volume bền vững, healthcheck, chỉ bind localhost.
- `backend/tests/test_database_errors.py`, `frontend/tests/api-client-errors.test.mjs`: kiểm tra cấu hình DB, status lỗi, 502/network/timeout.
- `backend/README.md`: hướng dẫn Compose và cảnh báo không chạy full-install trên DB đang có dữ liệu.

## 5. Kiểm thử

| Kiểm tra | Kết quả |
|---|---|
| Backend unit/API tests | **34 passed**, 22 cảnh báo Pydantic deprecation |
| Frontend API + document + sharing tests | **17 passed**, 0 failed |
| Frontend lint/format/icon check | **PASS** |
| Frontend production build | **PASS**, còn cảnh báo bundle lớn trên 500 KB |
| `SELECT VERSION(), DATABASE()` trên MariaDB thật | **Chưa đạt** — không có MariaDB local; target hiện tại là TiDB unreachable |
| CRUD, đọc PDF/DOCX, ZIP/7Z, sharing, AI Context, graph, auth nhiều tài khoản trên DB thật | **Chưa chạy** |
| DB-offline/timeout | Handler được unit-test; direct localhost connection trả error 2003 |
| Edge/Playwright E2E | **Chưa chạy** |
| Vite 502 qua HTTP thực | Vite khởi động được; sandbox không cho Node kết nối tới dev server local nên chưa xác nhận response thực. API client xử lý 502 đã được unit-test. |

## 6. Việc còn lại / chưa thể xác minh

1. Cài/chạy MariaDB local (hoặc cung cấp môi trường MariaDB đã backup); xác minh `SELECT VERSION(), DATABASE()` trước mọi migration.
2. Xử lý việc process-level `DB_*` hiện ghi đè `backend/.env`; đặt chúng về MariaDB trước khi khởi động backend. Code hiện từ chối TiDB thay vì âm thầm kết nối.
3. Chạy schema introspection và migration 08/09 có kiểm soát sau backup.
4. Chạy CRUD, tài liệu, archive, sharing, AI Context, multi-account và E2E trên MariaDB thật.
5. Hoàn thiện quan hệ graph từ dữ liệu DB. Hiện graph là local SVG dựa trên notes; endpoint bootstrap không cung cấp cạnh note và AI Context chưa lưu nguồn tham chiếu đầy đủ.
6. Ghi nhận request/response 502 từ trình duyệt thật để xác nhận chính xác request mà người dùng gặp.
