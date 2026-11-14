import {
  addNote,
  deleteNote,
  getState,
  toggleNoteFlag,
  updateNote,
} from "./store";
import {
  escapeHTML,
  formatDateTime,
  hideModal,
  refreshIcons,
  safeContent,
  showModal,
  showToast,
} from "./utils";

let selectedId = null;
let listLayout = "list";

const getFilteredNotes = () => {
  const search = document
    .querySelector("[data-note-search]")
    ?.value.trim()
    .toLocaleLowerCase();
  const category = document.querySelector("[data-note-category]")?.value;
  const tag = document.querySelector("[data-note-tag]")?.value;
  return getState()
    .notes.filter((note) => {
      const text = `${note.title} ${note.content}`
        .replace(/<[^>]*>/g, " ")
        .toLocaleLowerCase();
      return (
        (!search || text.includes(search)) &&
        (!category || note.category === category) &&
        (!tag || note.tags.includes(tag))
      );
    })
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        new Date(b.updatedAt) - new Date(a.updatedAt)
    );
};

const renderFilters = () => {
  const state = getState();
  const categorySelect = document.querySelector("[data-note-category]");
  const tagSelect = document.querySelector("[data-note-tag]");
  const updateOptions = (select, values, placeholder) => {
    if (!select) return;
    const current = select.value;
    select.innerHTML = `<option value="">${placeholder}</option>${values
      .map(
        (value) =>
          `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`
      )
      .join("")}`;
    if (values.includes(current)) select.value = current;
  };
  updateOptions(
    categorySelect,
    [...new Set(state.notes.map((note) => note.category))].sort(),
    "Tất cả danh mục"
  );
  updateOptions(
    tagSelect,
    [...new Set(state.notes.flatMap((note) => note.tags))].sort(),
    "Tất cả tag"
  );
};

const renderNoteList = () => {
  const list = document.querySelector("[data-note-list]");
  if (!list) return;
  const notes = getFilteredNotes();
  const count = document.querySelector("[data-note-count]");
  if (count) count.textContent = `${notes.length} ghi chú`;
  list.classList.toggle("note-list-grid", listLayout === "grid");
  if (!notes.some((note) => note.id === selectedId)) {
    selectedId = notes[0]?.id ?? null;
  }
  list.innerHTML = notes.length
    ? notes
        .map(
          (note) => `
            <article class="note-list-item ${note.id === selectedId ? "active" : ""}" data-note-row="${escapeHTML(note.id)}">
              <button class="note-list-select" type="button" data-note-select="${escapeHTML(note.id)}">
                <span class="note-list-title">${escapeHTML(note.title)}</span>
                <span class="note-list-snippet">${escapeHTML(
                  note.content
                    .replace(/<[^>]*>/g, " ")
                    .trim()
                    .slice(0, 100)
                )}</span>
                <span class="note-list-meta"><span>${escapeHTML(note.category)}</span><time>${escapeHTML(formatDateTime(note.updatedAt))}</time></span>
                <span class="note-list-tags">${note.tags
                  .slice(0, 3)
                  .map((tag) => `<span>${escapeHTML(tag)}</span>`)
                  .join(
                    ""
                  )}${note.isDemo ? '<span class="note-demo-label">Mẫu</span>' : ""}</span>
              </button>
              <div class="note-list-flags">
                ${note.pinned ? '<span aria-label="Đã ghim"><i data-lucide="pin"></i></span>' : ""}
                ${note.favorite ? '<span aria-label="Yêu thích"><i data-lucide="star"></i></span>' : ""}
              </div>
            </article>`
        )
        .join("")
    : `<div class="note-empty-state note-list-empty"><h2>Chưa có ghi chú phù hợp</h2><p>Thử đổi bộ lọc hoặc tạo ghi chú mới.</p><button class="btn btn-sm btn-primary" type="button" data-note-create><i data-lucide="plus"></i> Ghi chú mới</button></div>`;
  refreshIcons(list);
  renderSelectedNote();
};

