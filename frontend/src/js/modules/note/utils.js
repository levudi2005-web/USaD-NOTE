import { Modal } from "bootstrap";
import { escapeHTML } from "./html-escape";

export { escapeHTML };

export const formatDate = (value, options = {}) => {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "numeric",
    month: "short",
    ...options,
  }).format(date);
};

export const formatDateTime = (value) =>
  formatDate(value, { hour: "2-digit", minute: "2-digit" });

export const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const showToast = (message, tone = "info") => {
  const region = document.querySelector("[data-toast-region]");
  if (!region) return;
  const toast = document.createElement("div");
  toast.className = `note-toast note-toast-${tone}`;
  toast.setAttribute("role", "status");
  const text = document.createElement("span");
  text.textContent = message;
  const close = document.createElement("button");
  close.type = "button";
  close.setAttribute("aria-label", "Đóng thông báo");
  close.textContent = "×";
  close.addEventListener("click", () => toast.remove());
  toast.append(text, close);
  region.append(toast);
  window.setTimeout(() => toast.remove(), 4800);
};

export const showModal = (id) => {
  const element = document.getElementById(id);
  if (element) Modal.getOrCreateInstance(element).show();
};

export const hideModal = (id) => {
  const element = document.getElementById(id);
  if (element) Modal.getInstance(element)?.hide();
};

export const refreshIcons = (root = document) => {
  window.lucide?.createIcons({ root });
};

export const safeContent = (html) => {
  const template = document.createElement("template");
  template.innerHTML = html ?? "";
  const allowed = new Set([
    "B",
    "BLOCKQUOTE",
    "BR",
    "EM",
    "H2",
    "H3",
    "I",
    "LI",
    "OL",
    "P",
    "STRONG",
    "U",
    "UL",
  ]);
  const clean = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        clean(child);
        if (!allowed.has(child.tagName)) {
          child.replaceWith(...child.childNodes);
        } else {
          for (const attribute of [...child.attributes]) {
            child.removeAttribute(attribute.name);
          }
        }
      } else if (child.nodeType !== Node.TEXT_NODE) {
        child.remove();
      }
    }
  };
  clean(template.content);
  return template.innerHTML;
};
