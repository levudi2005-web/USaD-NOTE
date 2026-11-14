import { getStorageWarning, syncFromBackend } from "./store";
import { activateSearch, initNavigation, renderSearch } from "./navigation";
import { initNotes } from "./notes";
import { initDocuments } from "./documents";
import { initSharing } from "./sharing/manage";
import { initLearning } from "./learning";
import { initDashboard } from "./dashboard";
import { initGraph } from "./graph";
import { initFolders } from "./folders";
import { initCollections } from "./collections";
import { initArchives } from "./archives";
import { initAiAssistant } from "./ai-assistant";
import { initAiContext } from "./ai-context";
import { initAiWorkflows } from "./ai-workflows";
import { initSettings } from "./settings";
import { initReader } from "./reader";
import { showToast } from "./utils";

const start = () => {
  syncFromBackend();
  initNavigation();
  activateSearch();
  initNotes();
  initDocuments();
  initSharing();
  initFolders();
  initCollections();
  initArchives();
  initAiAssistant();
  initAiContext();
  initAiWorkflows();
  initSettings();
  initReader();
  initLearning();
  initDashboard();
  initGraph();
  renderSearch();

  if (getStorageWarning()) showToast(getStorageWarning(), "warning");
  window.addEventListener("note:storageerror", () => {
    showToast(
      "Trình duyệt không thể lưu thay đổi. Dữ liệu hiện tại chỉ còn trong phiên này.",
      "danger"
    );
  });
  window.addEventListener("note:backenderror", (event) => {
    const operation = event.detail?.operation || "Đồng bộ";
    const message =
      event.detail?.message || "Không thể đồng bộ dữ liệu với máy chủ.";
    showToast(
      `${operation} thất bại: ${message} Dữ liệu cục bộ có thể chưa đồng bộ.`,
      "danger"
    );
  });
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
