import { getState } from "./store";
import { escapeHTML, refreshIcons } from "./utils";

let scale = 1;
let offsetX = 0;
let offsetY = 0;
let pointerStart = null;
let didMove = false;

const renderGraph = () => {
  const group = document.querySelector("[data-graph-world]");
  if (!group) return;
  const notes = getState().notes || [];
  if (notes.length === 0) {
    group.innerHTML =
      '<text class="note-graph-empty" x="450" y="260">Chưa có ghi chú để hiển thị sơ đồ.</text>';
    group.setAttribute(
      "transform",
      `translate(${offsetX} ${offsetY}) scale(${scale})`
    );
    return;
  }
  const centerX = 450;
  const centerY = 260;
  const radiusX = notes.length > 1 ? 285 : 0;
  const radiusY = notes.length > 1 ? 155 : 0;
  const nodes = notes.map((note, index) => {
    const angle =
      (Math.PI * 2 * index) / Math.max(notes.length, 1) - Math.PI / 2;
    return {
      note,
      x: centerX + Math.cos(angle) * radiusX,
      y: centerY + Math.sin(angle) * radiusY,
    };
  });
  const positions = new Map(nodes.map((node) => [node.note.id, node]));
  const edges = [];
  nodes.forEach(({ note, x, y }) => {
    note.related?.forEach((relatedId) => {
      const target = positions.get(relatedId);
      if (target && note.id < relatedId) {
        edges.push(
          `<line class="note-graph-edge" x1="${x}" y1="${y}" x2="${target.x}" y2="${target.y}"></line>`
        );
      }
    });
  });
  group.innerHTML = `
    <g class="note-graph-edges">${edges.join("")}</g>
    <g class="note-graph-nodes">${nodes
      .map(
        ({ note, x, y }, index) => `
          <g class="note-graph-node" role="button" tabindex="0" aria-label="Mở ghi chú ${escapeHTML(note.title)}" data-graph-node="${escapeHTML(note.id)}" transform="translate(${x} ${y})" style="--node-index:${index}">
            <circle r="42"></circle>
            <text y="4">${escapeHTML(note.title.slice(0, 19))}${note.title.length > 19 ? "…" : ""}</text>
            ${note.isDemo ? '<text class="note-graph-demo" y="58">MẪU</text>' : ""}
          </g>`
      )
      .join("")}</g>`;
  group.setAttribute(
    "transform",
    `translate(${offsetX} ${offsetY}) scale(${scale})`
  );
  refreshIcons(group);
};

const setZoom = (value) => {
  scale =
    value === "reset"
      ? 1
      : Math.max(0.55, Math.min(2.2, scale + Number(value) * 0.18));
  renderGraph();
};

export const initGraph = () => {
  document.querySelectorAll("[data-graph-zoom]").forEach((button) => {
    button.addEventListener("click", () => setZoom(button.dataset.graphZoom));
  });
  document
    .querySelector("[data-graph-search]")
    ?.addEventListener("input", (event) => {
      const query = event.target.value.trim().toLocaleLowerCase();
      document.querySelectorAll("[data-graph-node]").forEach((node) => {
        const note = getState().notes.find(
          (item) => item.id === node.dataset.graphNode
        );
        const match = !query || note?.title.toLocaleLowerCase().includes(query);
        node.classList.toggle("is-dimmed", !match);
        node.classList.toggle("is-match", Boolean(query && match));
      });
    });

  const svg = document.querySelector("[data-graph-svg]");
  svg?.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      scale = Math.max(
        0.55,
        Math.min(2.2, scale + (event.deltaY < 0 ? 0.08 : -0.08))
      );
      renderGraph();
    },
    { passive: false }
  );
  svg?.addEventListener("pointerdown", (event) => {
    if (event.target.closest("[data-graph-node]")) return;
    pointerStart = { x: event.clientX, y: event.clientY, offsetX, offsetY };
    didMove = false;
    svg.setPointerCapture(event.pointerId);
  });
  svg?.addEventListener("pointermove", (event) => {
    if (!pointerStart) return;
    const rect = svg.getBoundingClientRect();
    const dx = ((event.clientX - pointerStart.x) / rect.width) * 900;
    const dy = ((event.clientY - pointerStart.y) / rect.height) * 520;
    didMove ||= Math.abs(dx) + Math.abs(dy) > 2;
    offsetX = pointerStart.offsetX + dx;
    offsetY = pointerStart.offsetY + dy;
    const group = document.querySelector("[data-graph-world]");
    group?.setAttribute(
      "transform",
      `translate(${offsetX} ${offsetY}) scale(${scale})`
    );
  });
  svg?.addEventListener("pointerup", () => {
    pointerStart = null;
  });
  svg?.addEventListener("pointercancel", () => {
    pointerStart = null;
  });
  document.addEventListener("click", (event) => {
    const node = event.target.closest("[data-graph-node]");
    if (!node || didMove) {
      didMove = false;
      return;
    }
    window.dispatchEvent(
      new CustomEvent("note:open", {
        detail: { id: node.dataset.graphNode },
      })
    );
    window.location.hash = "notes";
  });
  document.addEventListener("keydown", (event) => {
    if (
      (event.key === "Enter" || event.key === " ") &&
      event.target.matches("[data-graph-node]")
    ) {
      event.preventDefault();
      event.target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
  });
  window.addEventListener("note:statechange", renderGraph);
  renderGraph();
};
