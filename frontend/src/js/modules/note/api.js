/**
 * Central API Client for NOTE Frontend
 * Connects directly to FastAPI backend on 127.0.0.1:8000
 */

const BASE_URL = import.meta.env?.VITE_API_BASE_URL || "/api/v1";
const API_TIMEOUT_MS = 30_000;

export const getToken = () => localStorage.getItem("note_auth_token");
export const setToken = (token) =>
  localStorage.setItem("note_auth_token", token);
export const clearToken = () => localStorage.removeItem("note_auth_token");

export const isAuthenticated = () => Boolean(getToken());

async function request(endpoint, options = {}) {
  const url = `${BASE_URL.replace(/\/+$/, "")}/${endpoint.replace(/^\/+/, "")}`;
  const isPublicShare = endpoint
    .replace(/^\/+/, "")
    .startsWith("public/share/");
  const responseType = options.responseType;
  const fetchOptions = { ...options };
  delete fetchOptions.responseType;
  const headers = { ...(options.headers || {}) };

  const token = getToken();
  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // If not FormData, default to application/json
  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  let response;
  try {
    response = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: fetchOptions.signal || AbortSignal.timeout(API_TIMEOUT_MS),
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw new Error(
        "Máy chủ không phản hồi trong thời gian chờ. Vui lòng thử lại.",
        { cause: error }
      );
    }
    if (error instanceof TypeError) {
      throw new Error(
        "Không kết nối được tới API. Hãy kiểm tra FastAPI và cấu hình proxy.",
        { cause: error }
      );
    }
    throw error;
  }

  if (response.status === 401 && !isPublicShare) {
    // Session expired or invalid
    clearToken();
    window.dispatchEvent(new CustomEvent("note:auth:unauthorized"));
  }

  if (!response.ok) {
    let errorDetail =
      response.status === 502
        ? "Proxy không kết nối được tới backend. Hãy kiểm tra FastAPI và địa chỉ proxy."
        : "Đã xảy ra lỗi khi gọi máy chủ";
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || errJson.message || errorDetail;
    } catch {
      if (response.status !== 502) {
        errorDetail = `Lỗi HTTP ${response.status}: ${response.statusText}`;
      }
    }
    const error = new Error(errorDetail);
    error.status = response.status;
    error.passwordRequired = isPublicShare && response.status === 401;
    throw error;
  }

  if (responseType === "blob") return response.blob();
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

