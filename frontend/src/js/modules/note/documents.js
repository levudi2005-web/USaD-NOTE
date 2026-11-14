import { addDocument, getState, removeDocument, updateDocument } from "./store";
import api from "./api";
import {
  deleteDocumentRecord,
  getDocumentRecord,
  saveDocumentRecord,
} from "./documents/indexed-storage";
import {
  detectFileType,
  readDocument,
  searchInDocument,
  validateFile,
} from "./documents/document-engine";
import { deleteSharedDocumentForLocalDelete } from "./sharing/manage";
import {
  escapeHTML,
  formatBytes,
  formatDateTime,
  refreshIcons,
  showToast,
} from "./utils";

const formatLabels = {
  pdf: "PDF",
  docx: "DOCX",
  xlsx: "XLSX",
  xls: "XLS",
  csv: "CSV",
  pptx: "PPTX",
  epub: "EPUB",
  md: "Markdown",
  txt: "TXT",
  image: "Ảnh",
};

const sessionDocuments = new Map();
const processing = new Map();
const imageUrls = new Map();
let selectedId = null;
let renderedId = null;
let previewVersion = 0;
let activePdfReader = null;

const rootElement = () => document.querySelector("[data-document-library]");
const listElement = () => document.querySelector("[data-document-list]");
const previewElement = () => document.querySelector("[data-document-preview]");

const setLibraryStatus = (message = "", tone = "info") => {
  const status = document.querySelector("[data-document-status]");
  if (!status) return;
  status.hidden = !message;
  status.textContent = message;
  status.dataset.tone = tone;
};

const getFilterValues = () => ({
  query:
    document
      .querySelector("[data-document-search]")
      ?.value.trim()
      .toLocaleLowerCase() ?? "",
  type: document.querySelector("[data-document-type]")?.value ?? "",
});

const matchesType = (documentItem, selectedType) => {
  if (!selectedType) return true;
  if (selectedType === "image") return documentItem.type === "image";
  return documentItem.type === selectedType;
};

const getVisibleDocuments = () => {
  const { query, type } = getFilterValues();
  return [...getState().documents]
    .filter((item) => matchesType(item, type))
    .filter((item) => item.name.toLocaleLowerCase().includes(query))
    .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
};

const statusLabel = (item) => {
  const current = processing.get(item.id);
  if (current) return current.message || "Đang xử lý…";
  if (item.status === "error") return "Không đọc được";
  if (item.status === "processing") return "Đang xử lý…";
  if (item.readerStatus === "pending") return "Chờ nhận diện chữ";
  if (item.isDemo) return "Dữ liệu mẫu";
  return "Sẵn sàng";
};

const renderList = () => {
  const list = listElement();
  if (!list) return;
  const documents = getVisibleDocuments();
  if (!documents.some((item) => item.id === selectedId)) {
    selectedId = documents[0]?.id ?? null;
  }
  if (!documents.length) {
    list.innerHTML = `<div class="note-empty-state"><i data-lucide="file-text"></i><strong>Chưa có tài liệu phù hợp</strong><span>Thêm tệp hoặc thay đổi điều kiện tìm kiếm.</span></div>`;
  } else {
    list.innerHTML = documents
      .map((item) => {
        const label = formatLabels[item.type] || item.type.toUpperCase();
        const current = processing.get(item.id);
        const rowStatus = current
          ? current.message
          : item.status === "error"
            ? "Lỗi khi đọc"
            : item.readerStatus === "pending"
              ? "OCR chưa chạy"
              : item.isDemo
                ? "Mẫu"
                : formatDateTime(item.addedAt);
        return `
          <article class="note-document-row${item.id === selectedId ? " is-active" : ""}" data-document-row="${escapeHTML(item.id)}">
            <button class="note-document-select" type="button" data-document-select="${escapeHTML(item.id)}" aria-pressed="${item.id === selectedId}">
              <span class="note-document-file-icon"><i data-lucide="file-text"></i></span>
              <span class="note-document-row-copy">
                <strong title="${escapeHTML(item.name)}">${escapeHTML(item.name)}</strong>
                <span>${label} · ${formatBytes(item.size)} · ${escapeHTML(rowStatus)}</span>
              </span>
            </button>
            ${
              item.isDemo
                ? `<span class="note-document-demo-badge">Mẫu</span>`
                : `<div class="note-document-row-actions"><button class="note-icon-button" type="button" data-document-share="${escapeHTML(item.id)}" aria-label="Chia sẻ ${escapeHTML(item.name)}" title="Chia sẻ tài liệu"><i data-lucide="share-2"></i></button><button class="note-icon-button" type="button" data-document-remove="${escapeHTML(item.id)}" aria-label="Xóa ${escapeHTML(item.name)}" title="Xóa tài liệu"><i data-lucide="trash"></i></button></div>`
            }
          </article>`;
      })
      .join("");
  }
  refreshIcons(list);
  if (selectedId !== renderedId) void renderPreview();
};

