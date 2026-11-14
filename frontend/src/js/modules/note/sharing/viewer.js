import api from "../api";

const root = document.querySelector("[data-public-share]");
const status = root?.querySelector("[data-share-view-status]");
const passwordForm = root?.querySelector("[data-share-view-password-form]");
const content = root?.querySelector("[data-share-view-content]");
const downloadButton = root?.querySelector("[data-share-view-download]");

let token = "";
let metadata = null;
let password = "";

const setStatus = (message, tone = "info") => {
  status.textContent = message;
  status.dataset.tone = tone;
};

const safeName = (name) =>
  name
    .replace(/[<>:"/\\|?*]/gu, "_")
    .replace(/\p{Cc}/gu, "_")
    .slice(0, 240) || "document";

const parseApiDate = (value) =>
  new Date(/(?:Z|[+-]\d{2}:\d{2})$/u.test(value) ? value : `${value}Z`);

const renderText = (text) => {
  const pre = document.createElement("pre");
  pre.className = "public-share-text";
  pre.textContent = text;
  content.replaceChildren(pre);
};

const loadSharedDocument = async (enteredPassword = "") => {
  setStatus("Đang kiểm tra liên kết…");
  passwordForm.hidden = true;
  content.hidden = true;
  downloadButton.hidden = true;
  try {
    metadata = await api.sharing.accessPublic(token, enteredPassword || null);
    password = enteredPassword;
    root.querySelector("[data-share-view-title]").textContent =
      metadata.document_name;
    root.querySelector("[data-share-view-description]").textContent =
      metadata.share_name || "Tài liệu được chia sẻ";
    root.querySelector("[data-share-view-type]").textContent =
      metadata.file_type.toUpperCase();
    root.querySelector("[data-share-view-updated]").textContent =
      metadata.updated_at
        ? new Intl.DateTimeFormat("vi-VN", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(parseApiDate(metadata.updated_at))
        : "Không rõ";
    renderText(metadata.content || "Tài liệu không có nội dung xem trước.");
    downloadButton.hidden = !metadata.allow_download;
    content.hidden = false;
    setStatus("Tài liệu được chia sẻ an toàn qua NOTE.", "success");
  } catch (error) {
    if (error?.passwordRequired) {
      passwordForm.hidden = false;
      setStatus(error.message, "info");
      passwordForm.querySelector("input").focus();
    } else {
      setStatus(
        error instanceof Error
          ? error.message
          : "Không thể mở tài liệu được chia sẻ.",
        "danger"
      );
    }
  }
};

export const initPublicShare = () => {
  if (!root) return;
  token = new URLSearchParams(location.search).get("token") ?? "";
  if (!/^[A-Za-z0-9_-]{43}$/u.test(token)) {
    setStatus("Liên kết chia sẻ không hợp lệ.", "danger");
    return;
  }

  passwordForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const field = passwordForm.querySelector("input");
    void loadSharedDocument(field.value);
    field.value = "";
  });

  downloadButton.addEventListener("click", async () => {
    try {
      const blob = await api.sharing.downloadPublic(token, password || null);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = safeName(metadata.document_name);
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Không thể tải tài liệu.",
        "danger"
      );
    }
  });

  void loadSharedDocument();
};
