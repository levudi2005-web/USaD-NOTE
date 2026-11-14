-- =============================================================================
-- DỰ ÁN: NOTE - WORKSPACE MANAGEMENT & AI-POWERED LEARNING
-- BỘ MÃ SQL TRIỂN KHAI TOÀN DIỆN CHO MARIADB 10.11+ LTS
-- TẬP TIN 04: CÁC RÀNG BUỘC CHECK VÀ TRIGGER NGHIỆP VỤ BẢO VỆ DỮ LIỆU
-- =============================================================================

USE `note_db`;

-- -----------------------------------------------------------------------------
-- 1. CÁC RÀNG BUỘC CHECK (MARIADB 10.2+)
-- -----------------------------------------------------------------------------

-- Ràng buộc 1: collection_items phải trỏ đúng duy nhất 1 trong 3 đối tượng (document, note hoặc deck)
ALTER TABLE `collection_items`
  ADD CONSTRAINT `chk_collection_item_exclusive`
  CHECK ((`document_id` IS NOT NULL) + (`note_id` IS NOT NULL) + (`deck_id` IS NOT NULL) = 1);

-- Ràng buộc 2: archives kiểm tra tỉ lệ giải nén và dung lượng uncompressed
ALTER TABLE `archives`
  ADD CONSTRAINT `chk_archives_ratio`
  CHECK (`max_ratio` >= 0.00);

-- Ràng buộc 3: ai_tasks tiến độ phần trăm từ 0 đến 100%
ALTER TABLE `ai_tasks`
  ADD CONSTRAINT `chk_ai_tasks_progress`
  CHECK (`progress` <= 100);

-- Ràng buộc 4: ai_contexts tiến độ hiểu biết từ 0 đến 100%
ALTER TABLE `ai_contexts`
  ADD CONSTRAINT `chk_ai_contexts_progress`
  CHECK (`learning_progress` <= 100);

-- Ràng buộc 5: quiz_attempts điểm số từ 0.00 đến 100.00
ALTER TABLE `quiz_attempts`
  ADD CONSTRAINT `chk_quiz_attempts_score`
  CHECK (`score` >= 0.00 AND `score` <= 100.00);

-- Ràng buộc 6: quizzes điểm đạt nằm trong khoảng 0-100
ALTER TABLE `quizzes`
  ADD CONSTRAINT `chk_quizzes_passing_score`
  CHECK (`passing_score` <= 100);

-- Ràng buộc 7: users dung lượng lưu trữ không được âm
ALTER TABLE `users`
  ADD CONSTRAINT `chk_users_storage_positive`
  CHECK (`storage_used` >= 0 AND `storage_limit` > 0);

-- -----------------------------------------------------------------------------
-- 2. DATABASE TRIGGERS BẢO VỆ TÍNH TOÀN VẸN VÀ BẢO MẬT
-- -----------------------------------------------------------------------------

DELIMITER $$

-- Trigger 1: Tự động tính toán tỉ lệ giải nén trước khi lưu gói nén
CREATE OR REPLACE TRIGGER `trg_archives_calc_ratio_before_insert`
BEFORE INSERT ON `archives`
FOR EACH ROW
BEGIN
  IF NEW.file_size > 0 THEN
    SET NEW.max_ratio = ROUND(NEW.uncompressed_size / NEW.file_size, 2);
  END IF;
  
  -- Đồng bộ với giới hạn MAX_ARCHIVE_COMPRESSION_RATIO của backend.
  IF NEW.max_ratio > 50.00 THEN
    SET NEW.scan_status = 'rejected';
  END IF;
END$$

-- Trigger 2: Tự động thu hồi (is_revoked = 1) mọi link chia sẻ khi tài liệu bị xóa mềm
CREATE OR REPLACE TRIGGER `trg_documents_soft_delete_revoke_shares`
AFTER UPDATE ON `documents`
FOR EACH ROW
BEGIN
  -- Khi tài liệu bị chuyển vào thùng rác (deleted_at từ NULL chuyển sang có giá trị)
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    UPDATE `shared_links`
    SET `is_revoked` = 1, `updated_at` = CURRENT_TIMESTAMP
    WHERE `document_id` = NEW.id AND `is_revoked` = 0;
  END IF;
END$$

-- Trigger 3: Cập nhật dung lượng storage_used của User khi tải tài liệu mới lên
CREATE OR REPLACE TRIGGER `trg_documents_increase_storage`
AFTER INSERT ON `documents`
FOR EACH ROW
BEGIN
  UPDATE `users`
  SET `storage_used` = `storage_used` + NEW.file_size,
      `updated_at` = CURRENT_TIMESTAMP
  WHERE `id` = NEW.user_id;
END$$

-- Trigger 4: Giảm dung lượng storage_used của User khi tài liệu bị xóa vĩnh viễn (PURGE)
CREATE OR REPLACE TRIGGER `trg_documents_decrease_storage`
AFTER DELETE ON `documents`
FOR EACH ROW
BEGIN
  UPDATE `users`
  SET `storage_used` = GREATEST(CAST(`storage_used` AS SIGNED) - CAST(OLD.file_size AS SIGNED), 0),
      `updated_at` = CURRENT_TIMESTAMP
  WHERE `id` = OLD.user_id;
END$$

DELIMITER ;