const createReaderHeader = (item, result) => {
  const header = document.createElement("header");
  header.className = "note-document-reader-header";
  const details = document.createElement("div");
  const format = document.createElement("span");
  format.className = "note-eyebrow";
  format.textContent = `${formatLabels[item.type] || item.type.toUpperCase()} · ${formatBytes(item.size)}`;
  const title = document.createElement("h2");
  title.textContent = item.name;
  const meta = document.createElement("p");
  meta.textContent = `Được thêm ${formatDateTime(item.addedAt)} · ${
    item.isDemo ? "Tài liệu mẫu" : statusLabel(item)
  }`;
  details.append(format, title, meta);

  const actions = document.createElement("div");
  actions.className =
    "note-document-reader-actions d-flex align-items-center gap-2";
  const zenButton = document.createElement("button");
  zenButton.type = "button";
  zenButton.className = "btn btn-sm btn-primary";
  zenButton.dataset.openZenReader = item.id;
  zenButton.innerHTML = `<i data-lucide="book-open"></i> <span>Đọc chuyên sâu</span>`;
  actions.append(zenButton);

  if (!item.isDemo) {
    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "btn btn-sm btn-outline-secondary";
    copyButton.dataset.documentCopy = item.id;
    copyButton.innerHTML = `<i data-lucide="copy"></i><span>Sao chép</span>`;
    copyButton.disabled = !result?.text;
    actions.append(copyButton);
  }
  header.append(details, actions);
  return header;
};

const copyText = async (text) => {
  if (!text) {
    showToast("Tài liệu chưa có nội dung văn bản để sao chép.", "warning");
    return;
  }
  if (!navigator.clipboard?.writeText) {
    showToast(
      "Trình duyệt hiện tại không cho phép truy cập clipboard.",
      "warning"
    );
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast("Đã sao chép nội dung trích xuất.", "success");
  } catch (error) {
    showToast(
      error instanceof Error
        ? `Không thể sao chép: ${error.message}`
        : "Không thể sao chép nội dung.",
      "danger"
    );
  }
};

const makeSearchResults = (container, result, keyword) => {
  container.replaceChildren();
  if (!keyword.trim()) return;
  const { total, matches } = searchInDocument(result, keyword);
  const summary = document.createElement("p");
  summary.className = "note-document-search-summary";
  summary.textContent = total
    ? `Tìm thấy ${total} kết quả${total > matches.length ? ` · hiển thị ${matches.length}` : ""}.`
    : "Không tìm thấy nội dung khớp.";
  container.append(summary);
  if (!matches.length) return;
  const list = document.createElement("ul");
  list.className = "note-document-search-results";
  for (const match of matches) {
    const row = document.createElement("li");
    const label = document.createElement("strong");
    label.textContent = match.label || "Nội dung";
    const excerpt = document.createElement("span");
    excerpt.textContent = match.excerpt;
    row.append(label, excerpt);
    list.append(row);
  }
  container.append(list);
};

