# KẾ HOẠCH SAO LƯU VÀ PHỤC HỒI DỮ LIỆU TRÊN VPS (BACKUP & RESTORE PLAN)

---

## 1. MỤC TIÊU VÀ CHỈ SỐ RPO / RTO

Đối với ứng dụng quản lý tri thức cá nhân NOTE chạy trên máy chủ ảo VPS với ngân sách thấp, chiến lược sao lưu được thiết kế để tối ưu chi phí nhưng vẫn đảm bảo tính an toàn tuyệt đối cho dữ liệu:

- **RPO (Recovery Point Objective - Điểm phục hồi mục tiêu):** **<= 24 giờ** (Tối đa chỉ mất dữ liệu trong vòng 1 ngày trong kịch bản xấu nhất VPS hỏng đột ngột).
- **RTO (Recovery Time Objective - Thời gian phục hồi mục tiêu):** **<= 2 giờ** (Dựng lại VPS mới, nạp lại database MariaDB và đồng bộ lại tệp nhị phân).

---

## 2. NGUYÊN TẮC SAO LƯU 3-2-1 TINH GỌN (LEAN 3-2-1 BACKUP RULE)

1. **3 bản sao dữ liệu:**
   - Bản 1: Dữ liệu thực tế đang chạy trên VPS (MariaDB data directory + Storage folder).
   - Bản 2: Bản sao lưu nén cục bộ lưu tại phân vùng `/backup` trên VPS.
   - Bản 3: Bản sao lưu ngoại vi (Off-site) được đẩy tự động ra ngoài VPS (về máy tính cá nhân qua SSH/Rsync hoặc lưu trên Cloud Storage miễn phí/rẻ như Cloudflare R2, Backblaze B2, Google Drive qua `rclone`).
2. **2 loại phương tiện lưu trữ:**
   - VPS SSD Block Storage.
   - Cloud Object Storage hoặc Ổ cứng máy tính cá nhân.
3. **1 bản sao lưu ngoài máy chủ (Off-site):**
   - **Tuyệt đối không để bản sao lưu duy nhất trên cùng một VPS.** Khi nhà cung cấp VPS gặp hỏa hoạn, lỗi phần cứng hoặc khóa tài khoản, bản sao lưu ngoài VPS sẽ cứu sống toàn bộ dữ liệu.

---

## 3. CHIẾN LƯỢC SAO LƯU TÁCH BẠCH

Hệ thống NOTE áp dụng kiến trúc **Hybrid Storage**, do đó quy trình sao lưu được chia thành 2 phần độc lập nhưng đồng bộ:

### 3.1. Sao lưu Cơ sở dữ liệu MariaDB (Metadata & Relations)
- **Công cụ:** `mariadb-dump` (hoặc `mysqldump` tương thích) với các cờ tối ưu cho InnoDB:
  - `--single-transaction`: Sao lưu dữ liệu nhất quán mà không khóa bảng (Zero Downtime).
  - `--quick`: Đọc từng hàng trực tiếp từ máy chủ để tiết kiệm RAM.
  - `--routines --triggers`: Sao lưu đầy đủ hàm và trigger.
- **Tần suất:** Hàng ngày vào lúc 02:00 sáng (thời điểm ít người dùng nhất).
- **Định dạng:** SQL nén bằng `gzip` (giảm dung lượng đến 85-90%).

### 3.2. Sao lưu Tệp nhị phân (Storage Files)
- **Đối tượng:** Thư mục chứa các tệp PDF, DOCX, XLSX, ZIP tải lên (`/var/data/note-storage`).
- **Công cụ:** `tar` nén tăng dần hoặc `rclone sync`.
- **Tần suất:** Hàng ngày vào lúc 02:30 sáng, chỉ đồng bộ các file mới hoặc có thay đổi (Incremental Backup).

---

## 4. KỊCH BẢN BACKUP TỰ ĐỘNG BẰNG BASH SCRIPT & CRONJOB

