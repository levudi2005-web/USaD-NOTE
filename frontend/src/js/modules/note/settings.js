import { getState, replaceAiConnections, updateUserProfile } from "./store";
import { escapeHTML, formatBytes, refreshIcons, showToast } from "./utils";
import api, { getToken } from "./api";

let aiProviders = [];
let aiModels = [];
let aiSettingsError = "";

const providerCard = (provider, connection) => {
  const providerId = escapeHTML(provider.id);
  const models = aiModels.filter((model) => model.provider_id === provider.id);
  const selectedModel =
    connection?.default_model_id ||
    connection?.defaultModelId ||
    models.find((model) => model.is_default)?.id;
  const isConnected =
    connection?.is_connected ?? connection?.isConnected ?? false;
  const maskedKey =
    connection?.api_key_masked || connection?.apiKeyMasked || "";
  const endpoint =
    connection?.custom_endpoint || connection?.customEndpoint || "";
  const modelOptions = models
    .map(
      (model) =>
        `<option value="${escapeHTML(model.id)}" ${model.id === selectedModel ? "selected" : ""}>${escapeHTML(model.name)}</option>`
    )
    .join("");
  const needsLogin = !getToken();

  return `
    <div class="col-md-6">
      <div class="card h-100 border p-4 shadow-none note-interactive-card">
        <div class="d-flex align-items-center justify-content-between mb-3">
          <div class="d-flex align-items-center gap-2">
            <span class="p-2 rounded bg-primary-subtle text-primary"><i data-lucide="cpu" style="width:20px;height:20px"></i></span>
            <div>
              <h6 class="fw-bold mb-0">${escapeHTML(provider.name)}</h6>
              <small class="text-body-secondary">${providerId}</small>
            </div>
          </div>
          <span class="badge ${isConnected ? "bg-success-subtle text-success" : "bg-secondary-subtle text-secondary"} small">
            ${isConnected ? "Đã kiểm tra" : connection ? "Chưa kiểm tra" : "Chưa cấu hình"}
          </span>
        </div>

        <div class="mb-3">
          <label class="form-label small fw-semibold">${connection ? "Tên kết nối" : "Tên kết nối mới"}</label>
          <input class="form-control form-control-sm" value="${escapeHTML(connection?.name || provider.name)}" data-byok-name="${providerId}" ${needsLogin ? "disabled" : ""}>
        </div>
        <div class="mb-3">
          <label class="form-label small fw-semibold">API Key</label>
          <input type="password" class="form-control form-control-sm font-monospace" autocomplete="new-password"
            placeholder="${connection ? `Đã lưu ${escapeHTML(maskedKey)}; để trống để giữ nguyên` : "Dán API Key"}"
            data-byok-key-input="${providerId}" ${needsLogin ? "disabled" : ""}>
          <small class="text-body-tertiary" style="font-size:11px">Mã hóa và lưu ở backend; không lưu khóa gốc trong trình duyệt.</small>
        </div>
        <div class="mb-3">
          <label class="form-label small fw-semibold">Mô hình mặc định</label>
          <select class="form-select form-select-sm" data-byok-model-select="${providerId}" ${needsLogin || !models.length ? "disabled" : ""}>
            ${modelOptions || '<option value="">Chưa có model trong danh mục SQL</option>'}
          </select>
        </div>
        <div class="mb-3">
          <label class="form-label small fw-semibold">API Endpoint tùy chỉnh (không bắt buộc)</label>
          <input class="form-control form-control-sm" type="url" placeholder="${escapeHTML(provider.base_url || "https://...")}"
            value="${escapeHTML(endpoint)}" data-byok-endpoint="${providerId}" ${needsLogin ? "disabled" : ""}>
        </div>
        <div class="d-flex align-items-center gap-2 pt-3 border-top mt-auto">
          ${
            connection
              ? `<button class="btn btn-sm btn-primary" type="button" data-byok-save="${providerId}" ${needsLogin ? "disabled" : ""}>Lưu thay đổi</button>
               <button class="btn btn-sm btn-outline-info" type="button" data-byok-test="${escapeHTML(connection.id)}" ${needsLogin ? "disabled" : ""}>Kiểm tra kết nối</button>
               <button class="btn btn-sm btn-outline-danger ms-auto" type="button" data-byok-delete="${escapeHTML(connection.id)}" ${needsLogin ? "disabled" : ""}>Xóa</button>`
              : `<button class="btn btn-sm btn-primary" type="button" data-byok-create="${providerId}" ${needsLogin || !models.length ? "disabled" : ""}>Thêm kết nối</button>`
          }
        </div>
        ${needsLogin ? '<p class="small text-warning mt-3 mb-0">Đăng nhập để quản lý API Key. <a href="pages-sign-in.html">Đăng nhập</a></p>' : ""}
      </div>
    </div>`;
};

