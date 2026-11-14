import { getState, saveAiContext } from "./store";
import {
  escapeHTML,
  formatDate,
  formatDateTime,
  refreshIcons,
  showModal,
  showToast,
} from "./utils";

let selectedContextId = null;

export const renderAiContext = () => {
  const state = getState();
  const contexts = state.aiContexts || [];
  const listEl = document.querySelector("[data-context-list]");
  const countEl = document.querySelector("[data-context-count]");

  if (countEl) countEl.textContent = `${contexts.length} mục`;

  if (!contexts.some((c) => c.id === selectedContextId)) {
    selectedContextId = contexts[0]?.id || null;
  }

  // Render list
  if (listEl) {
    if (!contexts.length) {
      listEl.innerHTML = `<div class="p-4 text-center text-body-secondary small">Chưa có AI Context nào. Hãy tạo hoặc nhập từ file JSON.</div>`;
    } else {
      listEl.innerHTML = contexts
        .map((ctx) => {
          const isActive = ctx.id === selectedContextId;
          const sourcesCount = (ctx.sources || []).length;
          return `
            <button type="button" class="list-group-item list-group-item-action p-3 border-0 border-bottom d-flex align-items-start gap-3 ${isActive ? "active" : ""}" data-select-context="${escapeHTML(ctx.id)}">
              <span class="p-2 rounded bg-info-subtle text-info mt-1"><i data-lucide="cpu" style="width:18px;height:18px"></i></span>
              <div class="flex-grow-1 text-start overflow-hidden">
                <div class="d-flex align-items-center justify-content-between mb-1">
                  <strong class="text-truncate small">${escapeHTML(ctx.title)}</strong>
                  <span class="badge bg-primary-subtle text-primary" style="font-size:10px">v${escapeHTML(ctx.version || "1.0.0")}</span>
                </div>
                <small class="text-body-secondary d-block text-truncate">${sourcesCount} nguồn &bull; ${escapeHTML(formatDate(ctx.updatedAt))}</small>
              </div>
            </button>`;
        })
        .join("");
      refreshIcons(listEl);
    }
  }

  renderContextDetail();
};

