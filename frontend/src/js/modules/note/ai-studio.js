import { getState } from "./store";
import { escapeHTML, showToast } from "./utils";

export const initAiStudio = () => {
  document.querySelectorAll("[data-ai-document]").forEach((select) => {
    const renderOptions = () => {
      const current = select.value;
      select.innerHTML = `<option value="">Chưa chọn tài liệu</option>${getState()
        .documents.map(
          (document) =>
            `<option value="${escapeHTML(document.id)}">${escapeHTML(document.name)}${document.isDemo ? " · mẫu" : ""}</option>`
        )
        .join("")}`;
      if (getState().documents.some((document) => document.id === current)) {
        select.value = current;
      }
    };
    renderOptions();
    window.addEventListener("note:statechange", renderOptions);
  });

  document.querySelectorAll("[data-ai-unavailable]").forEach((button) => {
    button.addEventListener("click", () => {
      showToast(
        "AI chưa kết nối. Không có nội dung nào được gửi hoặc tạo.",
        "warning"
      );
    });
  });
  document
    .querySelector("[data-ai-form]")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      showToast(
        "AI backend chưa kết nối. Câu hỏi chưa được gửi và không có câu trả lời giả.",
        "warning"
      );
    });
  document.querySelector("[data-chat-clear]")?.addEventListener("click", () => {
    const messages = document.querySelector("[data-chat-messages]");
    if (messages) messages.replaceChildren();
    const history = document.querySelector("[data-chat-history]");
    if (history) {
      history.innerHTML =
        '<p class="text-body-secondary small">Chưa có hội thoại.</p>';
    }
    showToast("Đã xóa nội dung hội thoại trong phiên này.", "success");
  });
  document
    .querySelectorAll("[data-ai-form] input[type=file]")
    .forEach((input) => {
      input.addEventListener("change", () => {
        if (input.files?.length) {
          showToast(
            `Đã chọn “${input.files[0].name}”. Tệp chưa được tải lên vì AI chưa kết nối.`,
            "info"
          );
        }
        input.value = "";
      });
    });
};