const createReaderShell = (host, result) => {
  const shell = document.createElement("div");
  shell.className = "note-document-reader-shell";
  const toolbar = document.createElement("div");
  toolbar.className = "note-document-reader-toolbar";
  const search = document.createElement("input");
  search.type = "search";
  search.className = "form-control";
  search.placeholder = "Tìm nội dung trong tài liệu…";
  search.setAttribute("aria-label", "Tìm nội dung trong tài liệu");
  const matches = document.createElement("div");
  matches.className = "note-document-search-matches";
  search.addEventListener("input", () =>
    makeSearchResults(matches, result, search.value)
  );
  toolbar.append(search);
  shell.append(toolbar, matches);
  const content = document.createElement("div");
  content.className = "note-document-content";
  shell.append(content);
  host.append(shell);
  return { content };
};

const renderSpreadsheet = (host, result) => {
  const { content } = createReaderShell(host, result);
  const selectLabel = document.createElement("label");
  selectLabel.className = "note-spreadsheet-select";
  selectLabel.textContent = "Trang tính";
  const select = document.createElement("select");
  select.className = "form-select";
  select.setAttribute("aria-label", "Chọn trang tính");
  for (const sheet of result.sheets || []) {
    const option = document.createElement("option");
    option.value = String(sheet.index);
    option.textContent = sheet.name;
    select.append(option);
  }
  selectLabel.append(select);
  const tableRegion = document.createElement("div");
  tableRegion.className = "note-spreadsheet-scroll";
  const renderSheet = () => {
    const sheet = result.sheets?.[Number(select.value)];
    tableRegion.replaceChildren();
    if (!sheet) return;
    const table = document.createElement("table");
    table.className = "table table-sm note-spreadsheet-table";
    const body = document.createElement("tbody");
    for (const [rowIndex, row] of sheet.rows.entries()) {
      const tr = document.createElement("tr");
      for (const value of row) {
        const cell = document.createElement(rowIndex === 0 ? "th" : "td");
        if (rowIndex === 0) cell.scope = "col";
        cell.textContent = value;
        tr.append(cell);
      }
      body.append(tr);
    }
    table.append(body);
    tableRegion.append(table);
    if (sheet.truncated) {
      const warning = document.createElement("p");
      warning.className = "note-document-warning";
      warning.textContent = `Đã giới hạn phần xem trước của trang tính “${sheet.name}” để tránh làm chậm trình duyệt.`;
      tableRegion.append(warning);
    }
  };
  select.addEventListener("change", renderSheet);
  content.append(selectLabel, tableRegion);
  renderSheet();
};

const renderSlides = (host, result) => {
  const { content } = createReaderShell(host, result);
  const selectLabel = document.createElement("label");
  selectLabel.className = "note-spreadsheet-select";
  selectLabel.textContent = "Slide";
  const select = document.createElement("select");
  select.className = "form-select";
  select.setAttribute("aria-label", "Chọn slide");
  for (const slide of result.slides || []) {
    const option = document.createElement("option");
    option.value = String(slide.index);
    option.textContent = slide.label;
    select.append(option);
  }
  selectLabel.append(select);
  const slideContent = document.createElement("article");
  slideContent.className = "note-slide-content";
  const renderSlide = () => {
    const slide = result.slides?.[Number(select.value)];
    slideContent.textContent = slide?.text || "Slide này không có văn bản.";
    slideContent.dataset.empty = String(!slide?.text);
  };
  select.addEventListener("change", renderSlide);
  content.append(selectLabel, slideContent);
  renderSlide();
};

const renderChapters = (host, result) => {
  const { content } = createReaderShell(host, result);
  const selectLabel = document.createElement("label");
  selectLabel.className = "note-spreadsheet-select";
  selectLabel.textContent = "Chương";
  const select = document.createElement("select");
  select.className = "form-select";
  select.setAttribute("aria-label", "Chọn chương");
  for (const chapter of result.chapters || []) {
    const option = document.createElement("option");
    option.value = String(chapter.index);
    option.textContent = chapter.label;
    select.append(option);
  }
  selectLabel.append(select);
  const chapterContent = document.createElement("article");
  chapterContent.className = "note-epub-content";
  const renderChapter = () => {
    const chapter = result.chapters?.[Number(select.value)];
    chapterContent.innerHTML = chapter?.html || escapeHTML(chapter?.text ?? "");
  };
  select.addEventListener("change", renderChapter);
  content.append(selectLabel, chapterContent);
  renderChapter();
};