export const renderContextDetail = () => {
  const state = getState();
  const contexts = state.aiContexts || [];
  const ctx = contexts.find((c) => c.id === selectedContextId);

  const titleEl = document.querySelector("[data-ctx-title]");
  const versionEl = document.querySelector("[data-ctx-version]");
  const updatedEl = document.querySelector("[data-ctx-updated]");
  const summaryBox = document.querySelector("[data-ctx-summary-box]");
  const sourcesList = document.querySelector("[data-ctx-sources-list]");
  const insightsList = document.querySelector("[data-ctx-insights-list]");
  const questionsList = document.querySelector("[data-ctx-questions-list]");
  const directiveBox = document.querySelector("[data-ctx-directive-box]");
  const versionsList = document.querySelector("[data-ctx-versions-list]");

  if (!ctx) {
    if (titleEl) titleEl.textContent = "Chưa chọn AI Context";
    if (versionEl) versionEl.textContent = "v0.0.0";
    if (summaryBox)
      summaryBox.innerHTML =
        "<p class='text-body-secondary small'>Không có dữ liệu.</p>";
    return;
  }

  if (titleEl) titleEl.textContent = ctx.title;
  if (versionEl) versionEl.textContent = `v${ctx.version || "1.0.0"}`;
  if (updatedEl)
    updatedEl.textContent = `Cập nhật lần cuối: ${formatDateTime(ctx.updatedAt)}`;

  if (summaryBox) {
    summaryBox.innerHTML = `<p class="mb-0 text-body" style="line-height:1.6">${escapeHTML(ctx.summary || "Chưa có tóm tắt.")}</p>`;
  }

  if (sourcesList) {
    const sources = ctx.sources || [];
    sourcesList.innerHTML = sources.length
      ? sources
          .map(
            (s) => `
            <div class="list-group-item d-flex align-items-center gap-2 py-2 px-0 border-0 border-bottom small">
              ${s.type === "document" ? '<i data-lucide="file-text" style="width:15px;height:15px" class="text-primary"></i>' : '<i data-lucide="notebook-pen" style="width:15px;height:15px" class="text-primary"></i>'}
              <span class="fw-medium">${escapeHTML(s.title)}</span>
              <span class="badge bg-secondary-subtle text-secondary small ms-auto">${escapeHTML(s.type)}</span>
            </div>`
          )
          .join("")
      : "<p class='text-body-secondary small'>Chưa có nguồn tham chiếu.</p>";
    refreshIcons(sourcesList);
  }

  if (insightsList) {
    const insights = ctx.insights || [];
    insightsList.innerHTML = insights.length
      ? insights
          .map(
            (ins) => `
            <div class="list-group-item d-flex align-items-start gap-2 py-2 px-0 border-0 border-bottom small">
              <i data-lucide="circle-check" style="width:16px;height:16px" class="text-success mt-1"></i>
              <span class="flex-grow-1">${escapeHTML(ins)}</span>
            </div>`
          )
          .join("")
      : "<p class='text-body-secondary small'>Chưa có kết luận.</p>";
    refreshIcons(insightsList);
  }

  if (questionsList) {
    const questions = ctx.openQuestions || [];
    questionsList.innerHTML = questions.length
      ? questions
          .map(
            (q) => `
            <div class="list-group-item d-flex align-items-start gap-2 py-2 px-0 border-0 border-bottom small">
              <i data-lucide="circle-question-mark" style="width:16px;height:16px" class="text-warning mt-1"></i>
              <span class="flex-grow-1">${escapeHTML(q)}</span>
            </div>`
          )
          .join("")
      : "<p class='text-body-secondary small'>Không có câu hỏi mở.</p>";
    refreshIcons(questionsList);
  }

  if (directiveBox) {
    directiveBox.textContent =
      ctx.handoffDirective || "Chưa có chỉ dẫn cho mô hình AI tiếp theo.";
  }

  if (versionsList) {
    const versions = ctx.versions || [];
    versionsList.innerHTML = versions.length
      ? versions
          .map(
            (v) => `
            <div class="list-group-item d-flex align-items-center justify-content-between py-2 px-0 border-0 border-bottom small">
              <div>
                <strong class="badge bg-primary-subtle text-primary me-2">v${escapeHTML(v.version)}</strong>
                <span>${escapeHTML(v.note || "Bản cập nhật")}</span>
              </div>
              <small class="text-body-secondary">${escapeHTML(formatDateTime(v.at))}</small>
            </div>`
          )
          .join("")
      : "<p class='text-body-secondary small'>Chưa có lịch sử phiên bản.</p>";
  }
};

// Generate AI Handoff Prompt
export const generateHandoffPrompt = (ctx) => {
  return `### SYSTEM / CONTEXT HANDOFF DIRECTIVE (NOTE v${ctx.version || "1.0.0"})
CHỦ ĐỀ: ${ctx.title}

1. TÓM TẮT NGỮ CẢNH:
${ctx.summary}

2. CÁC KẾT LUẬN & KIẾN THỨC ĐÃ KIỂM CHỨNG:
${(ctx.insights || []).map((i, idx) => `${idx + 1}. ${i}`).join("\n")}

3. CÂU HỎI MỞ CẦN GIẢI QUYẾT TIẾP:
${(ctx.openQuestions || []).map((q) => `- ${q}`).join("\n")}

4. CHỈ DẪN DÀNH CHO AI TIẾP THEO:
${ctx.handoffDirective}
`;
};

