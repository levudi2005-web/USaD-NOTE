import { marked } from "marked";
import DOMPurify from "dompurify";
import { addCard, addNote, getState } from "./store";
import { escapeHTML, refreshIcons, showToast } from "./utils";
import api, { getToken } from "./api";

let chatMessages = [
  {
    role: "assistant",
    content: `Xin chào! Tôi là trợ lý AI của **NOTE**.\n\nTôi có thể hỗ trợ bạn:\n- 📖 **Đọc & tóm tắt** tài liệu chuyên sâu.\n- 💡 **Giải thích thuật ngữ** hoặc khái niệm phức tạp.\n- 🗂️ **Tự động sinh Flashcards** từ các ý quan trọng.\n- 📝 **Tạo bài trắc nghiệm (Quiz)** để kiểm tra mức độ hiểu bài.\n\n_Hãy chọn một tác vụ ở cột bên trái hoặc đặt câu hỏi trực tiếp!_`,
    sources: [],
    time: "Vừa xong",
  },
];
let activeConversationId = null;
let savedConversations = [];
let aiModels = [];
let aiProviders = [];

export const renderAiAssistant = () => {
  const state = getState();
  const streamEl = document.querySelector("[data-chat-stream]");
  const docSelect = document.querySelector("[data-ai-attach-document]");
  const modelSelect = document.querySelector("[data-ai-active-model]");
  const bannerIndicator = document.querySelector(
    "[data-ai-connection-indicator]"
  );
  const conversationsList = document.querySelector("[data-chat-sessions-list]");

  if (modelSelect) {
    const selectedModelId = modelSelect.value;
    modelSelect.innerHTML = aiModels
      .map((model) => {
        const provider = aiProviders.find(
          (item) => item.id === model.provider_id
        );
        const label = provider
          ? `${model.name} (${provider.name})`
          : model.name;
        return `<option value="${escapeHTML(model.id)}">${escapeHTML(label)}</option>`;
      })
      .join("");
    if (aiModels.some((model) => model.id === selectedModelId)) {
      modelSelect.value = selectedModelId;
    } else {
      modelSelect.value =
        aiModels.find((model) => model.is_default)?.id || aiModels[0]?.id || "";
    }
    modelSelect.disabled = aiModels.length === 0;
  }

  if (conversationsList) {
    conversationsList.innerHTML = savedConversations.length
      ? savedConversations
          .map(
            (conversation) => `
            <button type="button" class="list-group-item list-group-item-action rounded mb-1 ${conversation.id === activeConversationId ? "active" : ""}"
              data-ai-conversation="${escapeHTML(conversation.id)}">
              <span class="d-block text-truncate">${escapeHTML(conversation.title)}</span>
            </button>`
          )
          .join("")
      : '<p class="text-body-secondary small">Chưa có hội thoại đã lưu.</p>';
  }

  // Update document options
  if (docSelect) {
    const curVal = docSelect.value;
    docSelect.innerHTML = `<option value="">-- Đính kèm tài liệu nguồn --</option>${(
      state.documents || []
    )
      .map(
        (d) =>
          `<option value="${escapeHTML(d.id)}">${escapeHTML(d.name)}</option>`
      )
      .join("")}`;
    docSelect.value = curVal;
  }

  // Update banner with active connection
  const activeConn = (state.aiConnections || []).find((c) => c.isConnected);
  if (bannerIndicator) {
    if (activeConn) {
      bannerIndicator.textContent = `Đang kết nối: ${activeConn.name} (${activeConn.defaultModel})`;
      bannerIndicator.className =
        "badge rounded-pill bg-success-subtle text-success border border-success-subtle";
    } else {
      bannerIndicator.textContent = "Chưa kết nối API Key (BYOK)";
      bannerIndicator.className =
        "badge rounded-pill bg-warning-subtle text-warning border border-warning-subtle";
    }
  }

  // Render chat messages
  if (streamEl) {
    streamEl.innerHTML = chatMessages
      .map((msg, index) => {
        const isUser = msg.role === "user";
        const rawHtml = isUser
          ? escapeHTML(msg.content)
          : DOMPurify.sanitize(marked.parse(msg.content));

        const citationsHtml =
          msg.sources && msg.sources.length
            ? `<div class="mt-2 pt-2 border-top border-light-subtle small">
              <span class="text-body-secondary fw-semibold"><i data-lucide="book-bookmark" style="width:13px;height:13px"></i> Nguồn tham chiếu:</span>
              <div class="d-flex flex-wrap gap-1 mt-1">
                ${msg.sources.map((s) => `<span class="badge bg-secondary-subtle text-secondary small">${escapeHTML(s)}</span>`).join(" ")}
              </div>
            </div>`
            : "";

        const actionButtons = !isUser
          ? `<div class="d-flex align-items-center gap-2 mt-2 pt-2 border-top border-light-subtle">
              <button class="btn btn-sm btn-link p-0 text-decoration-none small text-body-secondary" type="button" data-chat-copy="${index}" title="Sao chép nội dung">
                <i data-lucide="copy" style="width:13px;height:13px"></i> Chép
              </button>
              <button class="btn btn-sm btn-link p-0 text-decoration-none small text-body-secondary" type="button" data-save-to-note="${index}" title="Lưu thành ghi chú mới trong NOTE">
                <i data-lucide="notebook-pen" style="width:13px;height:13px"></i> Lưu vào Ghi chú
              </button>
              <button class="btn btn-sm btn-link p-0 text-decoration-none small text-body-secondary" type="button" data-extract-to-flashcard="${index}" title="Tạo thẻ flashcard từ nội dung này">
                <i data-lucide="layers" style="width:13px;height:13px"></i> Tạo Flashcard
              </button>
            </div>`
          : "";

        return `
          <div class="note-chat-bubble ${isUser ? "user-bubble" : "ai-bubble"}">
            <div class="note-user-avatar ${isUser ? "bg-secondary text-white" : "bg-primary text-white"} rounded-circle d-flex align-items-center justify-content-center fw-bold flex-shrink-0" style="width:32px;height:32px;font-size:12px">
              ${isUser ? "BẠN" : "AI"}
            </div>
            <div class="bubble-content flex-grow-1">
              ${rawHtml}
              ${citationsHtml}
              ${actionButtons}
            </div>
          </div>`;
      })
      .join("");

    refreshIcons(streamEl);
    streamEl.scrollTop = streamEl.scrollHeight;
  }
};

