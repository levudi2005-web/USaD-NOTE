import JSZip from "jszip";

const xmlEscape = (value) =>
  String(value)
    // eslint-disable-next-line no-control-regex -- XML 1.0 forbids these control characters.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/gu, "")
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&apos;");

const paragraph = (text) =>
  `<w:p><w:r><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`;

export const createDocxFromPdfSegments = async (segments) => {
  const pages = (Array.isArray(segments) ? segments : [])
    .map((segment) => String(segment?.text ?? "").trim())
    .filter(Boolean);
  if (!pages.length) {
    throw new Error(
      "PDF không có văn bản để chuyển. Tệp scan cần nhận diện chữ (OCR) trước."
    );
  }

  const pageContent = pages
    .map((text, index) => {
      const paragraphs = text
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter(Boolean)
        .map(paragraph)
        .join("");
      return index === 0
        ? paragraphs
        : `<w:p><w:r><w:br w:type="page"/></w:r></w:p>${paragraphs}`;
    })
    .join("");
  const zip = new JSZip();

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${pageContent}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body>
</w:document>`
  );
  return zip.generateAsync({
    type: "blob",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
};
