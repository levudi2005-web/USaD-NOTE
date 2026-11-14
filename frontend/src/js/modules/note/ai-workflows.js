import { addAiWorkflow, getState } from "./store";
import { escapeHTML, formatDateTime, refreshIcons, showToast } from "./utils";

export const renderWorkflows = () => {
  const state = getState();
  const workflows = state.aiWorkflows || [];
  const listEl = document.querySelector("[data-workflows-list]");
  const historyListEl = document.querySelector("[data-workflows-history-list]");

  if (listEl) {
    if (!workflows.length) {
      listEl.innerHTML = `<div class="p-4 text-center text-body-secondary small">Chưa có quy trình tự động nào.</div>`;
    } else {
      listEl.innerHTML = workflows
        .map((wf) => {
          let badgeClass = "bg-secondary-subtle text-secondary";
          let statusText = "Chờ chạy";
          if (wf.status === "completed") {
            badgeClass = "bg-success-subtle text-success";
            statusText = "Hoàn thành";
          } else if (wf.status === "running") {
            badgeClass = "bg-primary-subtle text-primary";
            statusText = "Đang chạy";
          } else if (wf.status === "failed") {
            badgeClass = "bg-danger-subtle text-danger";
            statusText = "Thất bại";
          }

          const stepsHtml = (wf.steps || [])
            .map((step, idx) => {
              const isStepDone = step.status === "completed";
              const isStepRunning = step.status === "running";
              return `
                <div class="note-pipeline-step ${isStepDone ? "completed" : ""} ${isStepRunning ? "running" : ""}">
                  <span class="step-icon">${idx + 1}</span>
                  <div>
                    <strong class="d-block small">${escapeHTML(step.name)}</strong>
                    <small class="text-body-secondary" style="font-size:11px">${step.duration ? `Thời gian: ${step.duration}` : "Chờ xử lý"}</small>
                  </div>
                </div>`;
            })
            .join("");

          return `
            <div class="card border p-4 shadow-none note-interactive-card">
              <div class="d-flex align-items-start justify-content-between mb-2">
                <div>
                  <div class="d-flex align-items-center gap-2">
                    <h5 class="fw-bold mb-0">${escapeHTML(wf.name)}</h5>
                    <span class="badge ${badgeClass} small">${statusText}</span>
                  </div>
                  <p class="text-body-secondary small mb-0 mt-1">${escapeHTML(wf.description || "")}</p>
                </div>
                <div class="d-flex gap-2">
                  <button class="btn btn-sm btn-outline-primary" type="button" data-workflow-run="${escapeHTML(wf.id)}" ${wf.status === "running" ? "disabled" : ""}>
                    <i data-lucide="play"></i> Chạy quy trình
                  </button>
                  <button class="btn btn-sm btn-outline-secondary" type="button" data-workflow-retry="${escapeHTML(wf.id)}" title="Thử lại">
                    <i data-lucide="rotate-ccw"></i>
                  </button>
                </div>
              </div>

              <!-- Progress Bar -->
              <div class="my-3">
                <div class="d-flex justify-content-between small fw-medium mb-1">
                  <span>Tiến trình hoàn thành:</span>
                  <span>${wf.progress || 0}%</span>
                </div>
                <div class="progress" style="height: 6px;">
                  <div class="progress-bar ${wf.status === "completed" ? "bg-success" : "bg-primary"}" role="progressbar" style="width: ${wf.progress || 0}%"></div>
                </div>
              </div>

              <!-- Steps Container -->
              <div class="mt-3 pt-3 border-top">
                <h6 class="small fw-bold text-uppercase text-body-secondary mb-3">Các giai đoạn xử lý:</h6>
                <div class="d-flex flex-column">
                  ${stepsHtml}
                </div>
              </div>
            </div>`;
        })
        .join("");

      refreshIcons(listEl);
    }
  }

  // Render Combined History
  if (historyListEl) {
    const allHistory = [];
    workflows.forEach((w) => {
      (w.history || []).forEach((h) => {
        allHistory.push({ ...h, workflowName: w.name });
      });
    });

    allHistory.sort((a, b) => new Date(b.at) - new Date(a.at));

    if (!allHistory.length) {
      historyListEl.innerHTML = `<p class="text-body-secondary small py-3 text-center">Chưa có lịch sử chạy.</p>`;
    } else {
      historyListEl.innerHTML = allHistory
        .map(
          (h) => `
          <div class="list-group-item d-flex flex-column py-2 px-0 border-0 border-bottom">
            <div class="d-flex align-items-center justify-content-between">
              <strong class="small text-truncate">${escapeHTML(h.workflowName)}</strong>
              <span class="badge ${h.status === "success" ? "bg-success-subtle text-success" : "bg-danger-subtle text-danger"} small" style="font-size:10px">${h.status}</span>
            </div>
            <span class="text-body-secondary" style="font-size:11px">${escapeHTML(h.output || h.input)}</span>
            <small class="text-body-tertiary" style="font-size:10px">${formatDateTime(h.at)}</small>
          </div>`
        )
        .join("");
      refreshIcons(historyListEl);
    }
  }
};

export const runWorkflowSimulation = (wfId) => {
  const state = getState();
  const wf = state.aiWorkflows?.find((w) => w.id === wfId);
  if (!wf) return;

  showToast(
    `Quy trình "${wf.name}" chưa được kết nối với dịch vụ thực thi AI.`,
    "warning"
  );
};

export const initAiWorkflows = () => {
  renderWorkflows();
  window.addEventListener("note:statechange", renderWorkflows);
  window.addEventListener("note:viewchange", (e) => {
    if (e.detail.view === "ai-workflows") renderWorkflows();
  });

  document.addEventListener("click", (event) => {
    const runBtn = event.target.closest("[data-workflow-run]");
    if (runBtn) {
      runWorkflowSimulation(runBtn.dataset.workflowRun);
      return;
    }

    const retryBtn = event.target.closest("[data-workflow-retry]");
    if (retryBtn) {
      runWorkflowSimulation(retryBtn.dataset.workflowRetry);
      return;
    }

    if (event.target.closest("[data-workflow-create-btn]")) {
      const name = prompt("Nhập tên quy trình AI mới:");
      if (name && name.trim()) {
        addAiWorkflow({
          name: name.trim(),
          description: "Quy trình xử lý dữ liệu và tạo tri thức tùy chỉnh.",
          trigger: "Thủ công",
          status: "queued",
          progress: 0,
          steps: [
            { name: "Thu thập & Chuẩn hóa đầu vào", status: "pending" },
            { name: "Xử lý thông qua AI BYOK", status: "pending" },
            { name: "Cập nhật Kho lưu trữ NOTE", status: "pending" },
          ],
        });
        renderWorkflows();
        showToast(`Đã tạo quy trình "${name.trim()}"`, "success");
      }
    }
  });
};
