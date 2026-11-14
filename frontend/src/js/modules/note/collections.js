import { addCollection, deleteCollection, getState } from "./store";
import {
  escapeHTML,
  hideModal,
  refreshIcons,
  showModal,
  showToast,
} from "./utils";

export const renderCollections = () => {
  const container = document.querySelector("[data-collections-grid]");
  if (!container) return;

  const state = getState();
  const collections = state.collections || [];

  if (!collections.length) {
    container.innerHTML = `
      <div class="col-12 text-center py-5">
        <i data-lucide="library-big" class="text-body-tertiary mb-3" style="width:48px;height:48px"></i>
        <h5 class="fw-bold">Chưa có bộ sưu tập nào</h5>
        <p class="text-body-secondary small mb-3">Tạo bộ sưu tập để kết hợp đa chiều giữa tài liệu, ghi chú và bộ thẻ ôn tập.</p>
        <button class="btn btn-primary" type="button" data-create-collection-trigger><i data-lucide="plus"></i> Tạo bộ sưu tập đầu tiên</button>
      </div>`;
    refreshIcons(container);
    return;
  }

  container.innerHTML = collections
    .map((col) => {
      const docCount = (col.documentIds || []).length;
      const noteCount = (col.noteIds || []).length;
      const deckCount = (col.deckIds || []).length;
      const tags = (col.tags || [])
        .map(
          (t) =>
            `<span class="badge bg-body-secondary text-body-secondary border small">${escapeHTML(t)}</span>`
        )
        .join(" ");

      return `
        <div class="col-md-6 col-lg-4">
          <div class="card h-100 border-0 shadow-sm p-4 note-interactive-card position-relative overflow-hidden">
            <div class="position-absolute top-0 start-0 end-0" style="height: 4px; background: ${col.color || "#10b981"};"></div>
            <div class="d-flex align-items-center justify-content-between mb-3">
              <span class="p-2 rounded bg-opacity-10" style="background-color: ${col.color || "#10b981"}; color: ${col.color || "#10b981"};">
                <i data-lucide="folder-heart" style="width:20px;height:20px"></i>
              </span>
              <div class="dropdown">
                <button class="btn btn-sm btn-link text-body-secondary p-0" type="button" data-bs-toggle="dropdown">
                  <i data-lucide="ellipsis-vertical" style="width:16px;height:16px"></i>
                </button>
                <ul class="dropdown-menu dropdown-menu-end shadow-sm border small">
                  <li><button class="dropdown-item text-danger d-flex align-items-center gap-2" data-collection-delete="${escapeHTML(col.id)}"><i data-lucide="trash"></i> Xóa bộ sưu tập</button></li>
                </ul>
              </div>
            </div>
            <h5 class="fw-bold mb-2">${escapeHTML(col.name)}</h5>
            <p class="text-body-secondary small flex-grow-1 mb-3">${escapeHTML(col.description || "Chưa có mô tả.")}</p>
            <div class="d-flex flex-wrap gap-1 mb-3">${tags}</div>
            <div class="pt-3 border-top d-flex align-items-center justify-content-between small text-body-secondary">
              <span><i data-lucide="file-text" style="width:14px;height:14px"></i> ${docCount} tài liệu</span>
              <span><i data-lucide="notebook-pen" style="width:14px;height:14px"></i> ${noteCount} ghi chú</span>
              <span><i data-lucide="layers" style="width:14px;height:14px"></i> ${deckCount} bộ thẻ</span>
            </div>
          </div>
        </div>`;
    })
    .join("");

  refreshIcons(container);
};

export const initCollections = () => {
  renderCollections();
  window.addEventListener("note:statechange", renderCollections);
  window.addEventListener("note:viewchange", (e) => {
    if (e.detail.view === "collections") renderCollections();
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-create-collection-trigger]")) {
      const modal = document.querySelector("#collection-modal");
      if (modal) showModal(modal);
      return;
    }

    const deleteBtn = event.target.closest("[data-collection-delete]");
    if (deleteBtn) {
      const colId = deleteBtn.dataset.collectionDelete;
      if (
        confirm(
          "Bạn có chắc chắn muốn xóa bộ sưu tập này? (Các tài liệu và ghi chú bên trong vẫn được giữ nguyên)."
        )
      ) {
        deleteCollection(colId);
        showToast("Đã xóa bộ sưu tập", "info");
      }
    }
  });

  const form = document.querySelector("[data-collection-form]");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const name = formData.get("name")?.toString().trim();
    const description = formData.get("description")?.toString().trim() || "";
    const tagsRaw = formData.get("tags")?.toString().trim() || "";
    const tags = tagsRaw
      ? tagsRaw
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    if (name) {
      addCollection({ name, description, tags });
      form.reset();
      const modal = document.querySelector("#collection-modal");
      if (modal) hideModal(modal);
      showToast(`Đã tạo bộ sưu tập "${name}"`, "success");
    }
  });
};
