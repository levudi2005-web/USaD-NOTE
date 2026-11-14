-- =============================================================================
-- DỰ ÁN: NOTE - WORKSPACE MANAGEMENT & AI-POWERED LEARNING
-- BỘ MÃ SQL TRIỂN KHAI TOÀN DIỆN CHO MARIADB 10.11+ LTS
-- TẬP TIN 06: QUY TRÌNH HỦY BỎ / THU HỒI AN TOÀN (SAFE ROLLBACK SCRIPT)
-- (XÓA THEO ĐÚNG THỨ TỰ PHỤ THUỘC NGƯỢC TỪ BẢNG LÁ ĐẾN BẢNG GỐC)
-- =============================================================================

USE `note_db`;

-- 1. Tạm thời tắt kiểm tra khóa ngoại để hủy các cấu trúc an toàn
SET foreign_key_checks = 0;

-- 2. Hủy các Database Triggers
DROP TRIGGER IF EXISTS `trg_archives_calc_ratio_before_insert`;
DROP TRIGGER IF EXISTS `trg_documents_soft_delete_revoke_shares`;
DROP TRIGGER IF EXISTS `trg_documents_increase_storage`;
DROP TRIGGER IF EXISTS `trg_documents_decrease_storage`;

-- 3. Hủy 32 bảng theo thứ tự ngược lại (Drop Child tables first)
DROP TABLE IF EXISTS `notifications`;
DROP TABLE IF EXISTS `activity_logs`;
DROP TABLE IF EXISTS `share_access_logs`;
DROP TABLE IF EXISTS `shared_links`;
DROP TABLE IF EXISTS `quiz_attempt_answers`;
DROP TABLE IF EXISTS `quiz_attempts`;
DROP TABLE IF EXISTS `quiz_options`;
DROP TABLE IF EXISTS `quiz_questions`;
DROP TABLE IF EXISTS `quizzes`;
DROP TABLE IF EXISTS `flashcards`;
DROP TABLE IF EXISTS `flashcard_decks`;
DROP TABLE IF EXISTS `ai_context_versions`;
DROP TABLE IF EXISTS `ai_contexts`;
DROP TABLE IF EXISTS `ai_task_logs`;
DROP TABLE IF EXISTS `ai_tasks`;
DROP TABLE IF EXISTS `ai_messages`;
DROP TABLE IF EXISTS `ai_conversations`;
DROP TABLE IF EXISTS `ai_connections`;
DROP TABLE IF EXISTS `ai_models`;
DROP TABLE IF EXISTS `ai_providers`;
DROP TABLE IF EXISTS `archive_extracted_files`;
DROP TABLE IF EXISTS `archives`;
DROP TABLE IF EXISTS `collection_items`;
DROP TABLE IF EXISTS `collections`;
DROP TABLE IF EXISTS `document_tags`;
DROP TABLE IF EXISTS `tags`;
DROP TABLE IF EXISTS `notes`;
DROP TABLE IF EXISTS `documents`;
DROP TABLE IF EXISTS `folders`;
DROP TABLE IF EXISTS `user_sessions`;
DROP TABLE IF EXISTS `user_recovery_codes`;
DROP TABLE IF EXISTS `users`;

-- 4. Bật lại kiểm tra khóa ngoại
SET foreign_key_checks = 1;

-- (Tùy chọn) Hủy toàn bộ Database nếu muốn dọn sạch hoàn toàn:
-- DROP DATABASE IF EXISTS `note_db`;
