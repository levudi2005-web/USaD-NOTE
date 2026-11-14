import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseTagValue: false,
  processEntities: false,
});

const asArray = (value) =>
  Array.isArray(value) ? value : value ? [value] : [];

const collectSlideText = (node, key = "") => {
  if (Array.isArray(node)) {
    return node.flatMap((item) => collectSlideText(item, key));
  }
  if (node && typeof node === "object") {
    return Object.entries(node).flatMap(([childKey, value]) =>
      collectSlideText(value, childKey)
    );
  }
  return typeof node === "string" && /(?:^|:)t$/u.test(key) ? [node] : [];
};

const resolvePackagePath = (basePath, target) => {
  const path = new URL(target, `https://note.local/${basePath}`).pathname;
  return decodeURIComponent(path.replace(/^\/+/u, ""));
};

const slideEntries = (zip) =>
  Object.keys(zip.files)
    .map((path) => {
      const match = path.match(/^ppt\/slides\/slide(\d+)\.xml$/u);
      return match ? { path, number: Number(match[1]) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.number - b.number);

const getOrderedSlides = async (zip) => {
  const entries = slideEntries(zip);
  const presentationFile = zip.file("ppt/presentation.xml");
  const relationshipsFile = zip.file("ppt/_rels/presentation.xml.rels");
  if (!presentationFile || !relationshipsFile) return entries;
  const [presentationText, relationshipsText] = await Promise.all([
    presentationFile.async("string"),
    relationshipsFile.async("string"),
  ]);
  const presentation = parser.parse(presentationText);
  const relationships = parser.parse(relationshipsText);
  const ids = asArray(
    presentation?.["p:presentation"]?.["p:sldIdLst"]?.["p:sldId"]
  )
    .map((slide) => slide["@_r:id"])
    .filter(Boolean);
  const targets = new Map(
    asArray(relationships?.Relationships?.Relationship).map((relationship) => [
      relationship["@_Id"],
      resolvePackagePath("ppt/", relationship["@_Target"] ?? ""),
    ])
  );
  const ordered = ids
    .map((id) => targets.get(id))
    .filter((path) => path && zip.file(path))
    .map((path) => ({ path }));
  return ordered.length ? ordered : entries;
};

export const readPptx = async (file, metadata) => {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const entries = await getOrderedSlides(zip);
  if (!entries.length) throw new Error("PPTX không chứa slide có thể đọc.");
  const slides = await Promise.all(
    entries.map(async ({ path }, index) => {
      const source = await zip.file(path).async("string");
      const parsed = parser.parse(source);
      const text = collectSlideText(parsed)
        .join(" ")
        .replace(/\s+/gu, " ")
        .trim();
      return { index, label: `Slide ${index + 1}`, text };
    })
  );
  const segments = slides.map((slide) => ({
    kind: "slide",
    index: slide.index,
    label: slide.label,
    text: slide.text,
  }));
  return {
    ...metadata,
    text: segments.map((segment) => segment.text).join("\n"),
    slides,
    segments,
    metadata: { ...metadata, slideCount: slides.length },
    warnings: [
      "Chỉ trích xuất văn bản; hình ảnh, biểu đồ, bố cục và hiệu ứng chưa được hiển thị.",
    ],
    error: null,
  };
};
