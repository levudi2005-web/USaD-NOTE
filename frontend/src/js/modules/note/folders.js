import { addFolder, deleteFolder, getState, updateFolder } from "./store";
import {
  escapeHTML,
  hideModal,
  refreshIcons,
  showModal,
  showToast,
} from "./utils";

let activeFolderId = null;

export const renderFolders = () => {
  const state = getState();
  const folders = state.folders || [];
  const treeContainer = document.querySelector("[data-folder-tree-list]");
  const currentNameEl = document.querySelector("[data-folder-current-name]");
  const currentCountEl = document.querySelector("[data-folder-current-count]");
  const itemsGrid = document.querySelector("[data-folder-items-grid]");
  const parentSelect = document.querySelector("[data-folder-parent-select]");
  const folderFilter = document.querySelector("[data-document-folder-filter]");

  // Update folder filter select in Library
  if (folderFilter) {
    const curVal = folderFilter.value;
    folderFilter.innerHTML = `<option value="">Tất cả thư mục</option>${folders
      .map(
        (f) =>
          `<option value="${escapeHTML(f.id)}">${escapeHTML(f.name)}</option>`
      )
      .join("")}`;
    folderFilter.value = curVal;
  }

  // Update parent select in Modal
  if (parentSelect) {
    parentSelect.innerHTML = `<option value="">(Thư mục gốc - Root)</option>${folders
      .map(
        (f) =>
          `<option value="${escapeHTML(f.id)}">${escapeHTML(f.name)}</option>`
      )
      .join("")}`;
  }

  // Render tree list
  if (treeContainer) {
    treeContainer.innerHTML = `
      <button type="button" class="list-group-item list-group-item-action d-flex align-items-center gap-2 py-2 px-3 border-0 rounded mb-1 ${activeFolderId === null ? "active" : ""}" data-folder-select="">
        <i data-lucide="layers" style="width:16px;height:16px"></i>
        <span class="small fw-semibold">Tất cả tài liệu</span>
        <span class="badge rounded-pill bg-secondary-subtle text-secondary ms-auto small">${(state.documents || []).length}</span>
      </button>
      ${folders
        .map((folder) => {
          const docCount = (state.documents || []).filter(
            (d) => d.folderId === folder.id
          ).length;
          const noteCount = (state.notes || []).filter(
            (n) => n.folderId === folder.id
          ).length;
          const isActive = activeFolderId === folder.id;
          return `
            <button type="button" class="list-group-item list-group-item-action d-flex align-items-center gap-2 py-2 px-3 border-0 rounded mb-1 ${isActive ? "active" : ""}" data-folder-select="${escapeHTML(folder.id)}">
              <i data-lucide="folder" style="width:16px;height:16px" class="text-${escapeHTML(folder.color || "primary")}"></i>
              <span class="small text-truncate flex-grow-1 text-start">${escapeHTML(folder.name)}</span>
              <span class="badge rounded-pill bg-light text-secondary border small">${docCount + noteCount}</span>
            </button>`;
        })
        .join("")}
    `;
    refreshIcons(treeContainer);
  }

  // Render current folder items
  const activeFolder = folders.find((f) => f.id === activeFolderId);
  if (currentNameEl) {
    currentNameEl.textContent = activeFolder
      ? activeFolder.name
      : "Tất cả tài liệu & ghi chú";
  }

  const filteredDocs = activeFolderId
    ? (state.documents || []).filter((d) => d.folderId === activeFolderId)
    : state.documents || [];

  const filteredNotes = activeFolderId
    ? (state.notes || []).filter((n) => n.folderId === activeFolderId)
    : state.notes || [];

  const totalCount = filteredDocs.length + filteredNotes.length;
  if (currentCountEl) {
    currentCountEl.textContent = `${totalCount} mục`;
  }

  if (itemsGrid) {
    if (!totalCount) {
      itemsGrid.innerHTML = `
        <div class="col-12 text-center py-5">
          <i data-lucide="folder-open" class="text-body-tertiary mb-2" style="width:48px;height:48px"></i>
          <p class="text-body-secondary small mb-0">Thư mục này hiện đang trống. Hãy chuyển tài liệu hoặc ghi chú vào đây.</p>
        </div>`;
    } else {
      const docsHtml = filteredDocs
        .map(
          (doc) => `
        <div class="col-md-6 col-lg-4">
          <div class="card h-100 border p-3 shadow-none note-interactive-card" role="button" data-open-document="${escapeHTML(doc.id)}">
            <div class="d-flex align-items-center gap-2 mb-2">
              <span class="p-2 rounded bg-info-subtle text-info"><i data-lucide="file-text" style="width:16px;height:16px"></i></span>
              <span class="badge bg-secondary-subtle text-secondary small">${escapeHTML((doc.type || "file").toUpperCase())}</span>
            </div>
            <strong class="d-block text-truncate small mb-1">${escapeHTML(doc.name)}</strong>
            <small class="text-body-secondary" style="font-size:11px">Tài liệu</small>
          </div>
        </div>
      `
        )
        .join("");

      const notesHtml = filteredNotes
        .map(
          (note) => `
        <div class="col-md-6 col-lg-4">
          <div class="card h-100 border p-3 shadow-none note-interactive-card" role="button" data-open-note="${escapeHTML(note.id)}">
            <div class="d-flex align-items-center gap-2 mb-2">
              <span class="p-2 rounded bg-primary-subtle text-primary"><i data-lucide="notebook-pen" style="width:16px;height:16px"></i></span>
              <span class="badge bg-light text-secondary border small">${escapeHTML(note.category || "Ghi chú")}</span>
            </div>
            <strong class="d-block text-truncate small mb-1">${escapeHTML(note.title)}</strong>
            <small class="text-body-secondary" style="font-size:11px">Ghi chú</small>
          </div>
        </div>
      `
        )
        .join("");

      itemsGrid.innerHTML = docsHtml + notesHtml;
    }
    refreshIcons(itemsGrid);
  }
};

