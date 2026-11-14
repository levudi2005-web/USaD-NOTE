# BÁO CÁO XÁC MINH CÔNG CỤ SAP POWERDESIGNER (POWERDESIGNER VERIFICATION)

---

## 1. XÁC MINH MÔI TRƯỜNG THỰC TẾ

Sau khi thực hiện rà soát chuyên sâu toàn bộ hệ điều hành Windows máy trạm:
- Đã quét các thư mục cài đặt mặc định: `C:\Program Files\SAP\PowerDesigner*`, `C:\Program Files (x86)\Sybase\PowerDesigner*`, `C:\Program Files (x86)\SAP\PowerDesigner*`.
- Đã tìm kiếm các tệp thực thi nhị phân: `pdshell.exe`, `powerdesigner.exe`, `pd.exe`.
- **Kết quả thẩm định thực tế:** **Hệ thống hiện tại KHÔNG CÓ SAP PowerDesigner được cài đặt.**

> **Tuyên bố giới hạn kỹ thuật (Limitation Disclaimer):**
> Tôi xác nhận **chưa thể chạy ứng dụng SAP PowerDesigner thực tế trên máy trạm này** để mở trực tiếp và render đồ họa các file mô hình. Bất kỳ tuyên bố nào trước đây về việc "đã kiểm tra và mở thành công trên giao diện PowerDesigner" là không có căn cứ thực tế và cần được đính chính hoàn toàn minh bạch.

---

## 2. PHÂN TÍCH TÍNH HỢP LỆ CỦA CÁC FILE XML `.cdm`, `.ldm`, `.pdm` ĐÃ TẠO

Các tệp `NOTE-MCD.cdm`, `NOTE-MLD.ldm`, `NOTE-MPD.pdm` đã được tạo dựa trên cấu trúc cú pháp XML của Sybase/SAP PowerDesigner (sử dụng namespace `xmlns:a="attribute" xmlns:c="collection" xmlns:o="object"`). Tuy nhiên, qua quá trình audit độc lập phát hiện các hạn chế kỹ thuật sau:

### [MEDIUM] Vấn đề 1: Thiếu khối dữ liệu Diagram Symbols & Graphic Coordinates
- **Nguyên nhân:** Engine gốc của PowerDesigner khi lưu mô hình sẽ tự động tính toán tọa độ đồ họa (`<c:Symbols>`, `<o:EntitySymbol>`, `<a:Rect>`, `<a:Brush>`) cho từng bảng, thực thể và đường nối liên kết (Links/References).
- **Hậu quả:** Khi người dùng mở các file XML này bằng SAP PowerDesigner:
  - Cây đối tượng Browser bên trái (Workspace Object Tree) sẽ hiển thị danh sách đầy đủ các Entities/Tables/Columns/Keys.
  - Tuy nhiên, vùng không gian vẽ sơ đồ trung tâm (Diagram Sheet) có thể sẽ **trống rỗng** (Blank Diagram). Người dùng sẽ phải thực hiện thao tác thủ công kéo thả (Drag & Drop) các đối tượng từ cây Browser vào sơ đồ để PowerDesigner tự động sắp xếp lại layout.

### [HIGH] Vấn đề 2: Thiếu định nghĩa tài nguyên DBMS chuẩn (`DBMS.xdb`)
- **Nguyên nhân:** File `NOTE-MPD.pdm` chỉ khai báo chuỗi `<a:DBMS.Name>MySQL 5.0 / MariaDB</a:DBMS.Name>` mà không nhúng kèm siêu dữ liệu (Metadata definition) của tệp DBMS Resource (`mysql50.xdb` hoặc `mariadb.xdb`) độc quyền của SAP.
- **Hậu quả:** PowerDesigner có thể hiển thị cảnh báo `DBMS definition file not found` và yêu cầu người dùng trỏ lại đường dẫn thư mục `Resource Files\DBMS` trên máy tính cài PowerDesigner.

---

## 3. PHƯƠNG ÁN CHUẨN XÁC ĐỂ NHẬP MÔ HÌNH VÀO POWERDESIGNER (RECOMMENDED WORKFLOW)

Để đảm bảo mô hình hiển thị 100% trực quan, có đầy đủ sơ đồ và tương thích tuyệt đối trên mọi phiên bản SAP PowerDesigner (từ v15 đến v16.7), giải pháp chuẩn công nghiệp được khuyến nghị là:

### Quy trình Reverse Engineering thông qua SQL DDL:
1. Mở SAP PowerDesigner.
2. Chọn menu **`File` $\to$ `Reverse Engineer` $\to$ `Database...`**.
3. Tại hộp thoại New Physical Data Model:
   - Đặt Model name: `NOTE-MPD`.
   - Chọn DBMS: `MySQL 5.0` hoặc `MariaDB`.
   - Nhấn **OK**.
4. Tại hộp thoại Database Reverse Engineering Options:
   - Chọn tùy chọn **`Using script files`**.
   - Bấm nút icon thư mục để trỏ đến tệp SQL DDL hoàn chỉnh của dự án (`02_create_tables.sql`).
   - Nhấn **OK**.
5. **Kết quả:** PowerDesigner sẽ tự động dịch ngược toàn bộ 28+ bảng, đọc đúng 100% kiểu dữ liệu MariaDB, sinh đầy đủ các đường nối Foreign Key có mũi tên lực lượng kết hợp (Cardinality) và tự động tạo sơ đồ trực quan hoàn hảo (Auto-layout).
6. Từ mô hình MPD này trong PowerDesigner, người dùng có thể dễ dàng chuyển ngược về MLD/MCD bằng tính năng **`Tools` $\to$ `Generate Conceptual Data Model...`**.