### Script sao lưu tự động trên VPS (`/opt/note/scripts/backup.sh`):
```bash
#!/bin/bash
set -e

# Cấu hình biến môi trường
BACKUP_DIR="/backup/note"
DATE=$(date +"%Y%m%d_%H%M%S")
DB_USER="note_user"
DB_PASS="YOUR_SECURE_PASSWORD"
DB_NAME="note_db"
STORAGE_DIR="/var/data/note-storage"
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

echo "=== [1/4] Bắt đầu sao lưu MariaDB Database ==="
mariadb-dump -u "$DB_USER" -p"$DB_PASS" \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  --databases "$DB_NAME" | gzip > "$BACKUP_DIR/note_db_${DATE}.sql.gz"

echo "=== [2/4] Bắt đầu sao lưu Storage Files ==="
tar -czf "$BACKUP_DIR/note_storage_${DATE}.tar.gz" -C "$STORAGE_DIR" .

echo "=== [3/4] Đẩy bản sao lưu về nơi lưu trữ an toàn ngoài VPS ==="
# Sử dụng rclone để đồng bộ lên Cloudflare R2 / Backblaze B2 / Google Drive
rclone copy "$BACKUP_DIR/note_db_${DATE}.sql.gz" remote_backup:note-backups/database/
rclone copy "$BACKUP_DIR/note_storage_${DATE}.tar.gz" remote_backup:note-backups/storage/

echo "=== [4/4] Dọn dẹp bản sao lưu cũ trên VPS (giữ lại 7 ngày) ==="
find "$BACKUP_DIR" -type f -name "*.gz" -mtime +"$RETENTION_DAYS" -delete

echo "=== Sao lưu hoàn tất thành công lúc $(date) ==="
```

### Cấu hình Cronjob chạy tự động (`crontab -e`):
```cron
# Chạy sao lưu tự động vào lúc 02:00 sáng mỗi ngày
0 2 * * * /bin/bash /opt/note/scripts/backup.sh >> /var/log/note_backup.log 2>&1
```

---

## 5. QUY TRÌNH PHỤC HỒI DỮ LIỆU KHI VPS GẶP SỰ CỐ (DISASTER RECOVERY)

Khi VPS bị hỏng hoàn toàn, tiến hành khôi phục theo các bước chuẩn sau:

### Bước 1: Khởi tạo VPS mới và cài đặt môi trường
1. Tạo VPS mới (Ubuntu 22.04 / Debian 12 / Rocky Linux 9).
2. Cài đặt MariaDB Server:
   ```bash
   sudo apt update && sudo apt install -y mariadb-server gzip tar
   sudo mysql_secure_installation
   ```
3. Tạo Database và phân quyền người dùng:
   ```sql
   CREATE DATABASE note_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'note_user'@'localhost' IDENTIFIED BY 'YOUR_SECURE_PASSWORD';
   GRANT ALL PRIVILEGES ON note_db.* TO 'note_user'@'localhost';
   FLUSH PRIVILEGES;
   ```

### Bước 2: Tải bản sao lưu mới nhất từ kho lưu trữ ngoại vi
```bash
# Tải file từ Cloud hoặc máy tính cá nhân về VPS mới
rclone copy remote_backup:note-backups/database/note_db_YYYYMMDD.sql.gz /tmp/
rclone copy remote_backup:note-backups/storage/note_storage_YYYYMMDD.tar.gz /tmp/
```

### Bước 3: Phục hồi Database MariaDB
```bash
gunzip < /tmp/note_db_YYYYMMDD.sql.gz | mariadb -u note_user -pYOUR_SECURE_PASSWORD note_db
```

### Bước 4: Phục hồi Storage Files
```bash
sudo mkdir -p /var/data/note-storage
sudo tar -xzf /tmp/note_storage_YYYYMMDD.tar.gz -C /var/data/note-storage
sudo chown -R www-data:www-data /var/data/note-storage
```

### Bước 5: Kiểm tra tính toàn vẹn sau khi phục hồi
1. Đăng nhập vào MariaDB kiểm tra số lượng bản ghi:
   ```sql
   SELECT count(*) FROM note_db.users;
   SELECT count(*) FROM note_db.documents;
   SELECT count(*) FROM note_db.ai_contexts;
   ```
2. Khởi động ứng dụng NOTE và đăng nhập bằng tài khoản người dùng, mở tài liệu kiểm tra việc đọc file bình thường.

---

## 6. LỊCH DIỄN TẬP PHỤC HỒI ĐỊNH KỲ (DISASTER RECOVERY DRILL)

- **Nguyên tắc vàng:** "Một bản sao lưu chưa từng được thử khôi phục thì không thể coi là bản sao lưu".
- **Lịch diễn tập:** Định kỳ mỗi 3 tháng một lần:
  1. Tải bản backup về máy tính cá nhân (hoặc môi trường Docker cục bộ).
  2. Chạy kịch bản khôi phục thử nghiệm trên MariaDB cục bộ.
  3. Kiểm tra xem các bảng có khôi phục đầy đủ không, đối soát mã băm `sha256_checksum` của 5 tài liệu ngẫu nhiên.
