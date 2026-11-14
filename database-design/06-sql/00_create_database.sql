-- =============================================================================
-- DỰ ÁN: NOTE - WORKSPACE MANAGEMENT & AI-POWERED LEARNING
-- BỘ MÃ SQL TRIỂN KHAI TOÀN DIỆN CHO MARIADB 10.11+ LTS
-- TẬP TIN 00: TẠO DATABASE VÀ THIẾT LẬP BỘ MÃ KÝ TỰ / SO KHỚP
-- =============================================================================

-- 1. Tạo cơ sở dữ liệu với bộ mã utf8mb4 và collation chuẩn unicode
CREATE DATABASE IF NOT EXISTS `note_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- 2. Chuyển ngữ cảnh sử dụng cơ sở dữ liệu
USE `note_db`;

-- 3. Thiết lập chế độ SQL nghiêm ngặt và múi giờ chuẩn UTC
SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET foreign_key_checks = 1;
