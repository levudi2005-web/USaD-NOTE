import {
  getState,
  markAllNotificationsRead,
  markNotificationRead,
} from "./store";
import { escapeHTML, refreshIcons, showToast } from "./utils";

export const viewNames = {
  dashboard: "Tổng quan",
  library: "Thư viện tài liệu",
  folders: "Thư mục",
  collections: "Bộ sưu tập",
  archives: "ZIP / 7Z",
  assistant: "AI Assistant",
  "ai-context": "AI Context",
  flashcards: "Flashcards",
  quiz: "Quiz",
  "ai-workflows": "Quy trình AI",
  sharing: "Chia sẻ",
  settings: "Cài đặt",
  // Aliases & Sub-views
  notes: "Ghi chú",
  graph: "Bản đồ kiến thức",
  search: "Tìm kiếm",
  summarizer: "Tóm tắt tài liệu",
  "document-chat": "Hỏi đáp tài liệu",
  translator: "Dịch và giải thích",
  "learning-generator": "Tạo nội dung học tập",
  planner: "Kế hoạch học tập",
  progress: "Tiến độ học tập",
};

export const getView = () => {
  const hash = window.location.hash.slice(1).split("?")[0];
  return viewNames[hash] ? hash : "dashboard";
};

export const setView = () => {
  const view = getView();
  document.body.dataset.noteView = view;
  document.querySelectorAll("[data-view-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.viewPanel !== view;
  });
  document.querySelectorAll("[data-view-link]").forEach((link) => {
    const active = link.dataset.viewLink === view;
    link.classList.toggle("active", active);
    if (active && link.matches(".sidebar-link")) {
      link.closest(".sidebar-item")?.classList.add("active");
    } else if (link.matches(".sidebar-link")) {
      link.closest(".sidebar-item")?.classList.remove("active");
    }
  });
  const breadcrumb = document.querySelector("[data-breadcrumb]");
  if (breadcrumb) breadcrumb.textContent = viewNames[view];
  document.title = `${viewNames[view]} | NOTE`;
  window.dispatchEvent(
    new CustomEvent("note:viewchange", { detail: { view } })
  );
};

export const renderNotifications = () => {
  const state = getState();
  const list = document.querySelector("[data-notification-list]");
  const badge = document.querySelector("[data-notification-badge]");
  if (!list) return;

  const notifications = state.notifications || [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  if (badge) {
    badge.hidden = unreadCount === 0;
  }

  if (!notifications.length) {
    list.innerHTML = `<div class="p-4 text-center text-body-secondary small">Không có thông báo mới</div>`;
    return;
  }

  list.innerHTML = notifications
    .map(
      (n) => `
      <div class="list-group-item list-group-item-action d-flex align-items-start gap-2 py-2 px-3 ${n.read ? "opacity-75" : "bg-body-secondary bg-opacity-25"}" data-notif-item="${escapeHTML(n.id)}">
        <span class="p-1 rounded bg-primary-subtle text-primary mt-1">
          <i data-lucide="bell" style="width:14px;height:14px"></i>
        </span>
        <div class="flex-grow-1 overflow-hidden">
          <strong class="d-block text-truncate small">${escapeHTML(n.title)}</strong>
          <span class="d-block text-body-secondary text-truncate" style="font-size:11px">${escapeHTML(n.text)}</span>
          <small class="text-body-tertiary" style="font-size:10px">${escapeHTML(n.time)}</small>
        </div>
        ${!n.read ? `<span class="badge rounded-pill bg-primary p-1 mt-2" title="Chưa đọc"></span>` : ""}
      </div>`
    )
    .join("");

  refreshIcons(list);
};

export const initNavigation = () => {
  window.addEventListener("hashchange", setView);
  document.addEventListener("click", (event) => {
    const viewButton = event.target.closest("[data-view-button]");
    if (viewButton) {
      window.location.hash = viewButton.dataset.viewButton;
      return;
    }
    if (event.target.closest("[data-note-create]")) {
      window.dispatchEvent(new CustomEvent("note:create-request"));
    }
    if (event.target.closest("[data-notification-mark-all]")) {
      markAllNotificationsRead();
      renderNotifications();
      showToast("Đã đánh dấu đọc tất cả thông báo", "success");
    }
    const notifItem = event.target.closest("[data-notif-item]");
    if (notifItem) {
      markNotificationRead(notifItem.dataset.notifItem);
      renderNotifications();
    }
    if (event.target.closest("[data-action-reset-cache]")) {
      showToast("Đã xóa bộ nhớ đệm tạm thời", "info");
    }
  });

  const globalSearch = document.querySelector("[data-global-search]");
  globalSearch?.addEventListener("input", () => {
    window.dispatchEvent(
      new CustomEvent("note:global-search", {
        detail: { query: globalSearch.value.trim() },
      })
    );
  });
  globalSearch?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && globalSearch.value.trim()) {
      window.location.hash = "search";
      const searchInput = document.querySelector("[data-search-query]");
      if (searchInput) searchInput.value = globalSearch.value.trim();
      window.dispatchEvent(
        new CustomEvent("note:search-query", {
          detail: { query: globalSearch.value.trim() },
        })
      );
    }
  });
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      globalSearch?.focus();
    }
  });

  document
    .querySelector("[data-export-data]")
    ?.addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(getState(), null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "note-data.json";
      anchor.click();
      URL.revokeObjectURL(url);
      showToast("Đã xuất dữ liệu hiện có trong trình duyệt.", "success");
    });

  renderNotifications();
  setView();
};