// Send message handler with BYOK logic
export const sendChatMessage = async (userText) => {
  if (!userText || !userText.trim()) return;

  const docSelect = document.querySelector("[data-ai-attach-document]");
  const attachedDocId = docSelect?.value;
  const state = getState();
  const attachedDoc = state.documents?.find((d) => d.id === attachedDocId);
  const selectedModelId = document.querySelector(
    "[data-ai-active-model]"
  )?.value;
  const selectedModel = aiModels.find((model) => model.id === selectedModelId);
  const selectedConnection = selectedModel
    ? state.aiConnections?.find(
        (connection) => connection.provider_id === selectedModel.provider_id
      )
    : null;

  const sources = attachedDoc ? [attachedDoc.name] : [];

  chatMessages.push({
    role: "user",
    content: userText.trim(),
    time: "Vừa xong",
  });
  renderAiAssistant();

  const thinkingState = document.querySelector("[data-ai-thinking-state]");
  if (thinkingState) thinkingState.hidden = false;

  try {
    if (selectedModel && !selectedConnection) {
      throw new Error(
        "Hãy thêm và kiểm tra kết nối cho nhà cung cấp của mô hình đã chọn trước khi chat."
      );
    }
    const res = await api.ai.chat({
      message: userText.trim(),
      conversation_id: activeConversationId,
      connection_id: selectedConnection?.id || null,
      model_name: selectedModel?.id || null,
      document_id: attachedDocId || null,
    });

    if (thinkingState) thinkingState.hidden = true;
    activeConversationId = res.conversation_id;

    chatMessages.push({
      role: "assistant",
      content: res.content,
      sources,
      time: "Vừa xong",
      tokens: res.total_tokens,
    });
    renderAiAssistant();
    loadConversations()
      .then(renderAiAssistant)
      .catch((error) =>
        showToast(
          error.message || "Không thể tải danh sách hội thoại.",
          "warning"
        )
      );
  } catch (err) {
    if (thinkingState) thinkingState.hidden = true;
    chatMessages.push({
      role: "assistant",
      content: `⚠️ **Thông báo hệ thống**:\n\n${escapeHTML(err.message || "Không thể kết nối đến máy chủ AI.")}\n\n*Gợi ý: Vào Cài đặt &rarr; AI BYOK để kiểm tra kết nối API Key.*`,
      sources: [],
      time: "Vừa xong",
    });
    renderAiAssistant();
  }
};

const loadConversations = async () => {
  if (!getToken()) {
    savedConversations = [];
    return;
  }
  savedConversations = await api.ai.getConversations();
};