const renderOcr = (target, result) => {
  if (!result?.text) return;
  const extracted = document.createElement("section");
  extracted.className = "note-document-ocr-result";
  const heading = document.createElement("h3");
  heading.textContent = "Văn bản nhận diện";
  const text = document.createElement("pre");
  text.textContent = result.text;
  extracted.append(heading, text);
  target.append(extracted);
};

const renderImageReader = (host, item, file, result) => {
  const section = document.createElement("section");
  section.className = "note-image-reader";
  const image = document.createElement("img");
  image.alt = `Xem trước ${item.name}`;
  image.loading = "lazy";
  if (!imageUrls.has(item.id)) {
    imageUrls.set(item.id, URL.createObjectURL(file));
  }
  image.src = imageUrls.get(item.id);
  const copy = document.createElement("p");
  copy.textContent =
    "Hình ảnh được xử lý cục bộ. OCR chỉ chạy sau khi bạn chọn nhận diện chữ.";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn btn-primary";
  button.dataset.imageOcr = item.id;
  button.disabled = Boolean(processing.get(item.id));
  button.innerHTML = `<i data-lucide="scan-text"></i><span>Nhận diện chữ Việt/Anh</span>`;
  section.append(image, copy, button);
  renderOcr(section, result);
  host.append(section);
};

const renderWarnings = (host, result) => {
  if (!result.warnings?.length) return;
  const list = document.createElement("ul");
  list.className = "note-document-warnings";
  for (const warning of result.warnings) {
    const item = document.createElement("li");
    item.textContent = warning;
    list.append(item);
  }
  host.append(list);
};

const renderPreviewContent = async (host, item, file, result, version) => {
  if (item.type === "image") {
    renderImageReader(host, item, file, result);
    return;
  }
  if (item.type === "pdf") {
    const pdfHost = document.createElement("div");
    host.append(pdfHost);
    const { mountPdfReader } = await import("./documents/readers/pdf-reader");
    if (version !== previewVersion) return;
    activePdfReader = await mountPdfReader(pdfHost, file, result);
    if (version !== previewVersion) {
      await activePdfReader?.destroy();
      activePdfReader = null;
      return;
    }
    return;
  }

  if (["xlsx", "xls", "csv"].includes(item.type)) {
    renderSpreadsheet(host, result);
  } else if (item.type === "pptx") {
    renderSlides(host, result);
  } else if (item.type === "epub") {
    renderChapters(host, result);
  } else {
    const { content } = createReaderShell(host, result);
    content.innerHTML = result.html || `<pre>${escapeHTML(result.text)}</pre>`;
  }
  renderWarnings(host, result);
};

