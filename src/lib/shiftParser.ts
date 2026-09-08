export type ShiftStatus = "ok" | "unrecognized";

export interface ParsedShift {
  /** Valore originale della cella */
  raw: string;
  status: ShiftStatus;
  title?: string;
  allDay?: boolean;
  /** Minuti dall'inizio del giorno */
  startMinutes?: number;
  /** Durata in minuti */
  durationMinutes?: number;
}

const ALL_DAY_CODES = ["R", "R1", "R2", "RC"];

const TENS_TO_MINUTES: Record<string, number> = {
  "0": 0,
  "1": 10,
  "2": 20,
  "3": 30,
  "4": 40,
  "5": 50,
};

/**
 * Interpreta il codice turno di una singola cella.
 * Ritorna sempre un risultato: i codici non riconosciuti restano visibili.
 */
export function parseShiftCode(rawValue: string): ParsedShift | null {
  const raw = rawValue.trim();
  if (!raw) return null;

  // Codice completo: lettera + 3 cifre orario + 1 cifra durata (es. B1445)
  const full = /^([A-Za-z])(\d{2})(\d)(\d)$/.exec(raw);
  if (full) {
    const [, letter, hoursStr, tens, durationStr] = full;
    const hours = Number(hoursStr);
    const minutes = TENS_TO_MINUTES[tens!];
    const duration = Number(durationStr);
    if (hours <= 23 && minutes !== undefined && duration > 0) {
      return {
        raw,
        status: "ok",
        title: `${letter}${hoursStr}${tens}`,
        allDay: false,
        startMinutes: hours * 60 + minutes,
        durationMinutes: duration * 60,
      };
    }
  }

  if (ALL_DAY_CODES.includes(raw.toUpperCase()) && raw.length <= 2) {
    return { raw, status: "ok", title: raw, allDay: true };
  }

  if (/^[A-Za-z]$/.test(raw)) {
    if (raw.toUpperCase() === "C") {
      return {
        raw,
        status: "ok",
        title: raw,
        allDay: false,
        startMinutes: 8 * 60,
        durationMinutes: 14 * 60,
      };
    }
    return { raw, status: "ok", title: raw, allDay: true };
  }

  return { raw, status: "unrecognized" };
}
