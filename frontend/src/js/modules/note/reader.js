import { getDocumentRecord } from "./documents/indexed-storage";
import api from "./api";
import { getState } from "./store";
import { escapeHTML, refreshIcons, showModal, showToast } from "./utils";

let currentDocRecord = null;
let currentDocId = null;
let currentZoom = 1.0;
let isTocOpen = true;
let isAiOpen = true;

export const openDocumentReader = async (docId) => {
  currentDocId = docId;
  const state = getState();
  const doc = state.documents?.find((d) => d.id === docId);
  if (!doc) {
    showToast("Không tìm thấy thông tin tài liệu", "danger");
    return;
  }

  const modal = document.querySelector("#document-reader-modal");
  const titleEl = document.querySelector("[data-reader-doc-title]");
  const contentPane = document.querySelector("[data-reader-content-pane]");
  const tocList = document.querySelector("[data-reader-toc-list]");
  const aiResponse = document.querySelector("[data-ai-reader-response]");

  if (titleEl) titleEl.textContent = doc.name;

  if (contentPane) {
    contentPane.innerHTML = `
      <div class="text-center py-5">
        <div class="spinner-border text-primary mb-3" role="status"></div>
        <p class="text-body-secondary small">Đang nạp dữ liệu và lập mục lục tài liệu...</p>
      </div>`;
  }

  if (modal) showModal(modal);

  try {
    const record = await getDocumentRecord(docId);
    currentDocRecord = record || {
      text: "Tài liệu mẫu hoặc chưa có nội dung trích xuất văn bản.",
    };

    let extractedText = currentDocRecord.text || "Nội dung văn bản trống.";
    if (doc.isDemo) {
      extractedText = `<h1>${escapeHTML(doc.name)}</h1>
      <p class="lead">Tài liệu giới thiệu về phương pháp học tập hiện đại và cấu trúc tri thức cá nhân (PKM).</p>
      <h2>1. Giới thiệu tổng quan</h2>
      <p>Trong kỷ nguyên số, thách thức lớn nhất không phải là thiếu thông tin mà là quá tải thông tin. Để biến dữ liệu thành tri thức thực thụ, người học cần áp dụng các chiến lược có kiểm chứng như Spaced Repetition (Ôn tập ngắt quãng) và Active Recall (Chủ động truy xuất).</p>
      <h2>2. Xây dựng Second Brain với NOTE</h2>
      <p>Ứng dụng NOTE cung cấp giải pháp toàn diện: đọc tài liệu đa định dạng, phân loại thư mục, khai thác gói nén ZIP/7Z và kết nối trợ lý AI cá nhân hóa.</p>
      <h2>3. Kết luận</h2>
      <p>Kiến thức thực sự là kiến thức có thể vận dụng linh hoạt để giải quyết các vấn đề mới.</p>`;
    }

    if (contentPane) {
      contentPane.innerHTML = `<div class="note-reader-formatted" style="font-size: ${currentZoom * 16}px; line-height: 1.8;">${extractedText}</div>`;
    }

    // Build Table of Contents (TOC)
    if (tocList) {
      tocList.innerHTML = `
        <div class="list-group list-group-flush">
          <a href="#" class="list-group-item list-group-item-action py-2 px-1 border-0 small fw-semibold active">1. Giới thiệu tổng quan</a>
          <a href="#" class="list-group-item list-group-item-action py-2 px-1 border-0 small">2. Xây dựng Second Brain</a>
          <a href="#" class="list-group-item list-group-item-action py-2 px-1 border-0 small">3. Kết luận</a>
        </div>`;
    }

    if (aiResponse) {
      aiResponse.innerHTML = `Nhấp chọn một tác vụ ở trên để trợ lý AI phân tích tài liệu <strong>"${escapeHTML(doc.name)}"</strong>.`;
    }

    refreshIcons(modal);
  } catch (err) {
    console.error("Reader error:", err);
    if (contentPane) {
      contentPane.innerHTML = `<div class="alert alert-danger">Không thể nạp nội dung tài liệu này.</div>`;
    }
  }
};

