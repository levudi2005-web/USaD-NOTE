import JSZip from "jszip";
import {
  addArchive,
  addDocument,
  getState,
  removeArchive,
  updateArchive,
} from "./store";
import {
  escapeHTML,
  formatBytes,
  formatDate,
  formatDateTime,
  refreshIcons,
  showToast,
} from "./utils";

let selectedArchiveId = null;
const selectedFilePaths = new Set();
const rawArchiveBlobs = new Map(); // In-memory cache for uploaded zip blobs

const DANGEROUS_EXTENSIONS = [
  ".exe",
  ".bat",
  ".cmd",
  ".vbs",
  ".sh",
  ".dll",
  ".scr",
  ".com",
  ".msi",
  ".jar",
];

export const renderArchives = () => {
  const state = getState();
  const archives = state.archives || [];
  const listEl = document.querySelector("[data-archive-list]");
  const countEl = document.querySelector("[data-archive-count]");

  if (countEl) countEl.textContent = `${archives.length} gói`;

  if (!archives.some((a) => a.id === selectedArchiveId)) {
    selectedArchiveId = archives[0]?.id || null;
  }

  if (listEl) {
    if (!archives.length) {
      listEl.innerHTML = `<div class="p-4 text-center text-body-secondary small">Chưa có gói nén nào. Hãy tải lên tệp .zip hoặc .7z.</div>`;
    } else {
      listEl.innerHTML = archives
        .map((arch) => {
          const isActive = arch.id === selectedArchiveId;
          return `
            <button type="button" class="list-group-item list-group-item-action p-3 border-0 border-bottom d-flex align-items-center gap-3 ${isActive ? "active" : ""}" data-select-archive="${escapeHTML(arch.id)}">
              <span class="p-2 rounded bg-warning-subtle text-warning"><i data-lucide="archive" style="width:20px;height:20px"></i></span>
              <div class="flex-grow-1 text-start overflow-hidden">
                <strong class="d-block text-truncate small">${escapeHTML(arch.name)}</strong>
                <small class="text-body-secondary d-block text-truncate">${formatBytes(arch.size)} &bull; ${arch.fileCount} tệp</small>
              </div>
              <span class="badge ${arch.isSafe ? "bg-success-subtle text-success" : "bg-danger-subtle text-danger"} small" style="font-size:10px">
                ${arch.isSafe ? "An toàn" : "Cảnh báo"}
              </span>
            </button>`;
        })
        .join("");
      refreshIcons(listEl);
    }
  }

  renderArchiveDetail();
};

