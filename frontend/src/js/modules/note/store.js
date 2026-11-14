import api, { getToken } from "./api.js";
const storageKey = "note_workspace_v1";
const legacyDemoIds = new Set([
  "sess-1",
  "sess-2",
  "notif-1",
  "notif-2",
  "notif-3",
]);
const workspaceCollections = [
  "notes",
  "documents",
  "folders",
  "collections",
  "archives",
  "aiContexts",
  "aiWorkflows",
  "sharedLinks",
  "decks",
  "cards",
  "quizzes",
  "tasks",
  "activity",
  "sessions",
  "notifications",
];

const initialState = {
  notes: [],
  documents: [],
  folders: [],
  collections: [],
  archives: [],
  aiConnections: [],
  aiContexts: [],
  aiWorkflows: [],
  sharedLinks: [],
  decks: [],
  cards: [],
  quizzes: [],
  tasks: [],
  activity: [],
  userProfile: {
    name: "Người dùng",
    email: "",
    avatar: "N",
    title: "",
    bio: "",
    language: "vi",
    theme: "auto",
    fontSize: "16px",
    storageUsed: 0,
    storageLimit: 1073741824,
  },
  sessions: [],
  notifications: [],
};
const clone = (value) => JSON.parse(JSON.stringify(value));
let storageWarning = "";

const readState = () => {
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return clone(initialState);
    const parsed = JSON.parse(saved);
    const result = {};
    let removedLegacyData = false;
    for (const key of Object.keys(initialState)) {
      if (parsed[key] !== undefined && parsed[key] !== null) {
        result[key] = parsed[key];
      } else {
        result[key] = clone(initialState[key]);
      }
    }

    for (const key of workspaceCollections) {
      if (!Array.isArray(result[key])) continue;
      const cleanItems = result[key].filter(
        (item) => item?.isDemo !== true && !legacyDemoIds.has(item?.id)
      );
      if (cleanItems.length !== result[key].length) {
        result[key] = cleanItems;
        removedLegacyData = true;
      }
    }

    if (
      result.userProfile?.name === "Quản trị viên NOTE" &&
      result.userProfile?.email === "admin@note.workspace"
    ) {
      result.userProfile = {
        ...result.userProfile,
        ...initialState.userProfile,
        language:
          result.userProfile.language || initialState.userProfile.language,
        theme: result.userProfile.theme || initialState.userProfile.theme,
        fontSize:
          result.userProfile.fontSize || initialState.userProfile.fontSize,
      };
      removedLegacyData = true;
    }

    if (removedLegacyData) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(result));
      } catch {
        storageWarning =
          "Đã ẩn dữ liệu mẫu cũ nhưng chưa thể xóa khỏi bộ nhớ trình duyệt.";
      }
    }
    return result;
  } catch {
    storageWarning =
      "Không đọc được dữ liệu lưu cục bộ. NOTE đang dùng không gian trống trong phiên này.";
    return clone(initialState);
  }
};

let state = readState();