const renderPreview = async () => {
  const host = previewElement();
  if (!host) return;
  const item = getState().documents.find((entry) => entry.id === selectedId);
  const version = ++previewVersion;
  if (activePdfReader) {
    const previous = sessionDocuments.get(renderedId);
    if (previous?.result?.reader) {
      previous.result = { ...previous.result, reader: null };
    }
    await activePdfReader.destroy();
    activePdfReader = null;
  }
  if (renderedId && renderedId !== selectedId) {
    const oldUrl = imageUrls.get(renderedId);
    if (oldUrl) URL.revokeObjectURL(oldUrl);
    imageUrls.delete(renderedId);
  }
  renderedId = selectedId;
  host.replaceChildren();
  if (!item) {
    host.innerHTML = `<div class="note-document-placeholder"><i data-lucide="book-open"></i><h2>Chọn tài liệu để bắt đầu đọc</h2><p>Tệp được đọc cục bộ và nội dung trích xuất được lưu trong IndexedDB trên thiết bị này.</p></div>`;
    refreshIcons(host);
    return;
  }
  if (item.isDemo) {
    host.innerHTML = `<div class="note-document-placeholder"><span class="note-eyebrow">DỮ LIỆU MẪU</span><h2>${escapeHTML(item.name)}</h2><p>Đây là mục minh họa, không có tệp hoặc nội dung thật để mở.</p></div>`;
    return;
  }
  if (item.status === "processing" || processing.has(item.id)) {
    const message = processing.get(item.id)?.message || "Đang xử lý tài liệu…";
    host.innerHTML = `<div class="note-document-placeholder"><span class="spinner-border spinner-border-sm" role="status" aria-label="Đang xử lý"></span><h2>Đang xử lý tài liệu</h2><p>${escapeHTML(message)}</p></div>`;
    return;
  }

  let record;
  try {
    record =
      sessionDocuments.get(item.id) || (await getDocumentRecord(item.id));
  } catch (error) {
    host.innerHTML = `<div class="note-document-placeholder"><h2>Không thể mở kho tài liệu cục bộ</h2><p>${escapeHTML(error instanceof Error ? error.message : "Lỗi IndexedDB.")}</p></div>`;
    return;
  }
  if (version !== previewVersion) return;
  if (record && !sessionDocuments.has(item.id)) {
    sessionDocuments.set(item.id, {
      file: record.file,
      result: record.result,
    });
  }
  const cached = sessionDocuments.get(item.id);
  if (!cached?.file) {
    host.innerHTML = `<div class="note-document-placeholder"><h2>Không tìm thấy tệp đã lưu</h2><p>Tài liệu chưa được lưu trong IndexedDB của trình duyệt này. Hãy thêm lại tệp từ máy tính để tiếp tục đọc.</p>${item.status === "error" ? `<button class="btn btn-outline-secondary" type="button" data-document-retry="${escapeHTML(item.id)}">Thử đọc lại</button>` : ""}</div>`;
    return;
  }
  const result = cached.result;
  host.append(createReaderHeader(item, result));
  if (item.status === "error" || result?.error) {
    const message =
      item.error || result?.error?.message || "Không thể đọc nội dung tệp.";
    const error = document.createElement("div");
    error.className = "note-document-error";
    error.setAttribute("role", "alert");
    error.textContent = message;
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "btn btn-outline-secondary";
    retry.dataset.documentRetry = item.id;
    retry.textContent = "Thử đọc lại";
    error.append(" ", retry);
    host.append(error);
    refreshIcons(host);
    return;
  }
  if (item.type === "image" && item.readerStatus === "pending") {
    renderImageReader(host, item, cached.file, result);
    refreshIcons(host);
    return;
  }
  await renderPreviewContent(host, item, cached.file, result, version);
  if (version !== previewVersion) return;
  refreshIcons(host);
};

const persistDocument = async (id, file, result) => {
  try {
    await saveDocumentRecord(id, file, result);
    return "";
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "Không thể lưu tài liệu trong IndexedDB.";
  }
};

const processDocument = async (item, file) => {
  processing.set(item.id, { message: "Đang chuẩn bị bộ đọc…" });
  updateDocument(item.id, { status: "processing", error: "" });
  renderList();
  await renderPreview();
  const result = await readDocument(file, {
    onProgress: ({ message, progress }) => {
      processing.set(item.id, {
        message:
          progress === null || progress === undefined
            ? message
            : `${message} (${Math.round(progress * 100)}%)`,
      });
      if (selectedId === item.id) {
        const status = previewElement()?.querySelector(
          ".note-document-placeholder p"
        );
        if (status) status.textContent = processing.get(item.id).message;
      }
    },
  });
  sessionDocuments.set(item.id, { file, result });
  const storageError = await persistDocument(item.id, file, result);
  processing.delete(item.id);
  if (result.error) {
    updateDocument(item.id, {
      status: "error",
      error: result.error.message,
    });
    setLibraryStatus(`${item.name}: ${result.error.message}`, "danger");
  } else {
    updateDocument(item.id, {
      status: "ready",
      error: "",
      readerStatus: "ready",
    });
    setLibraryStatus(
      storageError
        ? `Đã đọc ${item.name} trong phiên này nhưng chưa lưu được vào IndexedDB: ${storageError}`
        : `Đã đọc ${item.name}. Tệp và nội dung được lưu cục bộ trong IndexedDB.`,
      storageError ? "warning" : "success"
    );
  }
  if (selectedId === item.id) await renderPreview();
  renderList();
  if (storageError)
    showToast(`Không lưu được tài liệu cục bộ: ${storageError}`, "warning");
  if (result.error) showToast(result.error.message, "danger");
};

