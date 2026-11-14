import api, { getToken } from "../api";
import { getState, updateDocument } from "../store";
import { escapeHTML, refreshIcons, showModal, showToast } from "../utils";

const modal = document.querySelector("#note-share-modal");
const byData = (name) => modal?.querySelector(`[data-share-${name}]`);

let activeDocumentId = null;
let currentDocument = null;
let currentShare = null;
let currentToken = null;
let shareCache = [];

const setStatus = (message, tone = "info") => {
  const status = byData("status");
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone;
};

const setBusy = (busy) => {
  for (const selector of [
    "[data-share-enabled]",
    "[data-share-create]",
    "[data-share-update]",
    "[data-share-rotate]",
    "[data-share-revoke]",
    "[data-share-copy]",
  ]) {
    const control = modal?.querySelector(selector);
    if (control) control.disabled = busy;
  }
};

const parseApiDate = (value) =>
  new Date(/(?:Z|[+-]\d{2}:\d{2})$/u.test(value) ? value : `${value}Z`);

const localDateTimeValue = (value) => {
  if (!value) return "";
  const date = parseApiDate(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const mapShare = (share) => ({
  ...share,
  enabled: !share.is_revoked,
  expiresAt: share.expires_at,
  description: share.share_name ?? "",
  canDownload: share.allow_download,
  hasPassword: share.has_password,
  viewsCount: share.view_count,
  status: share.is_revoked ? "revoked" : "active",
});

const getOptions = () => {
  const expiresValue = byData("expiry").value;
  let expiresAt = null;
  if (expiresValue) {
    const expiresAtMs = new Date(expiresValue).getTime();
    const remaining = expiresAtMs - Date.now();
    if (remaining <= 0) throw new Error("Thời hạn chia sẻ phải ở tương lai.");
    if (remaining > 365 * 86_400_000) {
      throw new Error("Thời hạn chia sẻ tối đa là 365 ngày.");
    }
    expiresAt = new Date(expiresAtMs).toISOString();
  }

  const options = {
    share_name: byData("description").value.trim() || currentDocument.name,
    allow_download: Boolean(byData("download").checked),
    expires_at: expiresAt,
  };
  const password = byData("link-password").value;
  if (password) options.password = password;
  else if (byData("clear-password").checked) options.password = null;
  return options;
};

const updateView = () => {
  const options = byData("options");
  const authRequired = byData("auth-required");
  const authenticated = byData("authenticated");
  const enabledInput = byData("enabled");
  const linkRow = byData("link-row");
  const shareUrlInput = byData("link");
  const consentRow = byData("consent-row");
  const createButton = byData("create");
  const updateButton = byData("update");
  const rotateButton = byData("rotate");
  const revokeButton = byData("revoke");
  const signedIn = Boolean(getToken());

  authRequired.hidden = signedIn;
  authenticated.hidden = !signedIn || !currentDocument;
  options.hidden = !signedIn || !currentDocument;
  if (!currentDocument) return;

  const hasShare = Boolean(currentShare);
  const isEnabled = Boolean(currentShare?.enabled);
  enabledInput.checked = isEnabled;
  enabledInput.disabled = false;
  consentRow.hidden = hasShare;
  linkRow.hidden = !currentToken;
  shareUrlInput.value = currentToken
    ? `${location.origin}/share/?token=${encodeURIComponent(currentToken)}`
    : "";
  createButton.hidden = hasShare;
  updateButton.hidden = !isEnabled;
  rotateButton.hidden = !hasShare;
  revokeButton.hidden = !isEnabled;
  byData("user").textContent =
    getState().userProfile?.name || "Đã đăng nhập vào NOTE";
  byData("expiry").value = currentShare?.expiresAt
    ? localDateTimeValue(currentShare.expiresAt)
    : "";
  byData("description").value = currentShare?.description ?? "";
  byData("download").checked = Boolean(currentShare?.canDownload);
  byData("clear-password").checked = false;
  byData("link-password").value = "";

  if (!hasShare) {
    setStatus(
      "Tài liệu chưa được chia sẻ. Xác nhận bên dưới để tạo liên kết.",
      "info"
    );
  } else if (!isEnabled) {
    setStatus(
      "Liên kết đã bị thu hồi. Tạo lại liên kết để bật chia sẻ.",
      "warning"
    );
  } else if (
    currentShare.expiresAt &&
    parseApiDate(currentShare.expiresAt).getTime() <= Date.now()
  ) {
    setStatus(
      "Liên kết đã hết hạn. Hãy tạo lại hoặc cập nhật thời hạn.",
      "warning"
    );
  } else if (currentToken) {
    setStatus(
      "Chia sẻ đang bật. Sao chép liên kết để gửi cho người nhận.",
      "success"
    );
  } else {
    setStatus(
      "Chia sẻ đang bật. Token chỉ hiển thị khi tạo hoặc tạo lại liên kết.",
      "success"
    );
  }
};

const loadStatus = async () => {
  const links = (await api.sharing.list()).map(mapShare);
  shareCache = links;
  currentShare =
    links.find(
      (link) => link.document_id === activeDocumentId && !link.is_revoked
    ) ??
    links.find((link) => link.document_id === activeDocumentId) ??
    null;
  updateDocument(activeDocumentId, {
    sharedCopy: links.some(
      (link) => link.document_id === activeDocumentId && !link.is_revoked
    ),
  });
  updateView();
};

const performCreate = async () => {
  if (!byData("consent").checked) {
    throw new Error("Hãy xác nhận chia sẻ tài liệu này để tiếp tục.");
  }
  const response = await api.sharing.create({
    document_id: activeDocumentId,
    ...getOptions(),
  });
  currentShare = mapShare(response);
  currentToken = response.token;
  byData("consent").checked = false;
  updateDocument(activeDocumentId, { sharedCopy: true });
  updateView();
};

const runAction = async (action) => {
  if (!activeDocumentId || !currentDocument) return;
  setBusy(true);
  try {
    if (action === "create") {
      await performCreate();
    } else if (action === "update") {
      currentShare = mapShare(
        await api.sharing.update(currentShare.id, getOptions())
      );
      updateView();
    } else if (action === "rotate") {
      const response = await api.sharing.rotate(currentShare.id);
      currentShare = mapShare(response);
      currentToken = response.token;
      updateView();
    } else if (action === "revoke") {
      await api.sharing.revoke(currentShare.id);
      currentShare = { ...currentShare, is_revoked: true, enabled: false };
      currentToken = null;
      updateDocument(activeDocumentId, { sharedCopy: false });
      updateView();
    }
    await loadStatus();
    await renderSharesTable();
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : "Không thể cập nhật liên kết.",
      "danger"
    );
    if (action === "create") byData("enabled").checked = false;
    if (action === "revoke") byData("enabled").checked = true;
  } finally {
    setBusy(false);
  }
};

const openForDocument = async (id) => {
  showModal("note-share-modal");
  activeDocumentId = id;
  currentDocument = getState().documents.find((entry) => entry.id === id);
  currentShare = null;
  currentToken = null;
  if (!currentDocument || currentDocument.isDemo) {
    setStatus(
      "Không thể chia sẻ dữ liệu mẫu hoặc tài liệu không tồn tại.",
      "danger"
    );
    return;
  }
  byData("title").textContent = currentDocument.name;
  byData("description").value = "";
  byData("expiry").value = "";
  byData("link").value = "";
  byData("consent").checked = false;
  byData("enabled").checked = false;
  byData("authenticated").hidden = true;
  byData("options").hidden = true;

  if (!getToken()) {
    byData("auth-required").hidden = false;
    setStatus("Đăng nhập NOTE để quản lý liên kết chia sẻ.", "info");
    return;
  }
  byData("auth-required").hidden = true;
  try {
    await loadStatus();
    await renderSharesTable();
  } catch (error) {
    setStatus(
      error instanceof Error
        ? error.message
        : "Không thể tải trạng thái chia sẻ.",
      "danger"
    );
  }
};

export const initSharing = () => {
  if (!modal || modal.dataset.initialized) return;
  modal.dataset.initialized = "true";

  window.addEventListener("note:share-document", (event) => {
    void openForDocument(event.detail?.id);
  });

  byData("enabled").addEventListener("change", (event) => {
    if (event.currentTarget.checked) {
      void runAction(
        currentShare
          ? currentShare.is_revoked
            ? "rotate"
            : "update"
          : "create"
      );
    } else if (currentShare?.enabled) {
      if (
        window.confirm(
          "Thu hồi liên kết? Người nhận sẽ không thể truy cập nữa."
        )
      ) {
        void runAction("revoke");
      } else {
        event.currentTarget.checked = true;
      }
    }
  });

  byData("consent").addEventListener("change", (event) => {
    byData("create").disabled = !event.currentTarget.checked;
  });

  for (const action of ["create", "update", "rotate", "revoke"]) {
    byData(action).addEventListener("click", () => void runAction(action));
  }

  byData("copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(byData("link").value);
      setStatus("Đã sao chép liên kết.", "success");
    } catch {
      byData("link").select();
      setStatus(
        "Không thể truy cập clipboard. Hãy sao chép liên kết đã chọn.",
        "warning"
      );
    }
  });

  void renderSharesTable();
  window.addEventListener("note:viewchange", (event) => {
    if (event.detail.view === "sharing") void renderSharesTable();
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-create-share-trigger]")) {
      const documentRecord = getState().documents?.find((item) => !item.isDemo);
      if (documentRecord) void openForDocument(documentRecord.id);
      else window.location.hash = "library";
      return;
    }

    const revokeButton = event.target.closest("[data-revoke-share-link]");
    if (revokeButton) {
      void (async () => {
        try {
          await api.sharing.revoke(revokeButton.dataset.revokeShareLink);
          await renderSharesTable();
          showToast("Đã thu hồi liên kết chia sẻ.", "success");
        } catch (error) {
          showToast(
            error instanceof Error
              ? error.message
              : "Không thể thu hồi liên kết.",
            "danger"
          );
        }
      })();
      return;
    }

    const copyButton = event.target.closest("[data-copy-share-url]");
    if (copyButton) {
      void navigator.clipboard
        .writeText(
          `${window.location.origin}${copyButton.dataset.copyShareUrl}`
        )
        .then(() => showToast("Đã chép liên kết chia sẻ!", "success"))
        .catch(() => showToast("Không thể truy cập clipboard.", "warning"));
    }
  });
};

