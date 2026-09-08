import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { COMPANY_PROFILES, DEFAULT_PROFILE_ID, getProfile } from "@/lib/companyProfiles";
import { analyseSheet, cellToText, readWorkbook, type SheetLayout, type WorkbookData } from "@/lib/excelParser";
import { parseShiftCode } from "@/lib/shiftParser";
import { downloadIcs, generateIcs, safeFileName, type CalendarEvent } from "@/lib/icsGenerator";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Turni Facili | Dai turni Excel al tuo calendario" },
      {
        name: "description",
        content:
          "Carica il foglio Excel dei turni, scegli il cognome e scarica il calendario .ics per Apple Calendar o Google Calendar. Tutto nel tuo browser.",
      },
      { property: "og:title", content: "Turni Facili" },
      {
        property: "og:description",
        content: "Dai turni Excel al calendario in pochi secondi, senza inviare dati.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

interface PreviewRow {
  date: Date;
  raw: string;
  title: string;
  start: string;
  end: string;
  ok: boolean;
  event?: CalendarEvent;
}

const MONTHS = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];
const WEEK_LABELS = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];

function fmtTime(base: Date, minutes: number): string {
  const d = new Date(base);
  d.setMinutes(d.getMinutes() + minutes);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function Card({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card/90 p-5 shadow-soft backdrop-blur sm:p-7">
      <h2 className="mb-5 flex items-center gap-3 font-display text-lg font-bold tracking-tight text-foreground sm:text-xl">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-sm font-bold text-brand-foreground">
          {step}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Griglia mensile con i turni */
function MonthGrid({ year, month, rows }: { year: number; month: number; rows: PreviewRow[] }) {
  const byDay = new Map<number, PreviewRow>();
  for (const r of rows) byDay.set(r.date.getDate(), r);

  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // lunedì = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="rounded-2xl border border-border bg-background p-3 sm:p-4">
      <h3 className="mb-3 font-display text-base font-bold capitalize text-foreground">
        {MONTHS[month]} {year}
      </h3>
      <div className="grid grid-cols-7 gap-1 text-center text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
        {WEEK_LABELS.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          const shift = day ? byDay.get(day) : undefined;
          return (
            <div
              key={i}
              className={`min-h-16 rounded-lg border p-1 text-left sm:min-h-20 ${
                day === null
                  ? "border-transparent"
                  : shift
                    ? "border-brand/40 bg-brand-soft"
                    : "border-border bg-muted/40"
              }`}
            >
              {day !== null && (
                <>
                  <span className="block text-[0.7rem] font-semibold text-muted-foreground">{day}</span>
                  {shift && (
                    <span className="mt-0.5 block text-[0.7rem] font-bold leading-tight text-accent-foreground">
                      {shift.title}
                      <span className="block font-medium">
                        {shift.start === "Tutto il giorno" ? "tutto il giorno" : `${shift.start}–${shift.end}`}
                      </span>
                    </span>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Index() {
  const [profileId, setProfileId] = useState(DEFAULT_PROFILE_ID);
  const [file, setFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<WorkbookData | null>(null);
  const [personRow, setPersonRow] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const profile = getProfile(profileId);
  const sheetName = workbook?.sheetNames[0] ?? "";

  const layout: SheetLayout | null = useMemo(() => {
    if (!workbook || !sheetName) return null;
    const grid = workbook.sheets[sheetName];
    if (!grid) return null;
    return analyseSheet(grid, profile);
  }, [workbook, sheetName, profile]);

  const rows: PreviewRow[] = useMemo(() => {
    if (!workbook || !layout || personRow === null) return [];
    const grid = workbook.sheets[sheetName] ?? [];
    const row = grid[personRow] ?? [];
    const out: PreviewRow[] = [];
    for (const day of layout.days) {
      const raw = cellToText(row[day.columnIndex]);
      const parsed = parseShiftCode(raw);
      if (!parsed) continue;
      if (parsed.status === "unrecognized") {
        out.push({ date: day.date, raw: parsed.raw, title: "—", start: "—", end: "—", ok: false });
        continue;
      }
      const event: CalendarEvent = {
        title: parsed.title!,
        allDay: !!parsed.allDay,
        date: day.date,
        startMinutes: parsed.startMinutes,
        durationMinutes: parsed.durationMinutes,
      };
      out.push({
        date: day.date,
        raw: parsed.raw,
        title: parsed.title!,
        start: parsed.allDay ? "Tutto il giorno" : fmtTime(day.date, parsed.startMinutes!),
        end: parsed.allDay ? "Tutto il giorno" : fmtTime(day.date, parsed.startMinutes! + parsed.durationMinutes!),
        ok: true,
        event,
      });
    }
    return out;
  }, [workbook, layout, personRow, sheetName]);

  const validRows = rows.filter((r) => r.ok);
  const invalidRows = rows.filter((r) => !r.ok);
  const selectedPerson = layout?.people.find((p) => p.rowIndex === personRow) ?? null;

  const months = useMemo(() => {
    const keys = new Map<string, { year: number; month: number; rows: PreviewRow[] }>();
    for (const r of validRows) {
      const k = `${r.date.getFullYear()}-${r.date.getMonth()}`;
      if (!keys.has(k)) keys.set(k, { year: r.date.getFullYear(), month: r.date.getMonth(), rows: [] });
      keys.get(k)!.rows.push(r);
    }
    return [...keys.values()].sort((a, b) => a.year - b.year || a.month - b.month);
  }, [validRows]);

  function pickFile(f: File) {
    setFile(f);
    setWorkbook(null);
    setPersonRow(null);
    setError(null);
    setNote(null);
  }

  async function process() {
    if (!file) return;
    setError(null);
    setNote(null);
    setLoading(true);
    setWorkbook(null);
    setPersonRow(null);
    try {
      const name = file.name.toLowerCase();
      if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
        throw new Error("Formato non supportato. Carica un file .xlsx o .xls.");
      }
      const data = await readWorkbook(file);
      if (data.sheetNames.length === 0) throw new Error("Il file non contiene fogli leggibili.");
      setWorkbook(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossibile leggere il file.");
    } finally {
      setLoading(false);
    }
  }

  function download(kind: "apple" | "google") {
    if (!selectedPerson || validRows.length === 0) return;
    const events = validRows.map((r) => r.event!);
    const firstDate = validRows[0]!.date;
    const ics = generateIcs(events, profile.timeZone);
    downloadIcs(ics, safeFileName(selectedPerson.name, firstDate.getMonth() + 1, firstDate.getFullYear()));
    setNote(
      kind === "apple"
        ? "Apri il file scaricato con Calendario e scegli il calendario di destinazione."
        : "Importa il file scaricato in Google Calendar da computer, scegliendo il calendario di destinazione.",
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-brand">
        <div className="mx-auto flex w-full max-w-4xl justify-end px-4 pt-4">
          <ThemeToggle />
        </div>
        <header className="mx-auto w-full max-w-4xl px-4 pb-12 pt-6 text-center sm:pb-16">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.25em] text-brand-foreground">
            Dai turni al calendario
          </p>
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-brand-foreground sm:text-5xl">
            Turni Facili
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm text-brand-foreground sm:text-base">
            Carica il file Excel dei turni: viene letto il primo foglio del file. Scegli il tuo cognome e scarica il
            calendario. Tutto avviene nel tuo browser, nessun dato viene inviato.
          </p>
        </header>
      </div>

      <main className="mx-auto -mt-8 w-full max-w-4xl space-y-5 px-4 pb-16">
        <Card step={1} title="Carica il file e scegli l'azienda">
          <label htmlFor="azienda" className="mb-2 block text-sm font-medium text-foreground">
            Azienda / formato
          </label>
          <select
            id="azienda"
            value={profileId}
            onChange={(e) => {
              setProfileId(e.target.value);
              setPersonRow(null);
              setNote(null);
            }}
            className="w-full rounded-xl border border-input bg-background px-3 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {COMPANY_PROFILES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) pickFile(f);
            }}
            className={`mt-4 rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
              dragging ? "border-brand bg-brand-soft" : "border-border bg-muted/40"
            }`}
          >
            <p className="text-sm text-muted-foreground">Trascina qui il file Excel oppure</p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-3 inline-flex items-center justify-center rounded-xl border border-brand bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
            >
              Scegli file
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              aria-label="Carica il file Excel dei turni"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pickFile(f);
                e.target.value = "";
              }}
            />
            {file && (
              <p className="mt-3 text-sm text-foreground">
                File scelto: <span className="font-semibold">{file.name}</span>
              </p>
            )}
          </div>

          <button
            type="button"
            disabled={!file || loading}
            onClick={() => void process()}
            className="mt-4 w-full rounded-xl bg-gradient-brand px-4 py-4 font-display text-base font-bold text-brand-foreground shadow-soft transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Lettura in corso…" : "Ottieni calendario"}
          </button>

          {error && (
            <p role="alert" className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          {workbook && !layout && (
            <p role="alert" className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              Nel primo foglio non sono state trovate date o persone valide. Verifica il file.
            </p>
          )}
        </Card>

        {layout && (
          <Card step={2} title="Scegli il cognome">
            <label htmlFor="cognome" className="mb-2 block text-sm font-medium text-foreground">
              Cognome ({layout.people.length} trovati nel file)
            </label>
            <select
              id="cognome"
              value={personRow ?? ""}
              onChange={(e) => {
                setPersonRow(e.target.value === "" ? null : Number(e.target.value));
                setNote(null);
              }}
              className="w-full rounded-xl border border-input bg-background px-3 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— Seleziona un cognome —</option>
              {layout.people.map((p) => (
                <option key={p.rowIndex} value={p.rowIndex}>
                  {p.name} (riga {p.excelRow})
                </option>
              ))}
            </select>
          </Card>
        )}

        {selectedPerson && (
          <Card step={3} title="Esporta e controlla il calendario">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{selectedPerson.name}</span> ·{" "}
              <span className="font-semibold text-foreground">{validRows.length}</span> turni pronti per l'esportazione
            </p>

            {validRows.length > 0 && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => download("apple")}
                  className="rounded-xl bg-gradient-brand px-4 py-4 font-display text-base font-bold text-brand-foreground shadow-soft transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  Scarica per Apple Calendar
                </button>
                <button
                  type="button"
                  onClick={() => download("google")}
                  className="rounded-xl border-2 border-brand px-4 py-4 font-display text-base font-bold text-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  Scarica per Google Calendar
                </button>
              </div>
            )}

            {note && (
              <p role="status" className="mt-4 rounded-xl bg-muted px-3 py-2 text-sm text-foreground">
                {note}
              </p>
            )}

            {months.length > 0 && (
              <div className="mt-6 space-y-4">
                <h3 className="font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  Anteprima calendario
                </h3>
                {months.map((m) => (
                  <MonthGrid key={`${m.year}-${m.month}`} year={m.year} month={m.month} rows={m.rows} />
                ))}
              </div>
            )}

            {invalidRows.length > 0 && (
              <div className="mt-5 rounded-xl border border-destructive/40 bg-destructive/5 p-3">
                <h3 className="text-sm font-semibold text-destructive">
                  Codici non riconosciuti ({invalidRows.length}) — non verranno esportati
                </h3>
                <ul className="mt-2 space-y-1 text-sm text-foreground">
                  {invalidRows.map((r, i) => (
                    <li key={i}>
                      {r.date.getDate()} {MONTHS[r.date.getMonth()]} — <span className="font-mono">{r.raw}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {rows.length === 0 && (
              <p className="mt-3 text-sm text-muted-foreground">Nessun turno presente per questa persona.</p>
            )}
          </Card>
        )}

        <footer className="pt-4 text-center text-xs text-muted-foreground">
          Nessun dato viene inviato o salvato: tutto avviene nel tuo browser e si azzera al ricaricamento della pagina.
        </footer>
      </main>
    </div>
  );
}