const addFiles = async (files) => {
  for (const file of files) {
    const validation = await validateFile(file);
    if (!validation.valid) {
      const message = `${file?.name || "Tệp"}: ${validation.errors.map((error) => error.message).join(" ")}`;
      setLibraryStatus(message, "danger");
      showToast(message, "danger");
      continue;
    }
    const type = detectFileType(file);
    const item = addDocument({
      name: file.name,
      type,
      size: file.size,
      mimeType: file.type,
      status: type === "image" ? "ready" : "processing",
      readerStatus: type === "image" ? "pending" : "processing",
    });
    selectedId = item.id;
    sessionDocuments.set(item.id, { file, result: null });
    renderList();

    // Persist to MariaDB & Local Storage via Backend API
    api.documents
      .upload(file, item.folderId)
      .then((res) => {
        if (res && res.id) {
          updateDocument(item.id, { id: res.id, serverId: res.id });
        }
      })
      .catch((err) => {
        console.warn("Backend upload error:", err.message || err);
      });
    if (type === "image") {
      const emptyResult = {
        name: file.name,
        format: type,
        text: "",
        segments: [],
        metadata: { name: file.name, format: type, size: file.size },
        warnings: [],
        error: null,
      };
      sessionDocuments.set(item.id, { file, result: emptyResult });
      const storageError = await persistDocument(item.id, file, emptyResult);
      updateDocument(item.id, {
        status: "ready",
        readerStatus: "pending",
        error: "",
      });
      setLibraryStatus(
        storageError
          ? `Đã thêm ${file.name}; OCR chưa chạy. Không thể lưu vào IndexedDB: ${storageError}`
          : `Đã thêm ${file.name}. Chọn “Nhận diện chữ” để tải OCR cục bộ khi cần.`,
        storageError ? "warning" : "success"
      );
      await renderPreview();
    } else {
      await processDocument(item, file);
    }
  }
};

const retryDocument = async (id) => {
  const item = getState().documents.find((entry) => entry.id === id);
  const cached = sessionDocuments.get(id);
  if (!item || !cached?.file) {
    showToast(
      "Không có tệp trong phiên này để thử lại. Hãy thêm tệp từ máy tính.",
      "warning"
    );
    return;
  }
  await processDocument(item, cached.file);
};

const runImageOcr = async (id) => {
  const item = getState().documents.find((entry) => entry.id === id);
  const cached = sessionDocuments.get(id);
  if (!item || !cached?.file || processing.has(id)) return;
  processing.set(id, { message: "Đang khởi tạo OCR cục bộ…" });
  if (selectedId === id) await renderPreview();
  try {
    const result = await readDocument(cached.file, {
      onProgress: ({ message, progress }) => {
        processing.set(id, {
          message:
            progress === null || progress === undefined
              ? message
              : `${message} (${Math.round(progress * 100)}%)`,
        });
        if (selectedId === id) {
          const button = previewElement()?.querySelector("[data-image-ocr]");
          if (button) button.textContent = processing.get(id).message;
        }
      },
    });
    sessionDocuments.set(id, { file: cached.file, result });
    const storageError = await persistDocument(id, cached.file, result);
    if (result.error) {
      updateDocument(id, {
        readerStatus: "error",
        error: result.error.message,
      });
      setLibraryStatus(`${item.name}: ${result.error.message}`, "danger");
    } else {
      updateDocument(id, { readerStatus: "ready", error: "" });
      setLibraryStatus(
        storageError
          ? `OCR hoàn tất trong phiên này nhưng chưa lưu được vào IndexedDB: ${storageError}`
          : `Đã nhận diện văn bản cục bộ trong ${item.name}.`,
        storageError ? "warning" : "success"
      );
    }
    if (storageError) showToast(storageError, "warning");
    if (result.error) showToast(result.error.message, "danger");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Lỗi OCR không xác định.";
    updateDocument(id, { readerStatus: "error", error: message });
    setLibraryStatus(`Không thể nhận diện ${item.name}: ${message}`, "danger");
    showToast(message, "danger");
  } finally {
    processing.delete(id);
    if (selectedId === id) await renderPreview();
    renderList();
  }
};