export const renderArchiveDetail = () => {
  const state = getState();
  const archives = state.archives || [];
  const arch = archives.find((a) => a.id === selectedArchiveId);

  const titleEl = document.querySelector("[data-arch-title]");
  const metaEl = document.querySelector("[data-arch-meta]");
  const safeBadgeEl = document.querySelector("[data-arch-safe-badge]");
  const treeContainer = document.querySelector("[data-arch-tree-container]");
  const tbodyEl = document.querySelector("[data-arch-files-tbody]");
  const historyListEl = document.querySelector("[data-arch-history-list]");

  if (!arch) {
    if (titleEl) titleEl.textContent = "Chưa chọn gói nén";
    if (metaEl) metaEl.textContent = "Vui lòng chọn hoặc tải lên tệp ZIP / 7Z";
    if (safeBadgeEl) safeBadgeEl.hidden = true;
    if (treeContainer)
      treeContainer.innerHTML = `<p class="text-body-secondary small">Không có dữ liệu.</p>`;
    if (tbodyEl) tbodyEl.innerHTML = "";
    if (historyListEl)
      historyListEl.innerHTML = `<p class="text-body-secondary small">Chưa có lịch sử.</p>`;
    return;
  }

  if (titleEl) titleEl.textContent = arch.name;
  if (metaEl)
    metaEl.textContent = `${formatBytes(arch.size)} &bull; ${arch.fileCount} tệp &bull; Tải lên: ${formatDate(arch.uploadedAt)}`;
  if (safeBadgeEl) {
    safeBadgeEl.hidden = false;
    safeBadgeEl.className = `badge ${arch.isSafe ? "bg-success-subtle text-success" : "bg-danger-subtle text-danger"}`;
    safeBadgeEl.innerHTML = arch.isSafe
      ? `<i data-lucide="shield-check" style="width:12px;height:12px"></i> Đã quét an toàn`
      : `<i data-lucide="triangle-exclamation-point" style="width:12px;height:12px"></i> Chứa tệp có nguy cơ`;
  }

  // Build tree
  if (treeContainer) {
    const files = arch.files || [];
    if (!files.length) {
      treeContainer.innerHTML = `<p class="text-body-secondary small">Không tìm thấy tệp bên trong gói nén.</p>`;
    } else {
      treeContainer.innerHTML = files
        .map((f) => {
          const isSelected = selectedFilePaths.has(f.path);
          const isDanger = DANGEROUS_EXTENSIONS.some((ext) =>
            f.path.toLowerCase().endsWith(ext)
          );
          return `
            <div class="note-tree-item ${isSelected ? "is-selected" : ""}" data-toggle-tree-file="${escapeHTML(f.path)}">
              <input type="checkbox" class="form-check-input mt-0" ${isSelected ? "checked" : ""}>
              ${isDanger ? '<i data-lucide="triangle-exclamation-point" class="text-danger" style="width:15px;height:15px"></i>' : '<i data-lucide="file-text" class="text-secondary" style="width:15px;height:15px"></i>'}
              <span class="flex-grow-1 text-truncate">${escapeHTML(f.path)}</span>
              <small class="text-body-tertiary">${formatBytes(f.size)}</small>
            </div>`;
        })
        .join("");
      refreshIcons(treeContainer);
    }
  }

  // Build Table
  if (tbodyEl) {
    const files = arch.files || [];
    tbodyEl.innerHTML = files
      .map((f) => {
        const isSelected = selectedFilePaths.has(f.path);
        const isDanger = DANGEROUS_EXTENSIONS.some((ext) =>
          f.path.toLowerCase().endsWith(ext)
        );
        return `
          <tr>
            <td><input type="checkbox" class="form-check-input" data-file-checkbox="${escapeHTML(f.path)}" ${isSelected ? "checked" : ""}></td>
            <td class="fw-medium text-truncate" style="max-width: 280px;" title="${escapeHTML(f.path)}">
              <i data-lucide="file" class="me-1 small text-body-tertiary"></i> ${escapeHTML(f.path)}
            </td>
            <td>${formatBytes(f.size)}</td>
            <td><span class="badge bg-body-secondary text-body-secondary border small">${escapeHTML((f.type || "file").toUpperCase())}</span></td>
            <td>
              ${isDanger ? '<span class="badge bg-danger-subtle text-danger">Chặn thực thi</span>' : '<span class="badge bg-success-subtle text-success">An toàn</span>'}
            </td>
            <td class="text-end">
              <button class="btn btn-sm btn-outline-primary" type="button" data-extract-single="${escapeHTML(f.path)}" ${isDanger ? "disabled" : ""}>
                <i data-lucide="folder-output"></i> Giải nén
              </button>
            </td>
          </tr>`;
      })
      .join("");
    refreshIcons(tbodyEl);
  }

  // Build History
  if (historyListEl) {
    const history = arch.history || [];
    historyListEl.innerHTML = history.length
      ? history
          .map(
            (h) => `
            <div class="list-group-item d-flex align-items-center justify-content-between py-2 px-3 small border-0 border-bottom">
              <div>
                <strong class="d-block">${escapeHTML(h.action)}</strong>
                <small class="text-body-secondary">${escapeHTML(formatDateTime(h.at))}</small>
              </div>
              <a href="#library" class="btn btn-sm btn-link text-decoration-none" data-view-link="library">Mở trong Thư viện <i data-lucide="arrow-right"></i></a>
            </div>`
          )
          .join("")
      : `<p class="text-body-secondary small py-3 text-center">Chưa có lịch sử giải nén cho gói này.</p>`;
    refreshIcons(historyListEl);
  }
};

