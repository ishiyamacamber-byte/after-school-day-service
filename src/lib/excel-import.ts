import * as XLSX from "xlsx";

/** 取込テンプレの列幅（A〜M）。N列以降のメモ・数式列は無視する。 */
export const EXCEL_IMPORT_MAX_COLS = 13;

function cellToString(v: unknown): string {
  if (v == null || v === "") return "";
  if (typeof v === "object" && v !== null && !(v instanceof Date)) {
    return "";
  }
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(v).trim();
  if (s.startsWith("=")) return "";
  return s;
}

/** 先頭シートを CSV 取込と同じ string[][] にする（1行目＝ヘッダ） */
export function parseExcelFirstSheetToRows(buffer: ArrayBuffer): string[][] {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];

  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });

  const rows: string[][] = [];
  for (const row of raw) {
    if (!Array.isArray(row)) continue;
    const trimmed = row.slice(0, EXCEL_IMPORT_MAX_COLS);
    const cells = trimmed.map((c) => cellToString(c));
    if (cells.some((c) => c.length > 0)) rows.push(cells);
  }
  return rows;
}

export function isExcelUpload(file: File): boolean {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) return true;
  const t = file.type;
  return (
    t === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    t === "application/vnd.ms-excel"
  );
}
