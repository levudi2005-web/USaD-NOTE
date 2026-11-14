const asSegments = (content) =>
  content?.segments?.length
    ? content.segments
    : [
        {
          kind: "text",
          index: 0,
          label: "Nội dung",
          text: content?.text ?? "",
        },
      ];

export const searchInDocument = (content, keyword, limit = 100) => {
  const query = String(keyword ?? "")
    .trim()
    .toLocaleLowerCase();
  if (!query) return { total: 0, matches: [] };
  const matches = [];
  let total = 0;
  for (const [segmentIndex, segment] of asSegments(content).entries()) {
    const text = String(segment.text ?? "");
    const normalized = text.toLocaleLowerCase();
    let offset = 0;
    while ((offset = normalized.indexOf(query, offset)) !== -1) {
      total += 1;
      if (matches.length < limit) {
        const start = Math.max(0, offset - 55);
        const end = Math.min(text.length, offset + query.length + 75);
        matches.push({
          segmentIndex,
          kind: segment.kind,
          label: segment.label,
          offset,
          excerpt: `${start ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`,
        });
      }
      offset += query.length;
    }
  }
  return { total, matches };
};
