import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import { sanitizeHtml } from "../sanitize-html";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseTagValue: false,
  processEntities: false,
});

const asArray = (value) =>
  Array.isArray(value) ? value : value ? [value] : [];

const findNode = (node, name) => {
  if (!node || typeof node !== "object") return null;
  for (const [key, value] of Object.entries(node)) {
    if (key.split(":").pop() === name) return value;
    const match = findNode(value, name);
    if (match) return match;
  }
  return null;
};

const collectText = (node) => {
  if (Array.isArray(node)) return node.map(collectText).join(" ");
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!node || typeof node !== "object") return "";
  return Object.entries(node)
    .map(([key, value]) =>
      key === "#text" ? String(value) : collectText(value)
    )
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/gu, " ")
    .trim();
};

const resolvePath = (basePath, href) => {
  const path = new URL(href, `https://note.local/${basePath}`).pathname;
  return decodeURIComponent(path.replace(/^\/+/u, ""));
};

const flattenToc = (items) =>
  asArray(items).flatMap((item) => [
    { href: item.href?.split("#")[0], label: item.label },
    ...flattenToc(item.subitems),
  ]);

export const readEpub = async (file, metadata) => {
  const [epubModule, arrayBuffer] = await Promise.all([
    import("epubjs"),
    file.arrayBuffer(),
  ]);
  const createBook = [
    epubModule.default?.default,
    epubModule.default,
    epubModule.ePub,
    epubModule,
  ].find((candidate) => typeof candidate === "function");
  if (!createBook) throw new Error("Không thể khởi tạo bộ đọc EPUB.");
  const book = createBook(arrayBuffer);
  try {
    await book.ready;
    const [navigation, zip] = await Promise.all([
      book.loaded.navigation,
      JSZip.loadAsync(arrayBuffer),
    ]);
    const containerFile = zip.file("META-INF/container.xml");
    if (!containerFile)
      throw new Error("EPUB thiếu tệp META-INF/container.xml.");
    const container = parser.parse(await containerFile.async("string"));
    const packagePath = findNode(container, "rootfile")?.["@_full-path"];
    if (!packagePath) throw new Error("EPUB không khai báo gói nội dung.");
    const packageFile = zip.file(packagePath);
    if (!packageFile) throw new Error("Không tìm thấy gói nội dung của EPUB.");
    const packageData = parser.parse(await packageFile.async("string"));
    const packageRoot = findNode(packageData, "package");
    const manifestItems = asArray(findNode(packageRoot, "item"));
    const spineItems = asArray(findNode(packageRoot, "itemref"));
    const manifest = new Map(manifestItems.map((item) => [item["@_id"], item]));
    const packageDirectory = packagePath.slice(
      0,
      packagePath.lastIndexOf("/") + 1
    );
    const toc = flattenToc(navigation.toc);
    const chapters = [];
    for (const spineItem of spineItems) {
      const item = manifest.get(spineItem["@_idref"]);
      if (!item?.["@_href"]) continue;
      const path = resolvePath(packageDirectory, item["@_href"]);
      const chapterFile = zip.file(path);
      if (!chapterFile) continue;
      const source = await chapterFile.async("string");
      const parsed = parser.parse(source);
      const body = findNode(parsed, "body") ?? parsed;
      const text = collectText(body);
      const chapterToc = toc.find(
        (entry) =>
          entry.href && resolvePath(packageDirectory, entry.href) === path
      );
      chapters.push({
        index: chapters.length,
        href: item["@_href"],
        label: chapterToc?.label || `Chương ${chapters.length + 1}`,
        text,
        html: await sanitizeHtml(source),
      });
    }
    if (!chapters.length)
      throw new Error("EPUB không có chương văn bản để đọc.");
    const segments = chapters.map((chapter) => ({
      kind: "chapter",
      index: chapter.index,
      label: chapter.label,
      text: chapter.text,
    }));
    return {
      ...metadata,
      text: segments.map((segment) => segment.text).join("\n\n"),
      chapters,
      segments,
      metadata: {
        ...metadata,
        title: collectText(
          findNode(findNode(packageRoot, "metadata"), "title")
        ),
        creator: collectText(
          findNode(findNode(packageRoot, "metadata"), "creator")
        ),
        chapterCount: chapters.length,
      },
      warnings: [],
      error: null,
    };
  } finally {
    await book.destroy();
  }
};
