import { columnLimit, rowLimit } from "./excel-limits";

export const readExcel = async (file, metadata) => {
  const buffer = await file.arrayBuffer();
  let sheets;
  if (typeof Worker === "undefined") {
    const { parseExcelBuffer } = await import("./excel-parser");
    sheets = parseExcelBuffer(buffer);
  } else {
    const worker = new Worker(new URL("./excel-worker.js", import.meta.url), {
      type: "module",
    });
    sheets = await new Promise((resolve, reject) => {
      worker.addEventListener(
        "message",
        ({ data }) => {
          if (data.error) reject(new Error(data.error));
          else resolve(data.sheets);
        },
        { once: true }
      );
      worker.addEventListener(
        "error",
        (event) =>
          reject(new Error(event.message || "Lỗi khi xử lý bảng tính.")),
        { once: true }
      );
      worker.postMessage({ buffer }, [buffer]);
    }).finally(() => worker.terminate());
  }
  const segments = sheets.map((sheet) => ({
    kind: "sheet",
    index: sheet.index,
    label: sheet.name,
    text: sheet.rows.flat().join(" "),
  }));
  return {
    ...metadata,
    text: segments.map((segment) => segment.text).join("\n"),
    sheets,
    segments,
    metadata: {
      ...metadata,
      sheetCount: sheets.length,
      rowCount: sheets.reduce((sum, sheet) => sum + sheet.totalRows, 0),
    },
    warnings: sheets.some((sheet) => sheet.truncated)
      ? [`Mỗi sheet hiển thị tối đa ${rowLimit} dòng và ${columnLimit} cột.`]
      : [],
    error: null,
  };
};
