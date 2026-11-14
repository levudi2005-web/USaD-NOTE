import assert from "node:assert/strict";
import { resolve } from "node:path";
import { after, describe, it } from "node:test";
import { File } from "node:buffer";
import { JSDOM } from "jsdom";
import JSZip from "jszip";
import sharp from "sharp";
import * as XLSX from "xlsx";
import { createServer } from "vite";

const vite = await createServer({
  configFile: resolve("vite.config.js"),
  logLevel: "error",
  server: { middlewareMode: true },
});
const { readDocument, searchInDocument, validateFile } =
  await vite.ssrLoadModule("/js/modules/note/documents/document-engine.js");
const { destroyPdf } = await vite.ssrLoadModule(
  "/js/modules/note/documents/readers/pdf-reader.js"
);
const { createDocxFromPdfSegments } = await vite.ssrLoadModule(
  "/js/modules/note/documents/readers/pdf-to-docx.js"
);
after(() => vite.close());

const makeFile = (name, data, type) => new File([data], name, { type });

const assertReadable = (result, label) => {
  assert.equal(result.error, null, `${label}: ${result.error?.message}`);
  return result;
};

const makePdf = (pageTexts) => {
  const fontId = pageTexts.length * 2 + 3;
  const objects = new Map([
    [1, "<< /Type /Catalog /Pages 2 0 R >>"],
    [
      2,
      `<< /Type /Pages /Kids [${pageTexts.map((_, index) => `${3 + index * 2} 0 R`).join(" ")}] /Count ${pageTexts.length} >>`,
    ],
  ]);
  for (const [index, text] of pageTexts.entries()) {
    const pageId = 3 + index * 2;
    const contentId = pageId + 1;
    const escapedText = text.replace(/[\\()]/g, "\\$&");
    const stream = `BT /F1 22 Tf 72 720 Td (${escapedText}) Tj ET`;
    objects.set(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
    objects.set(
      contentId,
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
    );
  }
  objects.set(fontId, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  let source = "%PDF-1.4\n";
  const offsets = [0];
  for (let id = 1; id <= fontId; id += 1) {
    offsets[id] = source.length;
    source += `${id} 0 obj\n${objects.get(id)}\nendobj\n`;
  }
  const xrefOffset = source.length;
  source += `xref\n0 ${fontId + 1}\n0000000000 65535 f \n`;
  source += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  source += `trailer\n<< /Size ${fontId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return makeFile("multi-page.pdf", source, "application/pdf");
};

const makeDocx = async () => {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`
  );
  zip.file(
    "_rels/.rels",
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Document heading</w:t></w:r></w:p><w:p><w:r><w:t>A paragraph with readable text.</w:t></w:r></w:p></w:body></w:document>`
  );
  return makeFile(
    "lesson.docx",
    await zip.generateAsync({ type: "uint8array" }),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
};

const makeWorkbook = (bookType, name, mimeType) => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["Topic", "Value"],
      ["Notes", "12"],
    ]),
    "Summary"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([["Term"], ["Recall"]]),
    "Glossary"
  );
  return makeFile(
    name,
    XLSX.write(workbook, { type: "array", bookType }),
    mimeType
  );
};

const makeCsv = () =>
  makeFile("notes.csv", "Topic,Value\nNotes,12\n", "text/csv");

const makePptx = async () => {
  const zip = new JSZip();
  zip.file(
    "ppt/presentation.xml",
    `<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="256" r:id="rId1"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst></p:presentation>`
  );
  zip.file(
    "ppt/_rels/presentation.xml.rels",
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="slides/slide1.xml"/><Relationship Id="rId2" Target="slides/slide2.xml"/></Relationships>`
  );
  for (let index = 1; index <= 2; index += 1) {
    zip.file(
      `ppt/slides/slide${index}.xml`,
      `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Slide ${index} content</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`
    );
  }
  return makeFile(
    "presentation.pptx",
    await zip.generateAsync({ type: "uint8array" }),
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  );
};

const makeEpub = async () => {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file(
    "META-INF/container.xml",
    `<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`
  );
  zip.file(
    "OEBPS/content.opf",
    `<package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" version="3.0" unique-identifier="book-id"><metadata><dc:identifier id="book-id">test-book</dc:identifier><dc:title>Reader test book</dc:title><dc:language>en</dc:language></metadata><manifest><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/><item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/><item id="chapter2" href="chapter2.xhtml" media-type="application/xhtml+xml"/></manifest><spine toc="ncx"><itemref idref="chapter1"/><itemref idref="chapter2"/></spine></package>`
  );
  zip.file(
    "OEBPS/toc.ncx",
    `<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/"><navMap><navPoint id="chapter1" playOrder="1"><navLabel><text>Chapter One</text></navLabel><content src="chapter1.xhtml"/></navPoint><navPoint id="chapter2" playOrder="2"><navLabel><text>Chapter Two</text></navLabel><content src="chapter2.xhtml"/></navPoint></navMap></ncx>`
  );
  zip.file(
    "OEBPS/chapter1.xhtml",
    `<html xmlns="http://www.w3.org/1999/xhtml"><body><h1>Chapter one</h1><p>First chapter text.</p></body></html>`
  );
  zip.file(
    "OEBPS/chapter2.xhtml",
    `<html xmlns="http://www.w3.org/1999/xhtml"><body><h1>Chapter two</h1><p>Second chapter text.</p></body></html>`
  );
  return makeFile(
    "book.epub",
    await zip.generateAsync({ type: "uint8array" }),
    "application/epub+zip"
  );
};

const withDom = async (run) => {
  const { window } = new JSDOM("", { url: "http://localhost/" });
  const values = {
    window,
    document: window.document,
    DOMParser: window.DOMParser,
    XMLSerializer: window.XMLSerializer,
  };
  const previous = new Map(
    Object.keys(values).map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ])
  );
  for (const [key, value] of Object.entries(values)) {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      value,
      writable: true,
    });
  }
  window.URL.createObjectURL = URL.createObjectURL.bind(URL);
  window.URL.revokeObjectURL = URL.revokeObjectURL.bind(URL);
  try {
    return await run();
  } finally {
    window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
};