export const api = {
  // 1. AUTH
  auth: {
    register: (email, password, full_name) =>
      request("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, full_name }),
      }),
    login: (email, password) =>
      request("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    getMe: () => request("/auth/me"),
    updateMe: (data) =>
      request("/auth/me", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    changePassword: (old_password, new_password) =>
      request("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ old_password, new_password }),
      }),
    recoverPassword: (email, recovery_code, new_password) =>
      request("/auth/recover", {
        method: "POST",
        body: JSON.stringify({ email, recovery_code, new_password }),
      }),
    generateRecoveryCode: () =>
      request("/auth/generate-recovery-code", { method: "POST" }),
    getSessions: () => request("/auth/sessions"),
    revokeSession: (sessionId) =>
      request(`/auth/sessions/${sessionId}`, { method: "DELETE" }),
    logout: async () => {
      try {
        return await request("/auth/logout", { method: "POST" });
      } finally {
        clearToken();
      }
    },
  },

  // 2. WORKSPACE SYNC BOOTSTRAP
  sync: {
    bootstrap: () => request("/sync/bootstrap"),
  },

  // 3. FOLDERS
  folders: {
    list: () => request("/folders"),
    create: (data) =>
      request("/folders", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id, data) =>
      request(`/folders/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id) => request(`/folders/${id}`, { method: "DELETE" }),
  },

  // 4. DOCUMENTS
  documents: {
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/documents${q ? `?${q}` : ""}`);
    },
    upload: (file, folderId = null) => {
      const fd = new FormData();
      fd.append("file", file);
      if (folderId) fd.append("folder_id", folderId);
      return request("/documents/upload", {
        method: "POST",
        body: fd,
      });
    },
    get: (id) => request(`/documents/${id}`),
    getContent: (id) => request(`/documents/${id}/content`),
    update: (id, data) =>
      request(`/documents/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id) => request(`/documents/${id}`, { method: "DELETE" }),
    restore: (id) => request(`/documents/${id}/restore`, { method: "POST" }),
    permanentDelete: (id) =>
      request(`/documents/${id}/permanent`, { method: "DELETE" }),
  },

  // 5. NOTES
  notes: {
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/notes${q ? `?${q}` : ""}`);
    },
    create: (data) =>
      request("/notes", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    get: (id) => request(`/notes/${id}`),
    update: (id, data) =>
      request(`/notes/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id) => request(`/notes/${id}`, { method: "DELETE" }),
  },

  // 6. COLLECTIONS
  collections: {
    list: () => request("/collections"),
    create: (data) =>
      request("/collections", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    get: (id) => request(`/collections/${id}`),
    update: (id, data) =>
      request(`/collections/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id) => request(`/collections/${id}`, { method: "DELETE" }),
    addItem: (collectionId, itemData) => {
      const q = new URLSearchParams(itemData).toString();
      return request(`/collections/${collectionId}/items?${q}`, {
        method: "POST",
      });
    },
  },

  // 7. ARCHIVES (ZIP / 7Z)
  archives: {
    list: () => request("/archives"),
    upload: (file) => {
      const fd = new FormData();
      fd.append("file", file);
      return request("/archives/upload", {
        method: "POST",
        body: fd,
      });
    },
    getManifest: (id) => request(`/archives/${id}/manifest`),
    extract: (id, innerPaths, targetFolderId = null) =>
      request(`/archives/${id}/extract`, {
        method: "POST",
        body: JSON.stringify({
          inner_paths: innerPaths,
          target_folder_id: targetFolderId,
        }),
      }),
    delete: (id) => request(`/archives/${id}`, { method: "DELETE" }),
  },

  // 8. AI BYOK & CHAT
  ai: {
    getProviders: () => request("/ai/providers"),
    getModels: (providerId = null) =>
      request(`/ai/models${providerId ? `?provider_id=${providerId}` : ""}`),
    getConnections: () => request("/ai/connections"),
    createConnection: (data) =>
      request("/ai/connections", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateConnection: (id, data) =>
      request(`/ai/connections/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    deleteConnection: (id) =>
      request(`/ai/connections/${id}`, { method: "DELETE" }),
    testConnection: (id) =>
      request(`/ai/connections/${id}/test`, { method: "POST" }),
    chat: (data) =>
      request("/ai/chat", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    getConversations: () => request("/ai/conversations"),
    getConversation: (id) => request(`/ai/conversations/${id}`),
    deleteConversation: (id) =>
      request(`/ai/conversations/${id}`, { method: "DELETE" }),
    getContexts: () => request("/ai/contexts"),
    saveContext: (data) =>
      request("/ai/contexts", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    deleteContext: (id) => request(`/ai/contexts/${id}`, { method: "DELETE" }),
  },

  // 9. FLASHCARDS
  flashcards: {
    getDecks: () => request("/flashcards/decks"),
    createDeck: (data) =>
      request("/flashcards/decks", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    getDeck: (id) => request(`/flashcards/decks/${id}`),
    deleteDeck: (id) =>
      request(`/flashcards/decks/${id}`, { method: "DELETE" }),
    addCard: (deckId, data) =>
      request(`/flashcards/decks/${deckId}/cards`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    deleteCard: (id) =>
      request(`/flashcards/cards/${id}`, { method: "DELETE" }),
    reviewCard: (id, known) =>
      request(`/flashcards/cards/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ known }),
      }),
  },

  // 10. QUIZZES
  quizzes: {
    list: () => request("/quizzes"),
    create: (data) =>
      request("/quizzes", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    get: (id) => request(`/quizzes/${id}`),
    submit: (id, answers, timeSpent = 0) =>
      request(`/quizzes/${id}/submit`, {
        method: "POST",
        body: JSON.stringify({
          answers,
          time_spent_seconds: timeSpent,
        }),
      }),
    delete: (id) => request(`/quizzes/${id}`, { method: "DELETE" }),
  },

  // 11. SHARING
  sharing: {
    list: () => request("/sharing"),
    create: (data) =>
      request("/sharing", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id, data) =>
      request(`/sharing/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    rotate: (id) => request(`/sharing/${id}/rotate`, { method: "POST" }),
    revoke: (id) => request(`/sharing/${id}`, { method: "DELETE" }),
    accessPublic: (token, password = null) =>
      request(`/public/share/${token}`, {
        method: "POST",
        body: JSON.stringify({ password }),
      }),
    downloadPublic: (token, password = null) =>
      request(`/public/share/${token}/download`, {
        method: "POST",
        body: JSON.stringify({ password }),
        responseType: "blob",
      }),
  },

  // 12. SETTINGS & LOGS
  settings: {
    getActivity: () => request("/settings/activity"),
    getNotifications: () => request("/settings/notifications"),
    markNotificationRead: (id) =>
      request(`/settings/notifications/${id}/read`, { method: "PUT" }),
    markAllNotificationsRead: () =>
      request("/settings/notifications/read-all", { method: "PUT" }),
  },
};

export default api;