export const renderSharesTable = async () => {
  const tbody = document.querySelector("[data-shares-tbody]");
  if (!tbody) return;
  if (!getToken()) {
    tbody.innerHTML =
      '<tr><td colspan="8" class="text-center py-4 text-body-secondary small">Đăng nhập NOTE để xem liên kết chia sẻ.</td></tr>';
    return;
  }
  try {
    shareCache = (await api.sharing.list()).map(mapShare);
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-danger small">${escapeHTML(error.message || "Không thể tải liên kết chia sẻ.")}</td></tr>`;
    return;
  }

  if (!shareCache.length) {
    tbody.innerHTML =
      '<tr><td colspan="8" class="text-center py-4 text-body-secondary small">Chưa có liên kết chia sẻ nào được tạo.</td></tr>';
    return;
  }

  tbody.innerHTML = shareCache
    .map((share) => {
      const isRevoked = share.is_revoked;
      const shareUrl = share.share_url
        ? `${window.location.origin}${share.share_url}`
        : "";
      const expiry = share.expires_at
        ? parseApiDate(share.expires_at).toLocaleDateString("vi-VN")
        : "Vĩnh viễn";
      return `
        <tr>
          <td><strong class="small text-truncate d-block" style="max-width:200px">${escapeHTML(share.share_name || "Tài liệu được chia sẻ")}</strong></td>
          <td>
            ${
              shareUrl
                ? `<div class="input-group input-group-sm" style="max-width:220px"><input type="text" class="form-control" value="${escapeHTML(shareUrl)}" readonly><button class="btn btn-outline-secondary" type="button" data-copy-share-url="${escapeHTML(share.share_url)}"><i data-lucide="copy"></i></button></div>`
                : '<small class="text-body-secondary">Token chỉ hiển thị khi tạo lại link</small>'
            }
          </td>
          <td><small class="text-body-secondary">${escapeHTML(expiry)}</small></td>
          <td><span class="badge ${share.has_password ? "bg-warning-subtle text-warning" : "bg-secondary-subtle text-secondary"} small">${share.has_password ? "Có mật khẩu" : "Không"}</span></td>
          <td><span class="badge ${share.allow_download ? "bg-success-subtle text-success" : "bg-light text-secondary"} small">${share.allow_download ? "Cho phép" : "Chỉ xem"}</span></td>
          <td><span class="fw-semibold">${share.view_count || 0}</span></td>
          <td><span class="badge ${isRevoked ? "bg-danger-subtle text-danger" : "bg-success-subtle text-success"} small">${isRevoked ? "Đã thu hồi" : "Hoạt động"}</span></td>
          <td class="text-end">
            ${
              !isRevoked
                ? `<button class="btn btn-sm btn-outline-danger" type="button" data-revoke-share-link="${escapeHTML(share.id)}"><i data-lucide="shield-x"></i> Thu hồi</button>`
                : '<span class="small text-body-tertiary">Đã khóa</span>'
            }
          </td>
        </tr>`;
    })
    .join("");

  refreshIcons(tbody);
};

export const deleteSharedDocumentForLocalDelete = async (
  localDocumentId,
  hasSharedCopy
) => {
  if (!hasSharedCopy) return;
  const shares = await api.sharing.list();
  await Promise.all(
    shares
      .filter(
        (share) => share.document_id === localDocumentId && !share.is_revoked
      )
      .map((share) => api.sharing.revoke(share.id))
  );
};
