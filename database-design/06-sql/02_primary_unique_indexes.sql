-- =============================================================================
-- DỰ ÁN: NOTE - WORKSPACE MANAGEMENT & AI-POWERED LEARNING
-- BỘ MÃ SQL TRIỂN KHAI TOÀN DIỆN CHO MARIADB 10.11+ LTS
-- TẬP TIN 02: BỔ SUNG CÁC CHỈ MỤC HIỆU NĂNG (INDEXES & FULLTEXT)
-- =============================================================================

USE `note_db`;

-- 1. Chỉ mục tối ưu hóa cho Tài khoản & Phiên
CREATE INDEX `idx_recovery_user_unused` ON `user_recovery_codes` (`user_id`, `used_at`);
CREATE INDEX `idx_sessions_user_expires` ON `user_sessions` (`user_id`, `expires_at`);

-- 2. Chỉ mục tối ưu hóa Thư mục & Cây phân cấp
CREATE INDEX `idx_folders_user_parent` ON `folders` (`user_id`, `parent_id`);

-- 3. Chỉ mục tối ưu hóa Tài liệu & Tìm kiếm toàn văn
CREATE INDEX `idx_documents_user_deleted` ON `documents` (`user_id`, `deleted_at`, `created_at` DESC);
CREATE INDEX `idx_documents_folder` ON `documents` (`folder_id`);
CREATE INDEX `idx_documents_checksum` ON `documents` (`sha256_checksum`);
CREATE FULLTEXT INDEX `ft_documents_content` ON `documents` (`name`, `extracted_text`);

-- 4. Chỉ mục tối ưu hóa Ghi chú
CREATE INDEX `idx_notes_user_doc` ON `notes` (`user_id`, `document_id`);
CREATE INDEX `idx_notes_folder` ON `notes` (`folder_id`);
CREATE FULLTEXT INDEX `ft_notes_text` ON `notes` (`title`, `content`);

-- 5. Chỉ mục tối ưu hóa Thẻ & Bảng kết hợp
CREATE INDEX `idx_doc_tags_tag` ON `document_tags` (`tag_id`);

-- 6. Chỉ mục tối ưu hóa Bộ sưu tập
CREATE INDEX `idx_collections_user` ON `collections` (`user_id`);
CREATE INDEX `idx_coll_items_document` ON `collection_items` (`document_id`);
CREATE INDEX `idx_coll_items_note` ON `collection_items` (`note_id`);
CREATE INDEX `idx_coll_items_deck` ON `collection_items` (`deck_id`);

-- 7. Chỉ mục tối ưu hóa Gói nén ZIP/7Z
CREATE INDEX `idx_archives_user` ON `archives` (`user_id`, `created_at` DESC);
CREATE INDEX `idx_arch_extract_doc` ON `archive_extracted_files` (`document_id`);

-- 8. Chỉ mục tối ưu hóa AI BYOK & Model
CREATE INDEX `idx_ai_models_provider` ON `ai_models` (`provider_id`);
CREATE INDEX `idx_ai_conn_user_provider` ON `ai_connections` (`user_id`, `provider_id`);
CREATE INDEX `idx_ai_conn_model` ON `ai_connections` (`default_model_id`);

-- 9. Chỉ mục tối ưu hóa AI Assistant & Tin nhắn
CREATE INDEX `idx_ai_conv_user_time` ON `ai_conversations` (`user_id`, `updated_at` DESC);
CREATE INDEX `idx_ai_conv_doc` ON `ai_conversations` (`pinned_document_id`);
CREATE INDEX `idx_ai_msg_conv_time` ON `ai_messages` (`conversation_id`, `created_at` ASC);

-- 10. Chỉ mục tối ưu hóa AI Tasks
CREATE INDEX `idx_ai_tasks_user_status` ON `ai_tasks` (`user_id`, `status`);
CREATE INDEX `idx_ai_tasks_doc` ON `ai_tasks` (`source_document_id`);
CREATE INDEX `idx_task_logs_task` ON `ai_task_logs` (`task_id`, `executed_at`);

-- 11. Chỉ mục tối ưu hóa AI Context
CREATE INDEX `idx_ai_context_user` ON `ai_contexts` (`user_id`, `updated_at` DESC);

-- 12. Chỉ mục tối ưu hóa Flashcards & Quizzes
CREATE INDEX `idx_decks_user` ON `flashcard_decks` (`user_id`);
CREATE INDEX `idx_decks_doc` ON `flashcard_decks` (`document_id`);
CREATE INDEX `idx_cards_deck_known` ON `flashcards` (`deck_id`, `is_known`);
CREATE INDEX `idx_quizzes_user` ON `quizzes` (`user_id`);
CREATE INDEX `idx_quizzes_doc` ON `quizzes` (`document_id`);
CREATE INDEX `idx_questions_quiz_order` ON `quiz_questions` (`quiz_id`, `order_index`);
CREATE INDEX `idx_options_question` ON `quiz_options` (`question_id`);
CREATE INDEX `idx_attempts_user_quiz` ON `quiz_attempts` (`user_id`, `quiz_id`, `completed_at` DESC);
CREATE INDEX `idx_attempts_quiz` ON `quiz_attempts` (`quiz_id`);
CREATE INDEX `idx_ans_option` ON `quiz_attempt_answers` (`selected_option_id`);

-- 13. Chỉ mục tối ưu hóa Chia sẻ Ngoại vi
CREATE INDEX `idx_shared_links_user` ON `shared_links` (`user_id`);
CREATE INDEX `idx_shared_links_doc` ON `shared_links` (`document_id`);
CREATE INDEX `idx_share_logs_link_time` ON `share_access_logs` (`shared_link_id`, `accessed_at` DESC);

-- 14. Chỉ mục tối ưu hóa Vận hành & Giám sát
CREATE INDEX `idx_act_logs_user_time` ON `activity_logs` (`user_id`, `created_at` DESC);
CREATE INDEX `idx_notif_user_read` ON `notifications` (`user_id`, `is_read`, `created_at` DESC);
