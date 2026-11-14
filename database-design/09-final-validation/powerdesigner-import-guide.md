# HƯỚNG DẪN IMPORT VÀ MỞ MÔ HÌNH BẰNG SAP POWERDESIGNER

---

## 1. TỔNG QUAN TẬP TIN MÔ HÌNH POWERDESIGNER
Trong dự án NOTE, hệ thống cung cấp đầy đủ 3 tệp mô hình chuẩn cấu trúc XML của SAP PowerDesigner:
1. `database-design/02-mcd/NOTE-MCD.cdm`: Conceptual Data Model (MCD - Merise).
2. `database-design/03-mld/NOTE-MLD.ldm`: Logical Data Model (MLD).
3. `database-design/04-mpd/NOTE-MPD.pdm`: Physical Data Model (MPD - MariaDB/MySQL).

Cùng với tệp SQL nguyên khối chuẩn bị sẵn cho chức năng Reverse Engineering:
- `database-design/06-sql/07_full_install.sql`

---

## 2. PHƯƠNG PHÁP 1: MỞ TRỰC TIẾP TỆP MÔ HÌNH CÓ SẴN (DIRECT OPEN)

Áp dụng cho máy tính đã cài đặt **SAP PowerDesigner 16.5 hoặc 16.7**:
1. Khởi động phần mềm **SAP PowerDesigner**.
2. Trên thanh menu, chọn **File** -> **Open...** (hoặc phím tắt `Ctrl + O`).
3. Điều hướng tới thư mục dự án:
   - Chọn `d:\NOTE\database-design\04-mpd\NOTE-MPD.pdm` để xem sơ đồ vật lý MariaDB.
   - Hoặc chọn `d:\NOTE\database-design\02-mcd/NOTE-MCD.cdm` để xem mô hình khái niệm Merise.
4. Nhấn **Open**. Toàn bộ 32 thực thể/bảng, danh mục thuộc tính, kiểu dữ liệu và mối liên kết sẽ được hiển thị trong Workspace Browser.
5. Để tự động dàn trang sơ đồ trực quan (Auto-layout Diagram):
   - Mở Diagram tương ứng trong cây thư mục bên trái.
   - Nhấn chuột phải vào vùng trống của sơ đồ -> Chọn **Display Preferences** hoặc chọn Menu **Symbol** -> **Auto-Layout** (hoặc phím tắt `Ctrl + F6`).

---

## 3. PHƯƠNG PHÁP 2: REVERSE ENGINEERING TỪ TỆP DDL SQL (KHUYẾN NGHỊ ĐẠT ĐỘ CHÍNH XÁC CAO NHẤT)

Đây là phương pháp chuẩn mực công nghiệp để tạo ra sơ đồ Physical Data Model (PDM) hoàn hảo 100% kèm biểu đồ tự động:

1. Khởi động **SAP PowerDesigner**.
2. Trên thanh menu, chọn **File** -> **Reverse Engineer** -> **Database...**
3. Cửa sổ *New Physical Data Model* xuất hiện:
   - **Model name:** Nhập `NOTE_DATABASE_PHYSICAL`
   - **DBMS:** Chọn `MySQL 5.0` hoặc `MariaDB 10.x` (nếu có profile tương ứng) hoặc `ODBC 3.0`.
   - Nhấn **OK**.
4. Cửa sổ *Database Reverse Engineering Selection Options* xuất hiện:
   - Tại mục **Selection**, chọn radio button **Using script files**.
   - Nhấn vào biểu tượng **Add Files** (nút màu vàng có dấu cộng).
   - Chọn đường dẫn tệp: `d:\NOTE\database-design\06-sql\07_full_install.sql`.
   - Nhấn **OK**.
5. PowerDesigner sẽ tự động biên dịch toàn bộ câu lệnh DDL, trích xuất 32 bảng, 48 khóa ngoại, chỉ mục B-Tree và tự động vẽ sơ đồ quan hệ (Diagram).
6. Sau khi sơ đồ xuất hiện, bạn có thể chuyển đổi tự động sang CDM hoặc LDM:
   - Menu **Tools** -> **Generate Conceptual Data Model...** (hoặc `Ctrl + Shift + C`).
   - Nhấn **OK** để tạo ra tệp CDM chuẩn Merise tự động.

---

## 4. PHƯƠNG PHÁP 3: REVERSE ENGINEERING QUA KẾT NỐI TRỰC TIẾP DATABASE (LIVE ODBC)

Nếu bạn đã triển khai database lên máy chủ MariaDB đang chạy:
1. Tạo một kết nối ODBC 64-bit trên Windows trỏ đến `note_db` thông qua MariaDB Connector/ODBC.
2. Trong PowerDesigner: **File** -> **Reverse Engineer** -> **Database...**
3. Chọn tùy chọn **Using an ODBC data source**.
4. Chọn Data Source name của MariaDB vừa cấu hình.
5. Chọn schema `note_db` và nhấn **OK** để trích xuất trực tiếp toàn bộ bảng, trigger và view.