export const renderSettings = () => {
  const state = getState();
  const byokGrid = document.querySelector("[data-byok-providers-grid]");
  const sessionsList = document.querySelector("[data-sessions-list]");
  const profileForm = document.querySelector("[data-profile-form]");

  if (profileForm && state.userProfile) {
    for (const field of ["name", "email", "title", "bio"]) {
      const input = profileForm.elements.namedItem(field);
      if (input) input.value = state.userProfile[field] || "";
    }
  }

  const storageUsed = (state.documents || []).reduce(
    (total, document) => total + (Number(document.size) || 0),
    0
  );
  const storageLabel = document.querySelector("[data-storage-used]");
  if (storageLabel) storageLabel.textContent = formatBytes(storageUsed);

  if (byokGrid) {
    if (aiSettingsError) {
      byokGrid.innerHTML = `<div class="col-12"><div class="alert alert-danger" role="alert">${escapeHTML(aiSettingsError)}</div></div>`;
    } else if (!aiProviders.length) {
      byokGrid.innerHTML =
        '<div class="col-12"><p class="text-body-secondary">Chưa tải được danh mục AI. Kiểm tra API và dữ liệu seed của MariaDB.</p></div>';
    } else {
      byokGrid.innerHTML = aiProviders
        .map((provider) =>
          providerCard(
            provider,
            (state.aiConnections || []).find(
              (connection) => connection.provider_id === provider.id
            )
          )
        )
        .join("");
      refreshIcons(byokGrid);
    }
  }

  if (sessionsList) {
    const sessions = state.sessions || [];
    sessionsList.innerHTML = sessions
      .map(
        (session) => `
        <div class="list-group-item d-flex align-items-center justify-content-between p-3 border">
          <div class="d-flex align-items-center gap-3">
            <span class="p-2 rounded bg-body-tertiary text-body-secondary"><i data-lucide="laptop" style="width:20px;height:20px"></i></span>
            <div>
              <strong class="d-block small">${escapeHTML(session.device)} ${session.isCurrent ? '<span class="badge bg-success-subtle text-success small ms-1">Phiên này</span>' : ""}</strong>
              <small class="text-body-secondary">IP: ${escapeHTML(session.ip)} &bull; Hoạt động: ${escapeHTML(session.lastActive)}</small>
            </div>
          </div>
          ${!session.isCurrent ? `<button class="btn btn-sm btn-outline-danger" type="button" data-revoke-session="${escapeHTML(session.id)}">Đăng xuất</button>` : ""}
        </div>`
      )
      .join("");
    refreshIcons(sessionsList);
  }
};

const loadAiSettings = async () => {
  try {
    const [providers, models] = await Promise.all([
      api.ai.getProviders(),
      api.ai.getModels(),
    ]);
    aiProviders = providers;
    aiModels = models;
    aiSettingsError = "";
    if (getToken()) {
      const connections = await api.ai.getConnections();
      replaceAiConnections(connections);
    } else {
      replaceAiConnections([]);
    }
  } catch (error) {
    aiSettingsError = error.message || "Không thể tải cài đặt AI.";
  }
  renderSettings();
};