export const initAiContext = () => {
  renderAiContext();
  window.addEventListener("note:statechange", renderAiContext);
  window.addEventListener("note:viewchange", (e) => {
    if (e.detail.view === "ai-context") renderAiContext();
  });

  document.addEventListener("click", async (event) => {
    // Select Context
    const selectBtn = event.target.closest("[data-select-context]");
    if (selectBtn) {
      selectedContextId = selectBtn.dataset.selectContext;
      renderAiContext();
      return;
    }

    // Actions on current context
    const actionBtn = event.target.closest("[data-ctx-action]");
    if (actionBtn && selectedContextId) {
      const action = actionBtn.dataset.ctxAction;
      const ctx = getState().aiContexts?.find(
        (c) => c.id === selectedContextId
      );
      if (!ctx) return;

      if (action === "handoff") {
        const prompt = generateHandoffPrompt(ctx);
        navigator.clipboard.writeText(prompt);
        showToast(
          "Đã sao chép prompt AI Handoff vào clipboard! Bạn có thể dán sang bất kỳ mô hình AI nào.",
          "success"
        );
        return;
      }

      if (action === "snapshot") {
        try {
          await saveAiContext(ctx);
          showToast(`Đã tạo bản snapshot mới cho "${ctx.title}"`, "success");
        } catch (error) {
          showToast(error.message || "Không thể lưu AI Context.", "danger");
        }
        return;
      }

      if (action === "export-json") {
        const jsonStr = JSON.stringify(ctx, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${ctx.title.replace(/\s+/g, "_")}.note-context.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast("Đã xuất file AI Context Capsule (.json)", "success");
        return;
      }

      if (action === "validate-json") {
        const modal = document.querySelector("#context-json-modal");
        const textarea = document.querySelector("[data-context-json-textarea]");
        if (textarea) textarea.value = JSON.stringify(ctx, null, 2);
        if (modal) showModal(modal);
        return;
      }
    }

    // Copy from JSON modal
    if (event.target.closest("[data-copy-context-json]")) {
      const textarea = document.querySelector("[data-context-json-textarea]");
      if (textarea) {
        navigator.clipboard.writeText(textarea.value);
        showToast("Đã sao chép JSON Schema vào clipboard", "success");
      }
      return;
    }

    // Create New Context
    if (event.target.closest("[data-context-create-btn]")) {
      const title = prompt("Nhập tên chủ đề cho AI Context Capsule mới:");
      if (title && title.trim()) {
        try {
          const newCtx = await saveAiContext({
            title: title.trim(),
            summary: "Tóm tắt khởi tạo ban đầu cho phiên làm việc mới.",
            insights: ["Ghi nhận ban đầu từ người học."],
            openQuestions: ["Cần phân tích thêm tài liệu liên quan."],
            handoffDirective:
              "Hãy tiếp tục hỗ trợ người học làm sâu sắc thêm chủ đề này.",
          });
          selectedContextId = newCtx.id;
          renderAiContext();
          showToast(`Đã tạo AI Context "${title.trim()}"`, "success");
        } catch (error) {
          showToast(error.message || "Không thể tạo AI Context.", "danger");
        }
      }
      return;
    }

    // Import JSON
    if (event.target.closest("[data-context-import-btn]")) {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json,application/json";
      input.onchange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = async (ev) => {
            try {
              const parsed = JSON.parse(ev.target?.result);
              if (parsed.title) {
                const imported = await saveAiContext({
                  title: parsed.title,
                  summary: parsed.summary || "",
                  insights: parsed.insights || [],
                  openQuestions: parsed.openQuestions || [],
                  handoffDirective: parsed.handoffDirective || "",
                  sources: parsed.sources || [],
                });
                selectedContextId = imported.id;
                renderAiContext();
                showToast(
                  `Đã nhập thành công AI Context Capsule "${parsed.title}"`,
                  "success"
                );
              } else {
                showToast(
                  "File JSON không đúng cấu trúc AI Context Capsule",
                  "danger"
                );
              }
            } catch (error) {
              showToast(error.message || "Lỗi khi đọc file JSON", "danger");
            }
          };
          reader.readAsText(file);
        }
      };
      input.click();
    }
  });
};
