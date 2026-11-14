import { searchInDocument } from "../document-search";

let pdfjsPromise;
const loadingTasks = new WeakMap();

const loadPdfJs = () => {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist/legacy/build/pdf.mjs").then(
      async (pdfjs) => {
        if (typeof document !== "undefined") {
          const { default: workerUrl } = await import("./pdf-worker-url");
          pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        }
        return pdfjs;
      }
    );
  }
  return pdfjsPromise;
};

export const openPdf = async (file) => {
  const pdfjs = await loadPdfJs();
  const loadingTask = pdfjs.getDocument({
    data: await file.arrayBuffer(),
    isEvalSupported: false,
    useWorkerFetch: false,
  });
  const pdf = await loadingTask.promise;
  loadingTasks.set(pdf, loadingTask);
  return pdf;
};

const destroyPdf = async (pdf) => {
  const loadingTask = loadingTasks.get(pdf);
  if (loadingTask) {
    loadingTasks.delete(pdf);
    await loadingTask.destroy();
  } else {
    await pdf.cleanup?.();
  }
};

export const readPdf = async (file, metadata, onProgress = () => {}) => {
  const pdf = await openPdf(file);
  const segments = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item) => `${item.str}${item.hasEOL ? "\n" : " "}`)
      .join("")
      .trim();
    segments.push({
      kind: "page",
      index: pageNumber - 1,
      label: `Trang ${pageNumber}`,
      text,
    });
    onProgress({
      phase: "extracting",
      progress: pageNumber / pdf.numPages,
      message: `Đang trích xuất trang ${pageNumber}/${pdf.numPages}`,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  const pdfMetadata = await pdf.getMetadata();
  return {
    ...metadata,
    text: segments.map((segment) => segment.text).join("\n\n"),
    segments,
    metadata: {
      ...metadata,
      pageCount: pdf.numPages,
      title: pdfMetadata.info?.Title || "",
      author: pdfMetadata.info?.Author || "",
      encrypted: Boolean(pdfMetadata.info?.IsEncrypted),
    },
    warnings: [],
    error: null,
    reader: pdf,
  };
};

export const mountPdfReader = async (container, file, result) => {
  const pdf = result.reader ?? (await openPdf(file));
  const root = document.createElement("section");
  root.className = "note-pdf-reader";
  root.innerHTML = `
    <div class="note-reader-toolbar" aria-label="Công cụ đọc PDF">
      <div class="note-reader-controls">
        <button class="btn btn-sm btn-outline-secondary" type="button" data-pdf-step="-1" aria-label="Trang trước">‹</button>
        <label class="note-reader-page">Trang <input type="number" min="1" value="1" data-pdf-page> <span data-pdf-page-count></span></label>
        <button class="btn btn-sm btn-outline-secondary" type="button" data-pdf-step="1" aria-label="Trang tiếp">›</button>
      </div>
      <div class="note-reader-controls">
        <button class="btn btn-sm btn-outline-secondary" type="button" data-pdf-zoom="-0.2" aria-label="Thu nhỏ">−</button>
        <span data-pdf-zoom-label>100%</span>
        <button class="btn btn-sm btn-outline-secondary" type="button" data-pdf-zoom="0.2" aria-label="Phóng to">+</button>
      </div>
      <button class="btn btn-sm btn-outline-secondary" type="button" data-pdf-export-docx>
        <i data-lucide="file-text" aria-hidden="true"></i><span>Chuyển sang Word</span>
      </button>
      <label class="note-reader-search"><i data-lucide="search"></i><input type="search" placeholder="Tìm trong PDF..." aria-label="Tìm trong PDF" data-pdf-search></label>
      <div class="note-reader-controls">
        <button class="btn btn-sm btn-outline-secondary" type="button" data-pdf-match="-1" aria-label="Kết quả trước">↑</button>
        <span data-pdf-match-count aria-live="polite">0 kết quả</span>
        <button class="btn btn-sm btn-outline-secondary" type="button" data-pdf-match="1" aria-label="Kết quả tiếp">↓</button>
      </div>
    </div>
    <p class="note-reader-search-excerpt" data-pdf-search-excerpt aria-live="polite"></p>
    <p class="note-reader-export-status" data-pdf-export-status role="status" aria-live="polite" hidden></p>
    <div class="note-pdf-stage"><canvas aria-label="Trang PDF"></canvas></div>
    <p class="note-reader-error" role="status" hidden></p>`;
  container.replaceChildren(root);
  const canvas = root.querySelector("canvas");
  const context = canvas.getContext("2d");
  const pageInput = root.querySelector("[data-pdf-page]");
  const pageCount = root.querySelector("[data-pdf-page-count]");
  const zoomLabel = root.querySelector("[data-pdf-zoom-label]");
  const searchInput = root.querySelector("[data-pdf-search]");
  const matchCount = root.querySelector("[data-pdf-match-count]");
  const excerpt = root.querySelector("[data-pdf-search-excerpt]");
  const exportButton = root.querySelector("[data-pdf-export-docx]");
  const exportStatus = root.querySelector("[data-pdf-export-status]");
  const error = root.querySelector(".note-reader-error");
  const pageControl = root.querySelector(".note-reader-page");
  const matches = [];
  let wordEditor;
  exportButton.disabled = !result.segments?.some((segment) =>
    segment.text.trim()
  );
  exportButton.title = exportButton.disabled
    ? "Không tìm thấy văn bản có thể chuyển. PDF scan cần OCR."
    : "Chuyển văn bản PDF sang Word để chỉnh sửa ngay trong NOTE";
  let pageNumber = 1;
  let zoom = 1;
  let matchIndex = -1;
  let renderTask;
  let disposed = false;
  pageCount.textContent = `/ ${pdf.numPages}`;

  const renderPage = async () => {
    try {
      renderTask?.cancel();
      const page = await pdf.getPage(pageNumber);
      if (disposed) return;
      const pixelRatio = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: zoom });
      const renderViewport = page.getViewport({ scale: zoom * pixelRatio });
      canvas.width = Math.ceil(renderViewport.width);
      canvas.height = Math.ceil(renderViewport.height);
      canvas.style.width = `${Math.ceil(viewport.width)}px`;
      canvas.style.height = `${Math.ceil(viewport.height)}px`;
      pageInput.value = String(pageNumber);
      zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
      renderTask = page.render({
        canvasContext: context,
        viewport: renderViewport,
      });
      await renderTask.promise;
      error.hidden = true;
    } catch (renderError) {
      if (renderError?.name !== "RenderingCancelledException") {
        error.textContent =
          renderError instanceof Error
            ? renderError.message
            : "Không thể hiển thị trang PDF.";
        error.hidden = false;
      }
    }
  };

  const goToMatch = (direction) => {
    if (!matches.length) return;
    matchIndex = (matchIndex + direction + matches.length) % matches.length;
    const match = matches[matchIndex];
    pageNumber = match.segmentIndex + 1;
    excerpt.textContent = `${match.label}: ${match.excerpt}`;
    void renderPage();
  };

  pageControl.addEventListener("change", () => {
    const requestedPage = Number(pageInput.value);
    if (
      Number.isInteger(requestedPage) &&
      requestedPage >= 1 &&
      requestedPage <= pdf.numPages
    ) {
      pageNumber = requestedPage;
      void renderPage();
    } else {
      pageInput.value = String(pageNumber);
    }
  });
  root.querySelectorAll("[data-pdf-step]").forEach((button) => {
    button.addEventListener("click", () => {
      pageNumber = Math.max(
        1,
        Math.min(pdf.numPages, pageNumber + Number(button.dataset.pdfStep))
      );
      void renderPage();
    });
  });
  root.querySelectorAll("[data-pdf-zoom]").forEach((button) => {
    button.addEventListener("click", () => {
      zoom = Math.max(
        0.6,
        Math.min(2.4, zoom + Number(button.dataset.pdfZoom))
      );
      void renderPage();
    });
  });
  searchInput.addEventListener("input", () => {
    matches.splice(
      0,
      matches.length,
      ...searchInDocument(result, searchInput.value).matches
    );
    matchIndex = -1;
    matchCount.textContent = `${matches.length} kết quả`;
    excerpt.textContent = "";
    if (matches.length) goToMatch(1);
  });
  exportButton.addEventListener("click", async () => {
    if (wordEditor) {
      wordEditor.hidden = false;
      root.querySelector(".note-reader-toolbar").hidden = true;
      excerpt.hidden = true;
      root.querySelector(".note-pdf-stage").hidden = true;
      error.hidden = true;
      return;
    }
    exportButton.disabled = true;
    exportStatus.hidden = false;
    exportStatus.textContent = "Đang chuyển nội dung sang Word…";
    try {
      const { createDocxFromPdfSegments } = await import("./pdf-to-docx");
      const { readDocument } = await import("../document-engine");
      const blob = await createDocxFromPdfSegments(result.segments);
      const baseName = (file.name || "document.pdf")
        .replace(/\.[^.]+$/u, "")
        // eslint-disable-next-line no-control-regex -- Windows filenames cannot contain control characters.
        .replace(/[<>:"/\\|?*\u0000-\u001F]/gu, "_")
        .trim();
      const wordFile = new File([blob], `${baseName || "document"}.docx`, {
        type: blob.type,
      });
      const wordResult = await readDocument(wordFile);
      if (wordResult.error) throw new Error(wordResult.error.message);

      wordEditor = document.createElement("section");
      wordEditor.className = "note-reader-word-editor";
      const heading = document.createElement("h2");
      heading.textContent = `${baseName || "Tài liệu"} · Word`;
      const tools = document.createElement("div");
      tools.className = "note-reader-word-tools";
      tools.setAttribute("role", "toolbar");
      tools.setAttribute("aria-label", "Định dạng văn bản Word");
      tools.innerHTML = `
        <button class="btn btn-sm btn-outline-secondary" type="button" data-word-command="bold" aria-label="In đậm"><strong>B</strong></button>
        <button class="btn btn-sm btn-outline-secondary" type="button" data-word-command="italic" aria-label="In nghiêng"><i data-lucide="italic"></i></button>
        <button class="btn btn-sm btn-outline-secondary" type="button" data-word-command="insertUnorderedList" aria-label="Danh sách"><i data-lucide="list"></i></button>
        <button class="btn btn-sm btn-outline-secondary" type="button" data-word-back><i data-lucide="file-text"></i><span>Quay lại PDF</span></button>`;
      const content = document.createElement("div");
      content.className = "note-reader-word-content";
      content.contentEditable = "true";
      content.setAttribute("role", "textbox");
      content.setAttribute("aria-label", "Nội dung Word đã chuyển đổi");
      content.setAttribute("aria-multiline", "true");
      content.spellcheck = true;
      content.innerHTML = wordResult.html;
      const notice = document.createElement("p");
      notice.className = "note-reader-export-status";
      notice.textContent =
        "Có thể chỉnh sửa trực tiếp tại đây. Bản chuyển đổi gồm văn bản trích xuất; bố cục PDF phức tạp có thể khác.";
      wordEditor.append(heading, tools, content, notice);
      root.append(wordEditor);
      tools.querySelectorAll("[data-word-command]").forEach((button) => {
        button.addEventListener("click", () => {
          content.focus();
          document.execCommand(button.dataset.wordCommand, false);
        });
      });
      tools.querySelector("[data-word-back]").addEventListener("click", () => {
        wordEditor.hidden = true;
        root.querySelector(".note-reader-toolbar").hidden = false;
        excerpt.hidden = false;
        root.querySelector(".note-pdf-stage").hidden = false;
      });
      root.querySelector(".note-reader-toolbar").hidden = true;
      excerpt.hidden = true;
      root.querySelector(".note-pdf-stage").hidden = true;
      exportStatus.hidden = true;
    } catch (conversionError) {
      exportStatus.textContent =
        conversionError instanceof Error
          ? conversionError.message
          : "Không thể chuyển PDF sang Word.";
    } finally {
      exportButton.disabled = false;
    }
  });
  root.querySelectorAll("[data-pdf-match]").forEach((button) => {
    button.addEventListener("click", () =>
      goToMatch(Number(button.dataset.pdfMatch))
    );
  });

  await renderPage();
  return {
    destroy: async () => {
      disposed = true;
      renderTask?.cancel();
      await destroyPdf(pdf);
    },
  };
};

export { destroyPdf };