const openConversation = async (conversationId) => {
  const conversation = await api.ai.getConversation(conversationId);
  activeConversationId = conversation.id;
  chatMessages = (conversation.messages || []).map((message) => ({
    role: message.role,
    content: message.content,
    sources: [],
    time: "Đã lưu",
    tokens: message.total_tokens,
  }));
  renderAiAssistant();
};

export const initAiAssistant = () => {
  renderAiAssistant();
  Promise.all([api.ai.getProviders(), api.ai.getModels()])
    .then(async ([providers, models]) => {
      aiProviders = providers;
      aiModels = models;
      if (getToken()) await loadConversations();
      renderAiAssistant();
    })
    .catch((error) => {
      showToast(error.message || "Không thể tải danh mục AI.", "warning");
    });
  window.addEventListener("note:statechange", renderAiAssistant);
  window.addEventListener("note:viewchange", (e) => {
    if (e.detail.view === "assistant") renderAiAssistant();
  });

  // Chat Form Submit
  const form = document.querySelector("[data-ai-chat-form]");
  const input = document.querySelector("[data-chat-input]");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (input && input.value.trim()) {
      const text = input.value;
      input.value = "";
      sendChatMessage(text);
    }
  });

  // Quick Action Buttons
  document.addEventListener("click", (event) => {
    const conversationButton = event.target.closest("[data-ai-conversation]");
    if (conversationButton) {
      openConversation(conversationButton.dataset.aiConversation).catch(
        (error) => {
          showToast(error.message || "Không thể tải hội thoại.", "danger");
        }
      );
      return;
    }

    const quickBtn = event.target.closest("[data-quick-action]");
    if (quickBtn) {
      const action = quickBtn.dataset.quickAction;
      const prompts = {
        summarize:
          "Hãy tóm tắt ngắn gọn và làm nổi bật các ý chính trong tài liệu này.",
        explain:
          "Hãy giải thích chi tiết các thuật ngữ chuyên môn khó hiểu bằng ngôn ngữ trực quan.",
        "make-flashcards":
          "Hãy trích xuất 3 cặp câu hỏi và trả lời dạng Flashcards từ nội dung này.",
        "make-quiz":
          "Hãy tạo 1 câu hỏi trắc nghiệm 4 lựa chọn A, B, C, D kèm giải thích đáp án.",
        outline:
          "Hãy lập đề cương chi tiết phân cấp cho các luận điểm trong tài liệu.",
      };
      if (prompts[action]) {
        sendChatMessage(prompts[action]);
      }
      return;
    }

    // Clear Chat
    if (
      event.target.closest("[data-chat-clear]") ||
      event.target.closest("[data-chat-new]")
    ) {
      activeConversationId = null;
      chatMessages = [
        {
          role: "assistant",
          content:
            "Cuộc trò chuyện mới đã bắt đầu. Tôi có thể giúp gì cho bạn hôm nay?",
          sources: [],
          time: "Vừa xong",
        },
      ];
      renderAiAssistant();
      showToast("Đã bắt đầu phiên trò chuyện mới", "info");
      return;
    }

    // Copy Content
    const copyBtn = event.target.closest("[data-chat-copy]");
    if (copyBtn) {
      const idx = Number(copyBtn.dataset.chatCopy);
      const msg = chatMessages[idx];
      if (msg) {
        navigator.clipboard.writeText(msg.content);
        showToast("Đã sao chép phản hồi vào clipboard", "success");
      }
      return;
    }

    // Save to Note
    const saveNoteBtn = event.target.closest("[data-save-to-note]");
    if (saveNoteBtn) {
      const idx = Number(saveNoteBtn.dataset.saveToNote);
      const msg = chatMessages[idx];
      if (msg) {
        addNote({
          title: `Ghi chú AI (${new Date().toLocaleTimeString("vi-VN")})`,
          category: "AI Assistant",
          content: DOMPurify.sanitize(marked.parse(msg.content)),
          tags: ["ai", "assistant"],
        });
        showToast("Đã lưu nội dung thành Ghi chú mới trong NOTE!", "success");
      }
      return;
    }

    // Extract to Flashcard
    const extractCardBtn = event.target.closest("[data-extract-to-flashcard]");
    if (extractCardBtn) {
      const idx = Number(extractCardBtn.dataset.extractToFlashcard);
      const msg = chatMessages[idx];
      if (msg) {
        addCard({
          deckName: "AI Ôn tập",
          front: "Nội dung trích xuất từ AI Assistant",
          back: msg.content.slice(0, 300) + "...",
        });
        showToast("Đã thêm một Flashcard vào bộ 'AI Ôn tập'!", "success");
      }
    }
  });
};