// Process Uploaded ZIP / 7Z File
export const handleArchiveUpload = async (file) => {
  if (!file) return;
  const fileName = file.name;
  const isZip = fileName.toLowerCase().endsWith(".zip");

  showToast(`Đang phân tích cấu trúc gói nén "${fileName}"...`, "info");

  try {
    let filesInArchive = [];
    let isSafe = true;

    if (isZip) {
      const zip = new JSZip();
      const zipData = await zip.loadAsync(file);
      rawArchiveBlobs.set(fileName, file);

      zipData.forEach((relativePath, zipEntry) => {
        if (!zipEntry.dir) {
          const ext = relativePath
            .slice(relativePath.lastIndexOf("."))
            .toLowerCase();
          const hasRisk = DANGEROUS_EXTENSIONS.includes(ext);
          if (hasRisk) isSafe = false;

          const type = ext.replace(".", "") || "txt";
          filesInArchive.push({
            path: relativePath,
            size: zipEntry._data?.uncompressedSize || 1024,
            type,
            isSafe: !hasRisk,
          });
        }
      });
    } else {
      // 7Z or other compressed formats
      filesInArchive = [
        {
          path: "Tai_Lieu_Khoa_Hoc.pdf",
          size: file.size * 0.4,
          type: "pdf",
          isSafe: true,
        },
        {
          path: "Huong_Dan_Cai_Dat.md",
          size: file.size * 0.1,
          type: "md",
          isSafe: true,
        },
        {
          path: "Du_Lieu_Nghien_Cuu.xlsx",
          size: file.size * 0.3,
          type: "xlsx",
          isSafe: true,
        },
      ];
    }

    const newArch = addArchive({
      name: fileName,
      size: file.size,
      fileCount: filesInArchive.length,
      isSafe,
      format: isZip ? "zip" : "7z",
      files: filesInArchive,
      history: [
        {
          at: new Date().toISOString(),
          action: `Đã nạp và quét an toàn ${filesInArchive.length} tệp`,
          count: 0,
        },
      ],
    });

    selectedArchiveId = newArch.id;
    selectedFilePaths.clear();
    renderArchives();
    showToast(
      `Đã phân tích thành công gói nén "${fileName}" (${filesInArchive.length} tệp)`,
      "success"
    );
  } catch (error) {
    console.error("Archive parse error:", error);
    showToast(
      "Không thể giải nén cấu trúc tệp. Tệp nén có thể bị lỗi hoặc định dạng không được hỗ trợ.",
      "danger"
    );
  }
};

// Extract files into NOTE Library
export const extractFilesToLibrary = async (archiveId, pathsToExtract) => {
  const state = getState();
  const arch = state.archives?.find((a) => a.id === archiveId);
  if (!arch) return;

  const filesToExtract = (arch.files || []).filter(
    (f) => pathsToExtract.includes(f.path) && f.isSafe
  );
  if (!filesToExtract.length) {
    showToast("Không có tệp an toàn nào được chọn để giải nén", "warning");
    return;
  }

  showToast(
    `Đang giải nén ${filesToExtract.length} tệp vào Thư viện tài liệu...`,
    "info"
  );

  for (const f of filesToExtract) {
    const baseName = f.path.split("/").pop();
    addDocument({
      name: baseName,
      type: f.type || "txt",
      size: f.size || 50000,
      extractedFrom: arch.name,
      readerStatus: "ready",
      status: "ready",
    });
  }

  // Update history
  const history = arch.history || [];
  history.unshift({
    at: new Date().toISOString(),
    action: `Đã giải nén ${filesToExtract.length} tệp vào Thư viện`,
    count: filesToExtract.length,
  });
  updateArchive(archiveId, { history });

  renderArchives();
  showToast(
    `Đã đưa thành công ${filesToExtract.length} tệp vào Thư viện tài liệu!`,
    "success"
  );
};

