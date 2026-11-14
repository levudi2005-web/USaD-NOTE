-- Apply to existing NOTE databases after installing the workspace API update.
USE `note_db`;

ALTER TABLE `documents`
  ADD COLUMN IF NOT EXISTS `is_starred` TINYINT(1) NOT NULL DEFAULT 0
  COMMENT 'Cờ đánh dấu tài liệu yêu thích',
  ADD COLUMN IF NOT EXISTS `is_archived` TINYINT(1) NOT NULL DEFAULT 0
  COMMENT 'Cờ lưu trữ tài liệu',
  ADD COLUMN IF NOT EXISTS `summary` LONGTEXT DEFAULT NULL
  COMMENT 'Tóm tắt do người dùng hoặc AI tạo';

ALTER TABLE `collections`
  ADD COLUMN IF NOT EXISTS `tags_json` LONGTEXT NOT NULL DEFAULT '[]'
  COMMENT 'Danh sách thẻ của bộ sưu tập dạng JSON';

ALTER TABLE `notes`
  ADD COLUMN IF NOT EXISTS `tags_json` LONGTEXT NOT NULL DEFAULT '[]'
  COMMENT 'Danh sách thẻ của ghi chú dạng JSON';

ALTER TABLE `flashcard_decks`
  ADD COLUMN IF NOT EXISTS `color` VARCHAR(20) NOT NULL DEFAULT '#10b981'
  COMMENT 'Màu nhận diện bộ thẻ';

ALTER TABLE `quizzes`
  ADD COLUMN IF NOT EXISTS `passing_score` TINYINT UNSIGNED NOT NULL DEFAULT 80
  COMMENT 'Điểm phần trăm tối thiểu để đạt';

ALTER TABLE `quiz_questions`
  ADD COLUMN IF NOT EXISTS `question_type` VARCHAR(30) NOT NULL DEFAULT 'single_choice'
  COMMENT 'Loại câu hỏi';

ALTER TABLE `archives`
  DROP CONSTRAINT IF EXISTS `chk_archives_ratio`,
  DROP CONSTRAINT IF EXISTS `chk_archives_uncompressed`,
  ADD CONSTRAINT `chk_archives_ratio` CHECK (`max_ratio` >= 0.00);