export const renderSearch = (query = "") => {
  const results = document.querySelector("[data-search-results]");
  if (!results) return;
  const normalized = query.toLocaleLowerCase();
  const state = getState();
  const notes = (state.notes || [])
    .filter((note) =>
      `${note.title} ${note.category} ${note.tags.join(" ")} ${note.content}`
        .replace(/<[^>]*>/g, " ")
        .toLocaleLowerCase()
        .includes(normalized)
    )
    .map(
      (note) => `
        <button class="note-search-result list-group-item list-group-item-action d-flex align-items-center gap-3 p-3 border rounded mb-2" type="button" data-open-note="${escapeHTML(note.id)}">
          <span class="note-search-result-icon p-2 rounded bg-primary-subtle text-primary"><i data-lucide="notebook-pen"></i></span>
          <span class="flex-grow-1 text-start"><strong class="d-block">${escapeHTML(note.title)}</strong><small class="text-body-secondary">Ghi chú · ${escapeHTML(note.category)}</small></span>
          ${note.isDemo ? '<span class="badge bg-secondary-subtle text-secondary">Mẫu</span>' : ""}
        </button>`
    );
  const documents = (state.documents || [])
    .filter((document) =>
      document.name.toLocaleLowerCase().includes(normalized)
    )
    .map(
      (document) => `
        <button class="note-search-result list-group-item list-group-item-action d-flex align-items-center gap-3 p-3 border rounded mb-2" type="button" data-open-document="${escapeHTML(document.id)}">
          <span class="note-search-result-icon p-2 rounded bg-info-subtle text-info"><i data-lucide="file-text"></i></span>
          <span class="flex-grow-1 text-start"><strong class="d-block">${escapeHTML(document.name)}</strong><small class="text-body-secondary">Tài liệu · ${escapeHTML(document.type.toUpperCase())}</small></span>
          ${document.isDemo ? '<span class="badge bg-secondary-subtle text-secondary">Mẫu</span>' : ""}
        </button>`
    );
  const archives = (state.archives || [])
    .filter((arch) => arch.name.toLocaleLowerCase().includes(normalized))
    .map(
      (arch) => `
        <button class="note-search-result list-group-item list-group-item-action d-flex align-items-center gap-3 p-3 border rounded mb-2" type="button" data-open-archive="${escapeHTML(arch.id)}">
          <span class="note-search-result-icon p-2 rounded bg-warning-subtle text-warning"><i data-lucide="archive"></i></span>
          <span class="flex-grow-1 text-start"><strong class="d-block">${escapeHTML(arch.name)}</strong><small class="text-body-secondary">Gói nén · ${arch.fileCount} tệp</small></span>
          <span class="badge bg-secondary-subtle text-secondary">ZIP</span>
        </button>`
    );

  const allResults = [...notes, ...documents, ...archives];
  results.innerHTML = normalized
    ? allResults.length
      ? `<p class="note-search-count small text-body-secondary mb-3">${allResults.length} kết quả tìm thấy cho “${escapeHTML(query)}”</p><div class="list-group">${allResults.join("")}</div>`
      : `<div class="note-empty-state text-center p-5"><i data-lucide="search-x" class="text-body-tertiary mb-3" style="width:48px;height:48px"></i><h4 class="fw-bold">Không tìm thấy kết quả</h4><p class="text-body-secondary">Hãy thử tìm với từ khóa khác.</p></div>`
    : `<div class="note-empty-state text-center p-5"><i data-lucide="search" class="text-body-tertiary mb-3" style="width:48px;height:48px"></i><h4 class="fw-bold">Tìm trong toàn bộ không gian</h4><p class="text-body-secondary">Nhập từ khóa để tra cứu ghi chú, tài liệu, và gói nén.</p></div>`;
  refreshIcons(results);
};

export const activateSearch = () => {
  const input = document.querySelector("[data-search-query]");
  const search = (query = "") => renderSearch(query);
  input?.addEventListener("input", () => search(input.value.trim()));
  window.addEventListener("note:search-query", (event) =>
    search(event.detail.query)
  );
  window.addEventListener("note:global-search", (event) => {
    if (getView() === "search") {
      if (input) input.value = event.detail.query;
      search(event.detail.query);
    }
  });
  document.addEventListener("click", (event) => {
    const noteButton = event.target.closest("[data-open-note]");
    if (noteButton) {
      window.dispatchEvent(
        new CustomEvent("note:open", {
          detail: { id: noteButton.dataset.openNote },
        })
      );
      window.location.hash = "notes";
      return;
    }
    const documentButton = event.target.closest("[data-open-document]");
    if (documentButton) {
      window.dispatchEvent(
        new CustomEvent("note:open-document", {
          detail: { id: documentButton.dataset.openDocument },
        })
      );
      window.location.hash = "library";
      return;
    }
    const archiveButton = event.target.closest("[data-open-archive]");
    if (archiveButton) {
      window.dispatchEvent(
        new CustomEvent("note:open-archive", {
          detail: { id: archiveButton.dataset.openArchive },
        })
      );
      window.location.hash = "archives";
    }
  });
};
