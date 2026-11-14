import { parseExcelBuffer } from "./excel-parser";

self.addEventListener("message", ({ data }) => {
  try {
    const sheets = parseExcelBuffer(data.buffer);
    self.postMessage({ sheets });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error ? error.message : "Không đọc được bảng tính.",
    });
  }
});