export const initReader = () => {
  document.addEventListener("click", async (event) => {
    // Open Reader Trigger from Document Preview
    const readBtn = event.target.closest("[data-open-zen-reader]");
    if (readBtn) {
      const docId = readBtn.dataset.openZenReader;
      openDocumentReader(docId);
      return;
    }

    // Zoom Controls
    const zoomBtn = event.target.closest("[data-reader-zoom]");
    if (zoomBtn) {
      const delta = Number(zoomBtn.dataset.readerZoom);
      currentZoom = Math.min(2.0, Math.max(0.7, currentZoom + delta));
      const textEl = document.querySelector(".note-reader-formatted");
      if (textEl) textEl.style.fontSize = `${currentZoom * 16}px`;
      return;
    }

    // Toggle TOC Pane
    if (event.target.closest("[data-reader-toggle-toc]")) {
      isTocOpen = !isTocOpen;
      const toc = document.querySelector("[data-reader-toc-pane]");
      if (toc) toc.hidden = !isTocOpen;
      return;
    }

    // Toggle AI Pane
    if (event.target.closest("[data-reader-toggle-ai]")) {
      isAiOpen = !isAiOpen;
      const ai = document.querySelector("[data-reader-ai-pane]");
      if (ai) ai.hidden = !isAiOpen;
      return;
    }

    // AI Reading Assistant Actions
    const aiActionBtn = event.target.closest("[data-ai-reader-action]");
    if (aiActionBtn) {
      const action = aiActionBtn.dataset.aiReaderAction;
      const respBox = document.querySelector("[data-ai-reader-response]");
      if (!respBox || !currentDocId) return;

      const prompts = {
        "summarize-page":
          "Tóm tắt các ý chính của tài liệu đính kèm một cách ngắn gọn.",
        "explain-terms":
          "Giải thích các thuật ngữ quan trọng trong tài liệu đính kèm.",
        "extract-cards":
          "Đề xuất tối đa 5 flashcard dựa trên tài liệu đính kèm. Ghi rõ mặt trước và mặt sau; chỉ đề xuất, không tuyên bố đã lưu.",
      };
      const prompt = prompts[action];
      if (!prompt) return;

      aiActionBtn.disabled = true;
      respBox.textContent = "Đang phân tích tài liệu bằng AI...";
      try {
        const result = await api.ai.chat({
          message: prompt,
          document_id: currentDocId,
        });
        const heading =
          action === "summarize-page"
            ? "Tóm tắt tài liệu"
            : action === "explain-terms"
              ? "Thuật ngữ nổi bật"
              : "Flashcard đề xuất (chưa lưu)";
        respBox.innerHTML = `<strong>${escapeHTML(heading)}:</strong><br>${escapeHTML(result.content).replace(/\n/gu, "<br>")}`;
        refreshIcons(respBox);
      } catch (error) {
        respBox.textContent =
          error instanceof Error
            ? error.message
            : "Không thể phân tích tài liệu bằng AI.";
      } finally {
        aiActionBtn.disabled = false;
      }
    }
  });

  // Search inside reader
  const searchInput = document.querySelector("[data-reader-search-input]");
  searchInput?.addEventListener("input", () => {
    const query = searchInput.value.trim().toLowerCase();
    const countEl = document.querySelector("[data-reader-search-count]");
    if (!query) {
      if (countEl) countEl.textContent = "0/0";
      return;
    }
    const textEl = document.querySelector(".note-reader-formatted");
    if (textEl && countEl) {
      const matches = (
        textEl.textContent.toLowerCase().match(new RegExp(query, "g")) || []
      ).length;
      countEl.textContent = `${matches > 0 ? "1" : "0"}/${matches}`;
    }
  });
};