const renderSelectedNote = () => {
  const panel = document.querySelector("[data-note-editor]");
  if (!panel) return;
  const note = getState().notes.find((item) => item.id === selectedId);
  if (!note) {
    panel.innerHTML = `<div class="note-empty-state"><span class="note-empty-icon"><i data-lucide="notebook-pen"></i></span><h2>Chọn một ghi chú</h2><p>Hoặc tạo ghi chú mới để bắt đầu.</p><button class="btn btn-primary" type="button" data-note-create><i data-lucide="plus"></i> Tạo ghi chú</button></div>`;
    refreshIcons(panel);
    return;
  }
  panel.innerHTML = `
    <header class="note-editor-header">
      <div><span class="note-editor-category">${escapeHTML(note.category)}</span><h2>${escapeHTML(note.title)}</h2><p>Cập nhật ${escapeHTML(formatDateTime(note.updatedAt))}${note.isDemo ? ' · <span class="note-demo-label">Nội dung mẫu</span>' : ""}</p></div>
      <div class="note-editor-actions">
        <button class="btn btn-sm btn-outline-secondary" type="button" data-note-flag="pinned" data-id="${escapeHTML(note.id)}" aria-label="${note.pinned ? "Bỏ ghim" : "Ghim ghi chú"}"><i data-lucide="pin"></i></button>
        <button class="btn btn-sm btn-outline-secondary" type="button" data-note-flag="favorite" data-id="${escapeHTML(note.id)}" aria-label="${note.favorite ? "Bỏ yêu thích" : "Yêu thích"}"><i data-lucide="star"></i></button>
        <button class="btn btn-sm btn-outline-secondary" type="button" data-note-edit="${escapeHTML(note.id)}"><i data-lucide="pen"></i><span>Sửa</span></button>
        <button class="btn btn-sm btn-outline-danger" type="button" data-note-delete="${escapeHTML(note.id)}" aria-label="Xóa ghi chú"><i data-lucide="trash"></i></button>
      </div>
    </header>
    <div class="note-editor-tags">${note.tags.map((tag) => `<span class="note-tag">${escapeHTML(tag)}</span>`).join("")}</div>
    <div class="note-editor-content">${safeContent(note.content)}</div>
    <footer class="note-editor-footer"><span><i data-lucide="hard-drive"></i> Lưu trên thiết bị này khi nhấn Lưu</span><button class="btn btn-sm btn-link" type="button" data-view-button="graph"><i data-lucide="network"></i> Xem trên bản đồ kiến thức</button></footer>`;
  refreshIcons(panel);
};

const openEditor = (note = null) => {
  const form = document.querySelector("[data-note-form]");
  if (!form) return;
  form.reset();
  form.elements.id.value = note?.id ?? "";
  form.elements.title.value = note?.title ?? "";
  form.elements.category.value = note?.category ?? "";
  form.elements.tags.value = note?.tags.join(", ") ?? "";
  document.querySelector("[data-note-content-editor]").innerHTML =
    note?.content ?? "<p><br></p>";
  document.querySelector("#note-modal-title").textContent = note
    ? "Chỉnh sửa ghi chú"
    : "Ghi chú mới";
  showModal("note-editor-modal");
  document
    .querySelector("[data-note-content-editor]")
    .focus({ preventScroll: true });
};

export const renderNotes = () => {
  renderFilters();
  renderNoteList();
};

export const initNotes = () => {
  document
    .querySelector("[data-note-search]")
    ?.addEventListener("input", renderNotes);
  document
    .querySelector("[data-note-category]")
    ?.addEventListener("change", renderNotes);
  document
    .querySelector("[data-note-tag]")
    ?.addEventListener("change", renderNotes);

  document.querySelectorAll("[data-note-layout]").forEach((button) => {
    button.addEventListener("click", () => {
      listLayout = button.dataset.noteLayout;
      document
        .querySelectorAll("[data-note-layout]")
        .forEach((item) => item.classList.toggle("active", item === button));
      renderNoteList();
    });
  });

  document.addEventListener("click", (event) => {
    const select = event.target.closest("[data-note-select]");
    if (select) {
      selectedId = select.dataset.noteSelect;
      renderNoteList();
      return;
    }
    const flag = event.target.closest("[data-note-flag]");
    if (flag) {
      toggleNoteFlag(flag.dataset.id, flag.dataset.noteFlag);
      return;
    }
    const edit = event.target.closest("[data-note-edit]");
    if (edit) {
      openEditor(
        getState().notes.find((note) => note.id === edit.dataset.noteEdit)
      );
      return;
    }
    const remove = event.target.closest("[data-note-delete]");
    if (remove) {
      const note = getState().notes.find(
        (item) => item.id === remove.dataset.noteDelete
      );
      if (note && window.confirm(`Xóa ghi chú “${note.title}”?`)) {
        deleteNote(note.id);
        selectedId = null;
        showToast("Đã xóa ghi chú.", "success");
      }
    }
  });

  window.addEventListener("note:create-request", () => openEditor());
  window.addEventListener("note:open", (event) => {
    selectedId = event.detail.id;
    renderNoteList();
  });
  window.addEventListener("note:statechange", renderNotes);

  document
    .querySelector("[data-note-form]")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const title = form.elements.title.value.trim();
      if (!title) {
        showToast("Vui lòng nhập tiêu đề ghi chú.", "warning");
        return;
      }
      const note = {
        title,
        category: form.elements.category.value.trim() || "Chưa phân loại",
        tags: form.elements.tags.value
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
          .slice(0, 12),
        content: safeContent(
          document.querySelector("[data-note-content-editor]").innerHTML
        ),
      };
      const id = form.elements.id.value;
      if (id) {
        updateNote(id, note);
        selectedId = id;
        showToast("Đã lưu thay đổi ghi chú.", "success");
      } else {
        selectedId = addNote(note).id;
        showToast("Đã tạo ghi chú mới.", "success");
      }
      hideModal("note-editor-modal");
      window.location.hash = "notes";
    });

  document.querySelectorAll("[data-format]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelector("[data-note-content-editor]").focus();
      document.execCommand(button.dataset.format, false);
    });
  });

  renderNotes();
};
