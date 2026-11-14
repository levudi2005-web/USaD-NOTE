-- =============================================================================
-- DỰ ÁN: NOTE - WORKSPACE MANAGEMENT & AI-POWERED LEARNING
-- BỘ MÃ SQL TRIỂN KHAI TOÀN DIỆN CHO MARIADB 10.11+ LTS
-- TẬP TIN 03: THIẾT LẬP TOÀN BỘ RÀNG BUỘC KHÓA NGOẠI & COMPOSITE FOREIGN KEYS
-- =============================================================================

USE `note_db`;

-- -----------------------------------------------------------------------------
-- 1. KHÓA NGOẠI PHÂN HỆ TÀI KHOẢN & BẢO MẬT
-- -----------------------------------------------------------------------------

ALTER TABLE `user_recovery_codes`
  ADD CONSTRAINT `fk_recovery_user`
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `user_sessions`
  ADD CONSTRAINT `fk_sessions_user`
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- 2. KHÓA NGOẠI PHÂN HỆ TÀI LIỆU, THƯ MỤC & LƯU TRỮ
-- -----------------------------------------------------------------------------

-- Thư mục: Khóa ngoại trỏ về User và tự tham chiếu đệ quy kiểm soát cùng User
ALTER TABLE `folders`
  ADD CONSTRAINT `fk_folders_user`
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_folders_parent_composite`
  FOREIGN KEY (`user_id`, `parent_id`) REFERENCES `folders` (`user_id`, `id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Tài liệu: Composite FK ngăn chặn User A gán tài liệu vào thư mục của User B
ALTER TABLE `documents`
  ADD CONSTRAINT `fk_documents_user`
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_documents_folder_composite`
  FOREIGN KEY (`folder_id`) REFERENCES `folders` (`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Ghi chú: Composite FKs ngăn chặn liên kết chéo thư mục và tài liệu khác chủ sở hữu
ALTER TABLE `notes`
  ADD CONSTRAINT `fk_notes_user`
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_notes_folder_composite`
  FOREIGN KEY (`folder_id`) REFERENCES `folders` (`id`)
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_notes_document_composite`
  FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Nhãn từ khóa & Bảng kết hợp
ALTER TABLE `tags`
  ADD CONSTRAINT `fk_tags_user`
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `document_tags`
  ADD CONSTRAINT `fk_doctags_document`
  FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_doctags_tag`
  FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Bộ sưu tập & Phần tử tường minh
ALTER TABLE `collections`
  ADD CONSTRAINT `fk_collections_user`
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `collection_items`
  ADD CONSTRAINT `fk_coll_items_collection`
  FOREIGN KEY (`collection_id`) REFERENCES `collections` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_coll_items_document`
  FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_coll_items_note`
  FOREIGN KEY (`note_id`) REFERENCES `notes` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_coll_items_deck`
  FOREIGN KEY (`deck_id`) REFERENCES `flashcard_decks` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- 3. KHÓA NGOẠI PHÂN HỆ GÓI NÉN ZIP/7Z
-- -----------------------------------------------------------------------------