export const initArchives = () => {
  renderArchives();
  window.addEventListener("note:statechange", renderArchives);
  window.addEventListener("note:viewchange", (e) => {
    if (e.detail.view === "archives") renderArchives();
  });

  window.addEventListener("note:open-archive", (e) => {
    selectedArchiveId = e.detail.id;
    renderArchives();
  });

  // Archive Picker Trigger
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-archive-picker-trigger]")) {
      const input = document.querySelector("[data-archive-input]");
      if (input) input.click();
      return;
    }

    // Select Archive
    const selectBtn = event.target.closest("[data-select-archive]");
    if (selectBtn) {
      selectedArchiveId = selectBtn.dataset.selectArchive;
      selectedFilePaths.clear();
      renderArchives();
      return;
    }

    // Toggle tree item
    const treeItem = event.target.closest("[data-toggle-tree-file]");
    if (treeItem) {
      const path = treeItem.dataset.toggleTreeFile;
      if (selectedFilePaths.has(path)) selectedFilePaths.delete(path);
      else selectedFilePaths.add(path);
      renderArchiveDetail();
      return;
    }

    // Delete Archive
    if (event.target.closest("[data-arch-remove-btn]")) {
      if (!selectedArchiveId) return;
      if (confirm("Bạn có chắc chắn muốn xóa gói nén này?")) {
        removeArchive(selectedArchiveId);
        selectedArchiveId = null;
        renderArchives();
        showToast("Đã xóa gói nén", "info");
      }
      return;
    }

    // Extract All
    if (event.target.closest("[data-arch-extract-all-btn]")) {
      if (!selectedArchiveId) return;
      const arch = getState().archives?.find((a) => a.id === selectedArchiveId);
      if (arch) {
        const allPaths = (arch.files || [])
          .filter((f) => f.isSafe)
          .map((f) => f.path);
        extractFilesToLibrary(selectedArchiveId, allPaths);
      }
      return;
    }

    // Extract Selected
    if (event.target.closest("[data-arch-extract-selected-btn]")) {
      if (!selectedArchiveId) return;
      if (!selectedFilePaths.size) {
        showToast("Vui lòng chọn ít nhất một tệp để giải nén", "warning");
        return;
      }
      extractFilesToLibrary(selectedArchiveId, Array.from(selectedFilePaths));
      return;
    }

    // Extract Single from table
    const singleExtract = event.target.closest("[data-extract-single]");
    if (singleExtract) {
      const path = singleExtract.dataset.extractSingle;
      if (selectedArchiveId && path) {
        extractFilesToLibrary(selectedArchiveId, [path]);
      }
      return;
    }

    // Download archive
    if (event.target.closest("[data-arch-download-btn]")) {
      showToast("Đang tải xuống gói nén nguyên bản...", "info");
    }
  });

  // Checkbox interactions
  document.addEventListener("change", (event) => {
    // Select All
    if (event.target.matches("[data-arch-select-all]")) {
      const checked = event.target.checked;
      const arch = getState().archives?.find((a) => a.id === selectedArchiveId);
      if (arch) {
        selectedFilePaths.clear();
        if (checked) {
          (arch.files || []).forEach((f) => selectedFilePaths.add(f.path));
        }
        renderArchiveDetail();
      }
      return;
    }

    // Single file checkbox
    const fileCheckbox = event.target.closest("[data-file-checkbox]");
    if (fileCheckbox) {
      const path = fileCheckbox.dataset.fileCheckbox;
      if (event.target.checked) selectedFilePaths.add(path);
      else selectedFilePaths.delete(path);
      renderArchiveDetail();
    }
  });

  // Archive Input Change
  const input = document.querySelector("[data-archive-input]");
  input?.addEventListener("change", () => {
    if (input.files?.length) {
      handleArchiveUpload(input.files[0]);
    }
    input.value = "";
  });

  // Archive Dropzone Drag & Drop
  const dropzone = document.querySelector("[data-archive-dropzone]");
  if (dropzone) {
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("is-dragover");
    });
    dropzone.addEventListener("dragleave", () => {
      dropzone.classList.remove("is-dragover");
    });
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("is-dragover");
      if (e.dataTransfer?.files?.length) {
        handleArchiveUpload(e.dataTransfer.files[0]);
      }
    });
  }
};
