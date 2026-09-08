import * as XLSX from "xlsx";
import type { CompanyProfile } from "./companyProfiles";

export interface WorkbookData {
  sheetNames: string[];
  /** Griglia di celle grezze per foglio */
  sheets: Record<string, unknown[][]>;
}

export interface DayColumn {
  columnIndex: number;
  date: Date;
}

export interface PersonRow {
  rowIndex: number; // 0-based nella griglia
  /** Numero riga come mostrato in Excel */
  excelRow: number;
  name: string;
}

export interface SheetLayout {
  dateRowIndex: number;
  days: DayColumn[];
  people: PersonRow[];
}

export async function readWorkbook(file: File): Promise<WorkbookData> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheets: Record<string, unknown[][]> = {};
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    sheets[name] = ws
      ? (XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true }) as unknown[][])
      : [];
  }
  return { sheetNames: wb.SheetNames, sheets };
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  if (typeof value === "number" && value > 20000 && value < 80000) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      return new Date(parsed.y, parsed.m - 1, parsed.d);
    }
  }
  if (typeof value === "string") {
    const m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(value.trim());
    if (m) {
      const year = Number(m[3]!.length === 2 ? `20${m[3]}` : m[3]);
      const d = new Date(year, Number(m[2]) - 1, Number(m[1]));
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return null;
}

export function cellToText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

/**
 * Individua dinamicamente la riga delle date, le colonne-giorno e le persone.
 */
export function analyseSheet(grid: unknown[][], profile: CompanyProfile): SheetLayout | null {
  let bestRow = -1;
  let bestDays: DayColumn[] = [];

  const limit = Math.min(grid.length, profile.dateRowSearchLimit);
  for (let r = 0; r < limit; r++) {
    const row = grid[r] ?? [];
    const days: DayColumn[] = [];
    for (let c = 0; c < row.length; c++) {
      if (c === profile.nameColumnIndex) continue;
      const date = toDate(row[c]);
      if (date) days.push({ columnIndex: c, date });
    }
    if (days.length > bestDays.length) {
      bestDays = days;
      bestRow = r;
    }
  }

  if (bestRow < 0 || bestDays.length < profile.minDateCells) return null;

  const people: PersonRow[] = [];
  for (let r = bestRow + 1; r < grid.length; r++) {
    const row = grid[r] ?? [];
    const name = cellToText(row[profile.nameColumnIndex]);
    if (!name) continue;
    people.push({ rowIndex: r, excelRow: r + 1, name });
  }

  if (people.length === 0) return null;

  // Ordine alfabetico (italiano, case/accent-insensitive), a parità di nome per riga
  people.sort(
    (a, b) =>
      a.name.localeCompare(b.name, "it", { sensitivity: "base", numeric: true }) || a.excelRow - b.excelRow,
  );

  bestDays.sort((a, b) => a.date.getTime() - b.date.getTime());
  return { dateRowIndex: bestRow, days: bestDays, people };
}