ALTER TABLE `archives`
  ADD CONSTRAINT `fk_archives_user`
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `archive_extracted_files`
  ADD CONSTRAINT `fk_archext_archive`
  FOREIGN KEY (`archive_id`) REFERENCES `archives` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_archext_document`
  FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- 4. KHÓA NGOẠI PHÂN HỆ AI BYOK & TRỢ LÝ HỘI THOẠI
-- -----------------------------------------------------------------------------

ALTER TABLE `ai_models`
  ADD CONSTRAINT `fk_models_provider`
  FOREIGN KEY (`provider_id`) REFERENCES `ai_providers` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ai_connections`
  ADD CONSTRAINT `fk_aiconn_user`
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_aiconn_provider`
  FOREIGN KEY (`provider_id`) REFERENCES `ai_providers` (`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_aiconn_model`
  FOREIGN KEY (`default_model_id`) REFERENCES `ai_models` (`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ai_conversations`
  ADD CONSTRAINT `fk_aiconv_user`
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_aiconv_connection_composite`
  FOREIGN KEY (`connection_id`) REFERENCES `ai_connections` (`id`)
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_aiconv_document_composite`
  FOREIGN KEY (`pinned_document_id`) REFERENCES `documents` (`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ai_messages`
  ADD CONSTRAINT `fk_aimsg_conversation`
  FOREIGN KEY (`conversation_id`) REFERENCES `ai_conversations` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- 5. KHÓA NGOẠI PHÂN HỆ AI TASKS & AI CONTEXT
-- -----------------------------------------------------------------------------

ALTER TABLE `ai_tasks`
  ADD CONSTRAINT `fk_aitasks_user`
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_aitasks_document_composite`
  FOREIGN KEY (`source_document_id`) REFERENCES `documents` (`id`)
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_aitasks_connection_composite`
  FOREIGN KEY (`connection_id`) REFERENCES `ai_connections` (`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ai_task_logs`
  ADD CONSTRAINT `fk_tasklogs_task`
  FOREIGN KEY (`task_id`) REFERENCES `ai_tasks` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ai_contexts`
  ADD CONSTRAINT `fk_aicontext_user`
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ai_context_versions`
  ADD CONSTRAINT `fk_contextver_context`
  FOREIGN KEY (`context_id`) REFERENCES `ai_contexts` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- 6. KHÓA NGOẠI PHÂN HỆ FLASHCARDS & QUIZZES
-- -----------------------------------------------------------------------------

ALTER TABLE `flashcard_decks`
  ADD CONSTRAINT `fk_decks_user`
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_decks_document_composite`
  FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `flashcards`
  ADD CONSTRAINT `fk_cards_deck`
  FOREIGN KEY (`deck_id`) REFERENCES `flashcard_decks` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `quizzes`
  ADD CONSTRAINT `fk_quizzes_user`
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_quizzes_document_composite`
  FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `quiz_questions`
  ADD CONSTRAINT `fk_questions_quiz`
  FOREIGN KEY (`quiz_id`) REFERENCES `quizzes` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `quiz_options`
  ADD CONSTRAINT `fk_options_question`
  FOREIGN KEY (`question_id`) REFERENCES `quiz_questions` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `quiz_attempts`
  ADD CONSTRAINT `fk_attempts_quiz`
  FOREIGN KEY (`quiz_id`) REFERENCES `quizzes` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_attempts_user`
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Khóa ngoại tổ hợp đặc biệt: Bảo đảm selected_option_id bắt buộc thuộc về question_id
ALTER TABLE `quiz_attempt_answers`
  ADD CONSTRAINT `fk_ans_attempt`
  FOREIGN KEY (`attempt_id`) REFERENCES `quiz_attempts` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_ans_question`
  FOREIGN KEY (`question_id`) REFERENCES `quiz_questions` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_ans_question_option_composite`
  FOREIGN KEY (`question_id`, `selected_option_id`) REFERENCES `quiz_options` (`question_id`, `id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- 7. KHÓA NGOẠI PHÂN HỆ CHIA SẺ, VẬN HÀNH & THÔNG BÁO
-- -----------------------------------------------------------------------------

-- Chia sẻ: Composite FK bảo đảm người dùng chỉ được tạo link chia sẻ cho tài liệu của chính mình
ALTER TABLE `shared_links`
  ADD CONSTRAINT `fk_shared_user`
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_shared_document_composite`
  FOREIGN KEY (`user_id`, `document_id`) REFERENCES `documents` (`user_id`, `id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `share_access_logs`
  ADD CONSTRAINT `fk_sharelogs_link`
  FOREIGN KEY (`shared_link_id`) REFERENCES `shared_links` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `activity_logs`
  ADD CONSTRAINT `fk_actlogs_user`
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `notifications`
  ADD CONSTRAINT `fk_notif_user`
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
