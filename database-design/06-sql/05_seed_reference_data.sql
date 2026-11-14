-- =============================================================================
-- DỰ ÁN: NOTE - WORKSPACE MANAGEMENT & AI-POWERED LEARNING
-- BỘ MÃ SQL TRIỂN KHAI TOÀN DIỆN CHO MARIADB 10.11+ LTS
-- TẬP TIN 05: DỮ LIỆU DANH MỤC HỆ THỐNG (REFERENCE / CATALOG DATA)
-- (TUYỆT ĐỐI KHÔNG TẠO TÀI KHOẢN NGƯỜI DÙNG GIẢ HOẶC API KEY GIẢ)
-- =============================================================================

USE `note_db`;

-- 1. Nạp danh mục các nhà cung cấp AI chính thức (ai_providers)
INSERT INTO `ai_providers` (`id`, `name`, `api_base_url`, `auth_header_format`, `icon`, `is_active`) VALUES
('gemini', 'Google Gemini', 'https://generativelanguage.googleapis.com/v1beta', 'x-goog-api-key', 'sparkles', 1),
('openai', 'OpenAI', 'https://api.openai.com/v1', 'Bearer {KEY}', 'bot', 1),
('claude', 'Anthropic Claude', 'https://api.anthropic.com/v1', 'x-api-key', 'brain', 1),
('groq', 'Groq Cloud', 'https://api.groq.com/openai/v1', 'Bearer {KEY}', 'zap', 1),
('openrouter', 'OpenRouter', 'https://openrouter.ai/api/v1', 'Bearer {KEY}', 'globe', 1),
('custom', 'Custom OpenAI-Compatible', 'http://localhost:11434/v1', 'Bearer {KEY}', 'server', 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `api_base_url` = VALUES(`api_base_url`);

-- 2. Nạp danh mục các model AI tiêu chuẩn hệ thống hỗ trợ (ai_models)
INSERT INTO `ai_models` (`id`, `provider_id`, `display_name`, `context_window`, `max_output_tokens`, `supports_vision`, `is_default`) VALUES
-- Google Gemini
('gemini-1.5-flash', 'gemini', 'Gemini 1.5 Flash (Tốc độ cao & Ngữ cảnh 1M)', 1048576, 8192, 1, 1),
('gemini-1.5-pro', 'gemini', 'Gemini 1.5 Pro (Lập luận sâu & Ngữ cảnh 2M)', 2097152, 8192, 1, 0),
('gemini-2.0-flash-exp', 'gemini', 'Gemini 2.0 Flash Experimental', 1048576, 8192, 1, 0),

-- OpenAI
('gpt-4o', 'openai', 'GPT-4o (Đa phương tiện Omni)', 128000, 16384, 1, 1),
('gpt-4o-mini', 'openai', 'GPT-4o Mini (Tiết kiệm chi phí)', 128000, 16384, 1, 0),
('o3-mini', 'openai', 'o3-mini (Lập luận toán học & logic)', 200000, 100000, 0, 0),

-- Anthropic Claude
('claude-3-5-sonnet-20241022', 'claude', 'Claude 3.5 Sonnet (Đọc hiểu & Viết văn bản)', 200000, 8192, 1, 1),
('claude-3-5-haiku-20241022', 'claude', 'Claude 3.5 Haiku (Phản hồi cực nhanh)', 200000, 8192, 1, 0),

-- Groq Cloud
('llama-3.3-70b-versatile', 'groq', 'Llama 3.3 70B Versatile (Groq LPU tốc độ cao)', 128000, 32768, 0, 1),
('llama-3.1-8b-instant', 'groq', 'Llama 3.1 8B Instant (Độ trễ mili-giây)', 128000, 8192, 0, 0),
('mixtral-8x7b-32768', 'groq', 'Mixtral 8x7B (MoE Architecture)', 32768, 32768, 0, 0),

-- OpenRouter
('deepseek/deepseek-r1', 'openrouter', 'DeepSeek R1 (Mô hình suy luận mã nguồn mở)', 64000, 8000, 0, 1),
('anthropic/claude-3.5-sonnet', 'openrouter', 'Claude 3.5 Sonnet (Qua OpenRouter)', 200000, 8192, 1, 0),
('meta-llama/llama-3.3-70b-instruct', 'openrouter', 'Meta Llama 3.3 70B (Qua OpenRouter)', 128000, 32768, 0, 0),

-- Custom OpenAI-Compatible
('custom-model', 'custom', 'Custom Model (Ollama / LocalAI / vLLM)', 32768, 4096, 0, 1)
ON DUPLICATE KEY UPDATE `display_name` = VALUES(`display_name`), `context_window` = VALUES(`context_window`);