describe("document readers", { concurrency: false }, () => {
  it("PDF.js extracts text from every page of a multi-page PDF", async () => {
    const result = assertReadable(
      await readDocument(makePdf(["PDF page one", "PDF page two"])),
      "PDF"
    );
    assert.equal(result.metadata.pageCount, 2);
    assert.equal(result.segments.length, 2);
    assert.match(result.text, /PDF page two/u);
    await destroyPdf(result.reader);
  });

  it("converts extracted PDF text into a readable multi-page DOCX", async () => {
    const blob = await createDocxFromPdfSegments([
      { text: "Tiếng Việt & <ghi chú>\nDòng thứ hai" },
      { text: "Nội dung trang hai" },
    ]);
    assert.equal(
      blob.type,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    await withDom(async () => {
      const result = assertReadable(
        await readDocument(
          makeFile(
            "converted.docx",
            await blob.arrayBuffer(),
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          )
        ),
        "Converted DOCX"
      );
      assert.match(result.text, /Tiếng Việt & <ghi chú>/u);
      assert.match(result.text, /Nội dung trang hai/u);
    });
  });

  it("rejects PDFs without extractable text during Word conversion", async () => {
    await assert.rejects(
      createDocxFromPdfSegments([{ text: "  " }]),
      /scan cần nhận diện chữ \(OCR\)/u
    );
  });

  it("Mammoth extracts DOCX headings and paragraphs", async () => {
    await withDom(async () => {
      const result = assertReadable(
        await readDocument(await makeDocx()),
        "DOCX"
      );
      assert.match(result.text, /Document heading/u);
      assert.match(result.html, /<h1>/u);
      assert.match(result.text, /readable text/u);
    });
  });

  it("spreadsheet reader handles XLSX, XLS and CSV content", async () => {
    const xlsx = assertReadable(
      await readDocument(
        makeWorkbook(
          "xlsx",
          "multi-sheet.xlsx",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
      ),
      "XLSX"
    );
    assert.equal(xlsx.sheets.length, 2);
    assert.equal(xlsx.sheets[1].rows[1][0], "Recall");

    const xls = assertReadable(
      await readDocument(
        makeWorkbook("xls", "legacy.xls", "application/vnd.ms-excel")
      ),
      "XLS"
    );
    assert.equal(xls.sheets.length, 2);

    const csv = assertReadable(await readDocument(makeCsv()), "CSV");
    assert.match(csv.text, /Notes/u);
  });

  it("PPTX reader extracts content from multiple slides", async () => {
    const result = assertReadable(await readDocument(await makePptx()), "PPTX");
    assert.equal(result.slides.length, 2);
    assert.match(result.slides[1].text, /Slide 2 content/u);
  });

  it("EPUB reader extracts ordered chapters and sanitized chapter HTML", async () => {
    await withDom(async () => {
      const result = assertReadable(
        await readDocument(await makeEpub()),
        "EPUB"
      );
      assert.equal(result.chapters.length, 2);
      assert.match(result.chapters[1].text, /Second chapter text/u);
      assert.equal(result.chapters[0].index, 0);
      assert.equal(result.chapters[1].index, 1);
    });
  });

  it("text reader preserves Vietnamese characters and Markdown structure safely", async () => {
    const txt = assertReadable(
      await readDocument(
        makeFile(
          "vietnamese.txt",
          "Ghi chú tiếng Việt có dấu: tri thức và học tập.",
          "text/plain"
        )
      ),
      "TXT"
    );
    assert.match(txt.text, /tiếng Việt có dấu/u);

    await withDom(async () => {
      const markdown = assertReadable(
        await readDocument(
          makeFile(
            "notes.md",
            "# Tiêu đề\n\n- Ý đầu\n- Ý sau\n\n| Tên | Giá trị |\n| --- | --- |\n| NOTE | 1 |\n\n<script>alert(1)</script><img src=x onerror=alert(2)>",
            "text/markdown"
          )
        ),
        "Markdown"
      );
      assert.match(markdown.html, /<h1>/u);
      assert.match(markdown.html, /<table>/u);
      assert.doesNotMatch(markdown.html, /<script|onerror=/iu);
      assert.equal(searchInDocument(markdown, "NOTE").total, 1);
    });
  });

  it("local OCR reads English and Vietnamese image text", async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="280"><rect width="100%" height="100%" fill="white"/><text x="35" y="105" font-family="Arial" font-size="58" fill="black">NOTE study guide</text><text x="35" y="205" font-family="Arial" font-size="54" fill="black">Xin chao Viet Nam</text></svg>`;
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    const result = assertReadable(
      await readDocument(makeFile("ocr-test.png", png, "image/png"), {
        tesseractOptions: {
          workerPath: resolve(
            "node_modules/tesseract.js/src/worker-script/node/index.js"
          ),
          langPath: resolve("public/tessdata"),
          cacheMethod: "none",
        },
      }),
      "Image OCR"
    );
    assert.match(result.text, /NOTE/iu);
    assert.match(result.text, /Xin|Viet/iu);
  });

  it("validation rejects corrupt signatures and legacy DOC files", async () => {
    const brokenPdf = await readDocument(
      makeFile("broken.pdf", "not a PDF", "application/pdf")
    );
    assert.equal(brokenPdf.error?.code, "invalid-signature");

    const legacyDoc = await validateFile(
      makeFile("legacy.doc", "legacy", "application/msword")
    );
    assert.equal(legacyDoc.valid, false);
    assert.equal(legacyDoc.errors[0].code, "legacy-doc");
  });
  after(() => vite.close());
});
