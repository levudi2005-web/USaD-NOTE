import { getState, toggleTask } from "./store";
import {
  escapeHTML,
  formatBytes,
  formatDate,
  formatDateTime,
  refreshIcons,
} from "./utils";

const renderActivity = (container, items) => {
  if (!container) return;
  container.innerHTML =
    items && items.length
      ? items
          .map(
            (item) => `
            <div class="note-activity-row d-flex align-items-start gap-2 py-2 border-bottom border-light-subtle">
              <span class="note-activity-dot mt-1 p-1 rounded-circle bg-primary"></span>
              <div class="flex-grow-1 overflow-hidden">
                <span class="d-block small text-truncate">${escapeHTML(item.text)}</span>
                <small class="text-body-tertiary" style="font-size:11px">${escapeHTML(formatDateTime(item.at))}</small>
              </div>
            </div>`
          )
          .join("")
      : '<p class="text-body-secondary small py-3 text-center mb-0">Chưa có hoạt động nào được ghi lại.</p>';
};

export const renderDashboard = () => {
  const state = getState();
  const todayLabel = document.querySelector("[data-today-label]");
  if (todayLabel) {
    todayLabel.textContent = new Intl.DateTimeFormat("vi-VN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
      .format(new Date())
      .toLocaleUpperCase("vi-VN");
  }

  const notesCount = (state.notes || []).length;
  const docsCount = (state.documents || []).length;
  const decksCount = (state.decks || []).length;
  const dueCardsCount = (state.cards || []).filter(
    (card) => !card.known
  ).length;
  const knownCardsCount = (state.cards || []).filter(
    (card) => card.known
  ).length;
  const quizzesCount = (state.quizzes || []).length;
  const tasksCount = (state.tasks || []).length;
  const completedTasks = (state.tasks || []).filter((t) => t.completed).length;
  const progressPercent = tasksCount
    ? Math.round((completedTasks / tasksCount) * 100)
    : 0;

  const statElements = {
    notes: notesCount,
    documents: docsCount,
    decks: decksCount,
    "due-cards": dueCardsCount,
    "known-cards": knownCardsCount,
    quizzes: quizzesCount,
    "completed-tasks": completedTasks,
    progress: progressPercent,
    "storage-used": formatBytes(
      (state.documents || []).reduce(
        (total, document) => total + (Number(document.size) || 0),
        0
      )
    ),
    "ai-queries": "—",
  };

  document.querySelectorAll("[data-stat]").forEach((element) => {
    const key = element.dataset.stat;
    if (statElements[key] !== undefined) {
      element.textContent = String(statElements[key]);
    }
  });

  document.querySelectorAll("[data-progress-bar]").forEach((bar) => {
    bar.style.width = `${progressPercent}%`;
  });

  // Recent Notes List
  const recentNotes = document.querySelector("[data-dashboard-notes]");
  if (recentNotes) {
    const sortedNotes = [...(state.notes || [])]
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 4);

    recentNotes.innerHTML = sortedNotes.length
      ? sortedNotes
          .map(
            (note) => `
            <button class="list-group-item list-group-item-action d-flex align-items-center gap-3 p-3 border-0 border-bottom" type="button" data-open-note="${escapeHTML(note.id)}">
              <span class="p-2 rounded bg-primary-subtle text-primary"><i data-lucide="notebook-pen" style="width:18px;height:18px"></i></span>
              <div class="flex-grow-1 text-start overflow-hidden">
                <strong class="d-block text-truncate small">${escapeHTML(note.title)}</strong>
                <small class="text-body-secondary d-block text-truncate">${escapeHTML(note.category || "Chưa phân loại")} &bull; ${escapeHTML(formatDate(note.updatedAt))}</small>
              </div>
              <i data-lucide="arrow-up-right" class="text-body-tertiary" style="width:16px;height:16px"></i>
            </button>`
          )
          .join("")
      : '<div class="p-4 text-center text-body-secondary small">Chưa có ghi chú nào. Hãy tạo ghi chú đầu tiên.</div>';
    refreshIcons(recentNotes);
  }

  // Recent Documents List
  const recentDocuments = document.querySelector("[data-dashboard-documents]");
  if (recentDocuments) {
    const sortedDocs = [...(state.documents || [])]
      .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt))
      .slice(0, 4);

    recentDocuments.innerHTML = sortedDocs.length
      ? sortedDocs
          .map(
            (doc) => `
            <button class="list-group-item list-group-item-action d-flex align-items-center gap-3 p-3 border-0 border-bottom" type="button" data-open-document="${escapeHTML(doc.id)}">
              <span class="p-2 rounded bg-info-subtle text-info"><i data-lucide="file-text" style="width:18px;height:18px"></i></span>
              <div class="flex-grow-1 text-start overflow-hidden">
                <strong class="d-block text-truncate small">${escapeHTML(doc.name)}</strong>
                <small class="text-body-secondary d-block text-truncate">${escapeHTML((doc.type || "file").toUpperCase())} &bull; ${escapeHTML(formatDate(doc.addedAt))}</small>
              </div>
              <span class="badge bg-light text-secondary border small">Đọc</span>
            </button>`
          )
          .join("")
      : '<div class="p-4 text-center text-body-secondary small">Thư viện trống. Hãy tải lên tài liệu để bắt đầu.</div>';
    refreshIcons(recentDocuments);
  }

  // Tasks in dashboard
  const tasksContainer = document.querySelector("[data-dashboard-tasks]");
  if (tasksContainer) {
    const tasks = state.tasks || [];
    tasksContainer.innerHTML = tasks.length
      ? tasks
          .slice(0, 4)
          .map(
            (task) => `
            <div class="d-flex align-items-center gap-2 py-2 border-bottom border-light-subtle">
              <input type="checkbox" class="form-check-input mt-0" data-toggle-task="${escapeHTML(task.id)}" ${task.completed ? "checked" : ""}>
              <span class="flex-grow-1 small ${task.completed ? "text-decoration-line-through text-body-tertiary" : "fw-medium"}">${escapeHTML(task.title)}</span>
              <span class="badge bg-secondary-subtle text-secondary small" style="font-size:10px">${task.minutes}p</span>
            </div>`
          )
          .join("")
      : '<p class="text-body-secondary small py-2 mb-0">Không có nhiệm vụ nào hôm nay.</p>';
  }

  // Activities
  const activityList = document.querySelector("[data-activity-list]");
  if (activityList) {
    renderActivity(activityList, state.activity || []);
  }

  // Update profile name in header/sidebar if changed
  const profileNameEl = document.querySelector("[data-user-profile-name]");
  const profileNameShortEl = document.querySelector(
    "[data-user-profile-name-short]"
  );
  const profileEmailEl = document.querySelector("[data-user-profile-email]");
  if (state.userProfile) {
    if (profileNameEl) profileNameEl.textContent = state.userProfile.name;
    if (profileNameShortEl)
      profileNameShortEl.textContent = state.userProfile.name;
    if (profileEmailEl) profileEmailEl.textContent = state.userProfile.email;
  }
};

export const initDashboard = () => {
  renderDashboard();
  window.addEventListener("note:statechange", renderDashboard);
  window.addEventListener("note:viewchange", (event) => {
    if (event.detail.view === "dashboard") renderDashboard();
  });
  document.addEventListener("change", (event) => {
    const checkbox = event.target.closest("[data-toggle-task]");
    if (checkbox) {
      toggleTask(checkbox.dataset.toggleTask);
    }
  });
};