export const initFolders = () => {
  renderFolders();
  window.addEventListener("note:statechange", renderFolders);
  window.addEventListener("note:viewchange", (e) => {
    if (e.detail.view === "folders") renderFolders();
  });

  document.addEventListener("click", (event) => {
    // Select Folder
    const folderSelect = event.target.closest("[data-folder-select]");
    if (folderSelect) {
      activeFolderId = folderSelect.dataset.folderSelect || null;
      renderFolders();
      return;
    }

    // Trigger Create Folder Modal
    if (event.target.closest("[data-create-folder-trigger]")) {
      const modal = document.querySelector("#folder-modal");
      if (modal) showModal(modal);
      return;
    }

    // Rename Folder
    if (event.target.closest("[data-folder-rename-btn]")) {
      if (!activeFolderId) {
        showToast("Vui lòng chọn một thư mục cụ thể để đổi tên", "warning");
        return;
      }
      const folder = getState().folders?.find((f) => f.id === activeFolderId);
      if (folder) {
        const newName = prompt("Nhập tên mới cho thư mục:", folder.name);
        if (newName && newName.trim()) {
          updateFolder(activeFolderId, { name: newName.trim() });
          showToast(`Đã đổi tên thành "${newName.trim()}"`, "success");
        }
      }
      return;
    }

    // Delete Folder
    if (event.target.closest("[data-folder-delete-btn]")) {
      if (!activeFolderId) {
        showToast("Vui lòng chọn một thư mục cụ thể để xóa", "warning");
        return;
      }
      if (
        confirm(
          "Bạn có chắc chắn muốn xóa thư mục này? Các tài liệu bên trong sẽ được đưa ra thư mục gốc."
        )
      ) {
        deleteFolder(activeFolderId);
        activeFolderId = null;
        showToast("Đã xóa thư mục", "info");
      }
    }
  });

  // Submit Folder Form
  const form = document.querySelector("[data-folder-form]");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const name = formData.get("name")?.toString().trim();
    const parentId = formData.get("parentId")?.toString().trim() || null;
    const color = formData.get("color")?.toString().trim() || "emerald";

    if (name) {
      const created = addFolder({ name, parentId, color });
      form.reset();
      const modal = document.querySelector("#folder-modal");
      if (modal) hideModal(modal);
      activeFolderId = created.id;
      showToast(`Đã tạo thư mục "${name}"`, "success");
    }
  });
};