const removeDocumentFromLibrary = async (id) => {
  const item = getState().documents.find((entry) => entry.id === id);
  if (!item || item.isDemo) return;
  if (
    !window.confirm(
      `Xóa “${item.name}” khỏi thư viện NOTE trên thiết bị này? Nếu có bản chia sẻ, liên kết sẽ bị thu hồi và tệp riêng trên máy chủ cũng bị xóa.`
    )
  ) {
    return;
  }
  try {
    await deleteSharedDocumentForLocalDelete(id, item.sharedCopy);
    await deleteDocumentRecord(id);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Không thể xóa dữ liệu IndexedDB.";
    showToast(`Không thể xóa dữ liệu tài liệu: ${message}`, "danger");
    return;
  }
  const objectUrl = imageUrls.get(id);
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  imageUrls.delete(id);
  sessionDocuments.delete(id);
  processing.delete(id);
  removeDocument(id);
  if (selectedId === id) selectedId = null;
  setLibraryStatus(`Đã xóa ${item.name} khỏi thiết bị này.`, "success");
  renderList();
};

export const initDocuments = () => {
  const root = rootElement();
  if (!root || root.dataset.initialized) return;
  root.dataset.initialized = "true";
  const dropzone = root.querySelector("[data-dropzone]");
  const input = root.querySelector("[data-file-input]");
  if (!dropzone || !input) return;

  root
    .querySelector("[data-file-picker]")
    ?.addEventListener("click", (event) => {
      event.preventDefault();
      input.click();
    });
  dropzone.addEventListener("click", (event) => {
    if (event.target.closest("[data-file-picker]")) return;
    if (!event.target.closest("[data-document-row]")) input.click();
  });
  dropzone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      input.click();
    }
  });
  input.addEventListener("change", () => {
    void addFiles([...input.files]);
    input.value = "";
  });
  for (const eventName of ["dragenter", "dragover"]) {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add("is-dragging");
    });
  }
  for (const eventName of ["dragleave", "drop"]) {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove("is-dragging");
    });
  }
  dropzone.addEventListener("drop", (event) => {
    void addFiles([...event.dataTransfer.files]);
  });
  root
    .querySelector("[data-document-search]")
    ?.addEventListener("input", renderList);
  root
    .querySelector("[data-document-type]")
    ?.addEventListener("change", renderList);
  listElement()?.addEventListener("click", (event) => {
    const selectButton = event.target.closest("[data-document-select]");
    if (selectButton) {
      selectedId = selectButton.dataset.documentSelect;
      renderList();
      return;
    }
    const removeButton = event.target.closest("[data-document-remove]");
    if (removeButton)
      void removeDocumentFromLibrary(removeButton.dataset.documentRemove);
    const shareButton = event.target.closest("[data-document-share]");
    if (shareButton) {
      window.dispatchEvent(
        new CustomEvent("note:share-document", {
          detail: { id: shareButton.dataset.documentShare },
        })
      );
    }
  });
  previewElement()?.addEventListener("click", (event) => {
    const copyButton = event.target.closest("[data-document-copy]");
    if (copyButton) {
      const result = sessionDocuments.get(
        copyButton.dataset.documentCopy
      )?.result;
      void copyText(result?.text ?? "");
      return;
    }
    const retryButton = event.target.closest("[data-document-retry]");
    if (retryButton) void retryDocument(retryButton.dataset.documentRetry);
    const ocrButton = event.target.closest("[data-image-ocr]");
    if (ocrButton) void runImageOcr(ocrButton.dataset.imageOcr);
  });
  window.addEventListener("note:statechange", renderList);
  renderList();
};