export const getState = () => state;
export const getStorageWarning = () => storageWarning;
export const createId = (prefix) =>
  `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;

const persist = () => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    window.dispatchEvent(new CustomEvent("note:storageerror"));
  }
  window.dispatchEvent(new CustomEvent("note:statechange"));
};

const reportBackendFailure = (operation, error) => {
  window.dispatchEvent(
    new CustomEvent("note:backenderror", {
      detail: {
        operation,
        message:
          error instanceof Error
            ? error.message
            : "Không thể đồng bộ dữ liệu với máy chủ.",
      },
    })
  );
};

const recordActivity = (text) => {
  if (!Array.isArray(state.activity)) state.activity = [];
  state.activity.unshift({
    id: createId("activity"),
    text,
    at: new Date().toISOString(),
    isDemo: false,
  });
  state.activity = state.activity.slice(0, 15);
};

// NOTES
export const addNote = (note) => {
  const created = {
    id: createId("note"),
    category: "Chưa phân loại",
    folderId: null,
    tags: [],
    pinned: false,
    favorite: false,
    isDemo: false,
    ...note,
    updatedAt: new Date().toISOString(),
  };
  state.notes.unshift(created);
  recordActivity(`Đã tạo ghi chú “${created.title}”`);
  persist();
  if (getToken()) {
    api.notes
      .create({
        title: created.title,
        category: created.category,
        content: created.content,
        folder_id: created.folderId,
        tags: created.tags,
        is_pinned: Boolean(created.pinned),
        is_favorite: Boolean(created.favorite),
      })
      .then((response) => {
        if (!response?.id) throw new Error("Máy chủ không trả về mã ghi chú.");
        if (state.notes.includes(created)) {
          created.id = response.id;
          persist();
        }
      })
      .catch((error) => reportBackendFailure("Tạo ghi chú", error));
  }
  return created;
};

export const updateNote = (id, patch) => {
  const note = state.notes.find((item) => item.id === id);
  if (!note) return;
  Object.assign(note, patch, {
    updatedAt: new Date().toISOString(),
    isDemo: false,
  });
  recordActivity(`Đã cập nhật ghi chú “${note.title}”`);
  persist();
};

export const deleteNote = (id) => {
  const note = state.notes.find((item) => item.id === id);
  if (!note) return;
  if (getToken() && !note.isDemo) {
    api.notes
      .delete(id)
      .catch((error) => reportBackendFailure("Xóa ghi chú", error));
  }
  state.notes = state.notes.filter((item) => item.id !== id);
  state.notes = state.notes.map((item) => ({
    ...item,
    related: item.related?.filter((relatedId) => relatedId !== id) ?? [],
  }));
  recordActivity(`Đã xóa ghi chú “${note.title}”`);
  persist();
};

export const toggleNoteFlag = (id, flag) => {
  const note = state.notes.find((item) => item.id === id);
  if (!note || !["pinned", "favorite"].includes(flag)) return;
  note[flag] = !note[flag];
  note.updatedAt = new Date().toISOString();
  persist();
};

// DOCUMENTS
export const addDocument = (document) => {
  const created = {
    id: createId("document"),
    addedAt: new Date().toISOString(),
    folderId: null,
    isDemo: false,
    ...document,
  };
  state.documents.unshift(created);
  recordActivity(`Đã thêm tài liệu “${created.name}”`);
  persist();
  return created;
};

export const updateDocument = (id, patch) => {
  const document = state.documents.find((item) => item.id === id);
  if (!document || document.isDemo) return null;
  Object.assign(document, patch);
  persist();
  return document;
};

export const removeDocument = (id) => {
  const document = state.documents.find((item) => item.id === id);
  if (!document || document.isDemo) return false;
  if (getToken()) {
    api.documents
      .delete(id)
      .catch((error) => reportBackendFailure("Xóa tài liệu", error));
  }
  state.documents = state.documents.filter((item) => item.id !== id);
  recordActivity(`Đã xóa tài liệu “${document.name}” khỏi thư viện`);
  persist();
  return true;
};

// FOLDERS
export const addFolder = ({ name, parentId = null, color = "emerald" }) => {
  const created = {
    id: createId("folder"),
    name,
    parentId,
    color,
    icon: "folder",
    createdAt: new Date().toISOString(),
    isDemo: false,
  };
  if (!Array.isArray(state.folders)) state.folders = [];
  state.folders.push(created);
  recordActivity(`Đã tạo thư mục “${name}”`);
  persist();
  if (getToken()) {
    api.folders
      .create({ name, parent_id: parentId, color, icon: created.icon })
      .then((response) => {
        if (!response?.id) throw new Error("Máy chủ không trả về mã thư mục.");
        if (state.folders.includes(created)) {
          created.id = response.id;
          persist();
        }
      })
      .catch((error) => reportBackendFailure("Tạo thư mục", error));
  }
  return created;
};

export const updateFolder = (id, patch) => {
  const folder = state.folders?.find((f) => f.id === id);
  if (!folder) return null;
  Object.assign(folder, patch);
  recordActivity(`Đã cập nhật thư mục “${folder.name}”`);
  persist();
  return folder;
};

export const deleteFolder = (id) => {
  const folder = state.folders?.find((f) => f.id === id);
  if (!folder) return false;
  if (getToken() && !folder.isDemo) {
    api.folders
      .delete(id)
      .catch((error) => reportBackendFailure("Xóa thư mục", error));
  }
  state.folders = state.folders.filter((f) => f.id !== id && f.parentId !== id);
  // Unassign documents and notes from this folder
  state.documents.forEach((d) => {
    if (d.folderId === id) d.folderId = null;
  });
  state.notes.forEach((n) => {
    if (n.folderId === id) n.folderId = null;
  });
  recordActivity(`Đã xóa thư mục “${folder.name}”`);
  persist();
  return true;
};

// COLLECTIONS
export const addCollection = ({
  name,
  description = "",
  color = "#10b981",
  tags = [],
}) => {
  const created = {
    id: createId("col"),
    name,
    description,
    color,
    tags,
    documentIds: [],
    noteIds: [],
    deckIds: [],
    createdAt: new Date().toISOString(),
    isDemo: false,
  };
  if (!Array.isArray(state.collections)) state.collections = [];
  state.collections.unshift(created);
  recordActivity(`Đã tạo bộ sưu tập “${name}”`);
  persist();
  return created;
};

export const updateCollection = (id, patch) => {
  const col = state.collections?.find((c) => c.id === id);
  if (!col) return null;
  Object.assign(col, patch);
  recordActivity(`Đã cập nhật bộ sưu tập “${col.name}”`);
  persist();
  return col;
};

export const deleteCollection = (id) => {
  const col = state.collections?.find((c) => c.id === id);
  if (!col) return false;
  state.collections = state.collections.filter((c) => c.id !== id);
  recordActivity(`Đã xóa bộ sưu tập “${col.name}”`);
  persist();
  return true;
};

// ARCHIVES (ZIP / 7Z)
export const addArchive = (archiveData) => {
  const created = {
    id: createId("arch"),
    uploadedAt: new Date().toISOString(),
    isSafe: true,
    scanStatus: "clean",
    files: [],
    extractedFiles: [],
    history: [],
    isDemo: false,
    ...archiveData,
  };
  if (!Array.isArray(state.archives)) state.archives = [];
  state.archives.unshift(created);
  recordActivity(`Đã tải lên gói nén “${created.name}”`);
  persist();
  return created;
};

export const updateArchive = (id, patch) => {
  const archive = state.archives?.find((a) => a.id === id);
  if (!archive) return null;
  Object.assign(archive, patch);
  persist();
  return archive;
};

export const removeArchive = (id) => {
  const archive = state.archives?.find((a) => a.id === id);
  if (!archive) return false;
  state.archives = state.archives.filter((a) => a.id !== id);
  recordActivity(`Đã xóa gói nén “${archive.name}”`);
  persist();
  return true;
};

// AI CONNECTIONS (BYOK)
export const updateAiConnection = (id, patch) => {
  const conn = state.aiConnections?.find((c) => c.id === id);
  if (!conn) return null;
  Object.assign(conn, patch, { updatedAt: new Date().toISOString() });
  persist();
  return conn;
};

export const replaceAiConnections = (connections) => {
  state.aiConnections = connections.map((connection) => ({
    ...connection,
    provider_id:
      connection.provider_id || connection.providerId || connection.provider,
    apiKeyMasked: connection.apiKeyMasked || connection.api_key_masked || "",
    isConnected: connection.isConnected ?? connection.is_connected ?? false,
    defaultModel:
      connection.defaultModel ||
      connection.default_model_name ||
      connection.default_model_id ||
      "",
    customEndpoint:
      connection.customEndpoint || connection.custom_endpoint || null,
    models: connection.models || [],
  }));
  persist();
};

// AI CONTEXTS
const isServerId = (id) =>
  typeof id === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id
  );

export const saveAiContext = async (contextData) => {
  let savedData = { ...contextData };
  if (getToken()) {
    const response = await api.ai.saveContext({
      id: isServerId(contextData.id) ? contextData.id : undefined,
      name: contextData.title,
      description: contextData.summary,
      capsule_json: JSON.stringify(contextData),
    });
    const capsule = JSON.parse(response.capsule_json);
    savedData = {
      ...capsule,
      id: response.id,
      title: response.name,
      version: response.version,
      summary: response.description || capsule.summary || "",
      updatedAt: response.updated_at,
      isDemo: false,
    };
  }

  if (!Array.isArray(state.aiContexts)) state.aiContexts = [];
  const existing = state.aiContexts.find((c) => c.id === savedData.id);
  if (existing) {
    const prevVersion = existing.version || "1.0.0";
    const vParts = prevVersion.split(".").map(Number);
    vParts[2] = (vParts[2] || 0) + 1;
    const newVersion = savedData.version || vParts.join(".");
    existing.versions = existing.versions || [];
    existing.versions.unshift({
      version: prevVersion,
      at: existing.updatedAt || new Date().toISOString(),
      note: "Bản sao lưu trước khi cập nhật",
    });
    Object.assign(existing, savedData, {
      version: newVersion,
      updatedAt: new Date().toISOString(),
    });
    recordActivity(
      `Đã cập nhật AI Context “${existing.title}” (v${newVersion})`
    );
    persist();
    return existing;
  }
  const created = {
    id: createId("ctx"),
    version: "1.0.0",
    updatedAt: new Date().toISOString(),
    sources: [],
    insights: [],
    openQuestions: [],
    progress: 50,
    handoffDirective: "",
    versions: [
      {
        version: "1.0.0",
        at: new Date().toISOString(),
        note: "Khởi tạo ngữ cảnh ban đầu",
      },
    ],
    isDemo: false,
    ...savedData,
  };
  state.aiContexts.unshift(created);
  recordActivity(`Đã tạo AI Context “${created.title}”`);
  persist();
  return created;
};

export const deleteAiContext = async (id) => {
  const ctx = state.aiContexts?.find((c) => c.id === id);
  if (!ctx) return false;
  if (getToken() && isServerId(id)) await api.ai.deleteContext(id);
  state.aiContexts = state.aiContexts.filter((c) => c.id !== id);
  recordActivity(`Đã xóa AI Context “${ctx.title}”`);
  persist();
  return true;
};

// AI WORKFLOWS
export const addAiWorkflow = (workflowData) => {
  const created = {
    id: createId("wf"),
    status: "queued",
    progress: 0,
    lastRun: new Date().toISOString(),
    steps: [],
    history: [],
    isDemo: false,
    ...workflowData,
  };
  if (!Array.isArray(state.aiWorkflows)) state.aiWorkflows = [];
  state.aiWorkflows.unshift(created);
  recordActivity(`Đã tạo quy trình AI “${created.name}”`);
  persist();
  return created;
};

export const updateAiWorkflow = (id, patch) => {
  const wf = state.aiWorkflows?.find((w) => w.id === id);
  if (!wf) return null;
  Object.assign(wf, patch);
  persist();
  return wf;
};

// SHARED LINKS
export const addSharedLink = (shareData) => {
  const created = {
    id: createId("share"),
    token: `shr_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`,
    createdAt: new Date().toISOString(),
    viewsCount: 0,
    status: "active",
    isDemo: false,
    ...shareData,
  };
  created.url = `/share.html?token=${created.token}`;
  if (!Array.isArray(state.sharedLinks)) state.sharedLinks = [];
  state.sharedLinks.unshift(created);
  recordActivity(`Đã tạo liên kết chia sẻ cho “${created.title}”`);
  persist();
  return created;
};

export const revokeSharedLink = (id) => {
  const link = state.sharedLinks?.find((s) => s.id === id);
  if (!link) return false;
  link.status = "revoked";
  recordActivity(`Đã thu hồi liên kết chia sẻ “${link.title}”`);
  persist();
  return true;
};

// TASKS & LEARNING
export const addTask = (task) => {
  const created = {
    id: createId("task"),
    dueDate: new Date().toISOString(),
    completed: false,
    isDemo: false,
    ...task,
  };
  state.tasks.unshift(created);
  recordActivity(`Đã thêm nhiệm vụ “${created.title}”`);
  persist();
};

export const toggleTask = (id) => {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  task.completed = !task.completed;
  recordActivity(
    `${task.completed ? "Đã hoàn thành" : "Đã mở lại"} nhiệm vụ “${task.title}”`
  );
  persist();
};

export const addCard = ({ deckName, front, back }) => {
  let deck = state.decks.find(
    (item) => item.name.toLocaleLowerCase() === deckName.toLocaleLowerCase()
  );
  if (!deck) {
    deck = { id: createId("deck"), name: deckName, isDemo: false };
    state.decks.unshift(deck);
  }
  state.cards.push({
    id: createId("card"),
    deckId: deck.id,
    front,
    back,
    known: false,
    isDemo: false,
  });
  recordActivity(`Đã tạo flashcard trong bộ “${deck.name}”`);
  persist();
  return deck.id;
};

export const reviewCard = (id, known) => {
  const card = state.cards.find((item) => item.id === id);
  if (!card) return;
  card.known = known;
  card.reviewedAt = new Date().toISOString();
  persist();
};

export const addQuiz = (quiz) => {
  const created = { id: createId("quiz"), isDemo: false, ...quiz };
  state.quizzes.unshift(created);
  recordActivity(`Đã tạo bộ câu hỏi “${created.title}”`);
  persist();
  return created;
};

// USER & SYSTEM
export const updateUserProfile = (patch) => {
  if (!state.userProfile) state.userProfile = clone(initialState.userProfile);
  Object.assign(state.userProfile, patch);
  persist();
  return state.userProfile;
};

export const markNotificationRead = (id) => {
  const notif = state.notifications?.find((n) => n.id === id);
  if (notif) {
    notif.read = true;
    persist();
  }
};

export const markAllNotificationsRead = () => {
  state.notifications?.forEach((n) => (n.read = true));
  persist();
};

export const exportState = () => JSON.stringify(state, null, 2);

export const syncFromBackend = async () => {
  const token = getToken();
  if (!token) return;

  try {
    const bs = await api.sync.bootstrap();
    if (!bs) return;

    for (const key of [
      "folders",
      "documents",
      "notes",
      "collections",
      "archives",
    ]) {
      if (Array.isArray(bs[key])) state[key] = bs[key];
    }
    if (Array.isArray(bs.aiConnections)) state.aiConnections = bs.aiConnections;
    if (Array.isArray(bs.aiContexts)) state.aiContexts = bs.aiContexts;
    if (Array.isArray(bs.quizzes)) state.quizzes = bs.quizzes;
    if (Array.isArray(bs.sharedLinks)) state.sharedLinks = bs.sharedLinks;
    if (Array.isArray(bs.notifications)) state.notifications = bs.notifications;
    if (Array.isArray(bs.activity)) state.activity = bs.activity;
    if (bs.flashcards && Array.isArray(bs.flashcards.decks)) {
      state.decks = bs.flashcards.decks;
      state.cards = bs.flashcards.decks.flatMap((deck) =>
        (deck.cards || []).map((card) => ({
          ...card,
          deckId: deck.id,
          known: card.isKnown,
        }))
      );
    }
    if (bs.user) {
      state.userProfile = {
        ...(state.userProfile || {}),
        ...bs.user,
        name: bs.user.full_name,
        avatar: bs.user.avatar_url || bs.user.full_name?.slice(0, 1) || "N",
        theme: bs.user.theme_preference,
      };
    }
    persist();
  } catch (err) {
    console.warn(
      "Backend sync note:",
      err instanceof Error ? err.message : err
    );
    reportBackendFailure("Đồng bộ không gian làm việc", err);
  }
};
