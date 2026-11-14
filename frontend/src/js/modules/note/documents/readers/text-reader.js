import { escapeHTML } from "../../html-escape";

export const readText = async (file, metadata) => {
  const source = await file.text();
  const segments = [
    { kind: "text", index: 0, label: "Nội dung", text: source },
  ];
  const warnings = [];
  let html;
  if (metadata.format === "md") {
    const [{ marked }, { sanitizeHtml }] = await Promise.all([
      import("marked"),
      import("../sanitize-html"),
    ]);
    html = await sanitizeHtml(marked.parse(source));
  } else {
    html = `<pre>${escapeHTML(source)}</pre>`;
  }
  return {
    ...metadata,
    text: source,
    html,
    segments,
    metadata: {
      ...metadata,
      wordCount: source.trim() ? source.trim().split(/\s+/u).length : 0,
    },
    warnings,
    error: null,
  };
};