const findProviderElements = (providerId) => ({
  name: document.querySelector(`[data-byok-name="${providerId}"]`),
  key: document.querySelector(`[data-byok-key-input="${providerId}"]`),
  model: document.querySelector(`[data-byok-model-select="${providerId}"]`),
  endpoint: document.querySelector(`[data-byok-endpoint="${providerId}"]`),
});

export const initSettings = () => {
  renderSettings();
  loadAiSettings();
  window.addEventListener("note:statechange", renderSettings);
  window.addEventListener("note:viewchange", (event) => {
    if (event.detail.view === "settings") loadAiSettings();
  });

  const profileForm = document.querySelector("[data-profile-form]");
  profileForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(profileForm);
    const name = data.get("name")?.toString().trim();
    const email = data.get("email")?.toString().trim();
    const title = data.get("title")?.toString().trim();
    const bio = data.get("bio")?.toString().trim();

    if (!name || !email) return;
    try {
      await api.auth.updateMe({
        full_name: name,
        email,
        title,
        bio,
      });
      updateUserProfile({ name, email, title, bio });
      showToast("Đã cập nhật hồ sơ cá nhân thành công!", "success");
    } catch (error) {
      showToast(error.message || "Không thể cập nhật hồ sơ.", "danger");
    }
  });

  document.addEventListener("click", async (event) => {
    const createButton = event.target.closest("[data-byok-create]");
    const saveButton = event.target.closest("[data-byok-save]");
    const testButton = event.target.closest("[data-byok-test]");
    const deleteButton = event.target.closest("[data-byok-delete]");

    try {
      if (createButton || saveButton) {
        const providerId = (createButton || saveButton).dataset[
          createButton ? "byokCreate" : "byokSave"
        ];
        const elements = findProviderElements(providerId);
        const name = elements.name?.value.trim();
        const apiKey = elements.key?.value.trim();
        const modelId = elements.model?.value;
        const endpoint = elements.endpoint?.value.trim() || null;

        if (createButton) {
          if (!apiKey) {
            showToast("Vui lòng nhập API Key.", "warning");
            return;
          }
          await api.ai.createConnection({
            provider_id: providerId,
            name,
            api_key: apiKey,
            default_model_id: modelId,
            custom_endpoint: endpoint,
          });
        } else {
          const patch = {
            name,
            default_model_id: modelId,
            custom_endpoint: endpoint,
          };
          if (apiKey) patch.api_key = apiKey;
          await api.ai.updateConnection(
            getState().aiConnections.find(
              (connection) => connection.provider_id === providerId
            ).id,
            patch
          );
        }
        await loadAiSettings();
        showToast(
          createButton ? "Đã lưu kết nối AI." : "Đã cập nhật kết nối AI.",
          "success"
        );
        return;
      }

      if (testButton) {
        await api.ai.testConnection(testButton.dataset.byokTest);
        await loadAiSettings();
        showToast("Kiểm tra kết nối AI thành công.", "success");
        return;
      }

      if (deleteButton) {
        if (!window.confirm("Xóa API Key đã mã hóa và kết nối AI này?")) return;
        await api.ai.deleteConnection(deleteButton.dataset.byokDelete);
        await loadAiSettings();
        showToast("Đã xóa kết nối AI.", "success");
        return;
      }

      const revokeButton = event.target.closest("[data-revoke-session]");
      if (revokeButton) {
        await api.auth.revokeSession(revokeButton.dataset.revokeSession);
        const state = getState();
        state.sessions = (state.sessions || []).filter(
          (session) => session.id !== revokeButton.dataset.revokeSession
        );
        renderSettings();
        showToast("Đã thu hồi phiên làm việc.", "info");
        return;
      }

      if (event.target.closest("[data-clear-all-data]")) {
        if (
          window.confirm(
            "CẢNH BÁO: Hành động này sẽ đặt lại dữ liệu đang lưu trong trình duyệt. Tiếp tục?"
          )
        ) {
          localStorage.clear();
          window.location.reload();
        }
      }
    } catch (error) {
      showToast(error.message || "Thao tác không thành công.", "danger");
    }
  });
};
