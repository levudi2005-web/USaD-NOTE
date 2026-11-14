import * as XLSX from "xlsx";
import { columnLimit, rowLimit } from "./excel-limits";

export const parseExcelBuffer = (buffer) => {
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: true,
    dense: true,
    raw: false,
  });
  const sheets = workbook.SheetNames.map((name, index) => {
    const source = workbook.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(source, {
      header: 1,
      defval: "",
      raw: false,
      blankrows: false,
      range: 0,
    });
    const truncated =
      rows.length > rowLimit || rows.some((row) => row.length > columnLimit);
    return {
      index,
      name,
      rows: rows
        .slice(0, rowLimit)
        .map((row) => row.slice(0, columnLimit).map(String)),
      totalRows: rows.length,
      truncated,
    };
  });
  return sheets;
};
