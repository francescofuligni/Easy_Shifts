import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { COMPANY_PROFILES, DEFAULT_PROFILE_ID, getProfile } from "@/lib/companyProfiles";
import { analyseSheet, cellToText, readWorkbook, type SheetLayout, type WorkbookData } from "@/lib/excelParser";
import { parseShiftCode } from "@/lib/shiftParser";
import { downloadIcs, generateIcs, safeFileName, type CalendarEvent } from "@/lib/icsGenerator";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Turni → Calendario | Da Excel a file .ics" },
      {
        name: "description",
        content:
          "Converti il tuo foglio Excel dei turni in un calendario .ics da importare in Apple Calendar o Google Calendar. Tutto nel tuo browser.",
      },
      { property: "og:title", content: "Turni → Calendario" },
      {
        property: "og:description",
        content: "Converti i turni Excel in un file .ics per Apple Calendar o Google Calendar, senza inviare dati.",
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

const WEEKDAYS = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
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

function fmtDate(d: Date): string {
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtTime(base: Date, minutes: number): string {
  const d = new Date(base);
  d.setMinutes(d.getMinutes() + minutes);
  const label = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const nextDay = d.getDate() !== base.getDate();
  return nextDay ? `${label} (+1 g)` : label;
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
      <h2 className="mb-4 flex items-center gap-3 text-base font-semibold text-foreground sm:text-lg">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
          {n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Index() {
  const [profileId, setProfileId] = useState(DEFAULT_PROFILE_ID);
  const [fileName, setFileName] = useState<string | null>(null);
  const [workbook, setWorkbook] = useState<WorkbookData | null>(null);
  const [sheetName, setSheetName] = useState<string>("");
  const [personRow, setPersonRow] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const profile = getProfile(profileId);

  const layout: SheetLayout | null = useMemo(() => {
    if (!workbook || !sheetName) return null;
    const grid = workbook.sheets[sheetName];
    if (!grid) return null;
    return analyseSheet(grid, profile);
  }, [workbook, sheetName, profile]);

  const filteredPeople = useMemo(() => {
    if (!layout) return [];
    const q = search.trim().toLowerCase();
    return q ? layout.people.filter((p) => p.name.toLowerCase().includes(q)) : layout.people;
  }, [layout, search]);

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

  function reset() {
    setPersonRow(null);
    setSearch("");
    setNote(null);
  }

  async function handleFile(file: File) {
    setError(null);
    setNote(null);
    setLoading(true);
    setWorkbook(null);
    setPersonRow(null);
    setSearch("");
    try {
      const name = file.name.toLowerCase();
      if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
        throw new Error("Formato non supportato. Carica un file .xlsx o .xls.");
      }
      const data = await readWorkbook(file);
      if (data.sheetNames.length === 0) throw new Error("Il file non contiene fogli leggibili.");
      setWorkbook(data);
      setSheetName(data.sheetNames[0]!);
      setFileName(file.name);
    } catch (e) {
      setFileName(null);
      setError(e instanceof Error ? e.message : "Impossibile leggere il file.");
    } finally {
      setLoading(false);
    }
  }

  function download(kind: "apple" | "google") {
    if (!selectedPerson || validRows.length === 0) return;
    const events = validRows.map((r) => r.event!);
    const first = validRows[0]!.date;
    const ics = generateIcs(events, profile.timeZone);
    downloadIcs(ics, safeFileName(selectedPerson.name, first.getMonth() + 1, first.getFullYear()));
    setNote(
      kind === "apple"
        ? "Apri il file scaricato con Calendar e scegli il calendario di destinazione."
        : "Importa il file scaricato in Google Calendar da computer, scegliendo il calendario di destinazione.",
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Turni → Calendario</h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Carica il foglio Excel dei turni, scegli la persona e scarica un file .ics da importare nel tuo calendario.
        </p>
      </header>

      <div className="space-y-5">
        <Step n={1} title="Scegli azienda e formato">
          <label htmlFor="azienda" className="mb-2 block text-sm font-medium text-foreground">
            Azienda / formato
          </label>
          <select
            id="azienda"
            value={profileId}
            onChange={(e) => {
              setProfileId(e.target.value);
              reset();
            }}
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {COMPANY_PROFILES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Step>

        <Step n={2} title="Carica il file Excel">
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
              if (f) void handleFile(f);
            }}
            className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
              dragging ? "border-primary bg-accent" : "border-border bg-muted/40"
            }`}
          >
            <p className="text-sm text-muted-foreground">Trascina qui il file oppure</p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-3 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
                if (f) void handleFile(f);
                e.target.value = "";
              }}
            />
            <p className="mt-3 text-xs text-muted-foreground">
              Il file viene elaborato solo nel tuo browser e non viene salvato.
            </p>
          </div>
          {loading && <p className="mt-3 text-sm text-muted-foreground">Lettura del file in corso…</p>}
          {fileName && !loading && (
            <p className="mt-3 text-sm text-foreground">
              File caricato: <span className="font-medium">{fileName}</span>
            </p>
          )}
          {error && (
            <p role="alert" className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              {error}
            </p>
          )}
        </Step>

        {workbook && (
          <Step n={3} title="Scegli il foglio">
            {workbook.sheetNames.length > 1 ? (
              <>
                <label htmlFor="foglio" className="mb-2 block text-sm font-medium text-foreground">
                  Foglio del file
                </label>
                <select
                  id="foglio"
                  value={sheetName}
                  onChange={(e) => {
                    setSheetName(e.target.value);
                    reset();
                  }}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {workbook.sheetNames.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Il file contiene un solo foglio: <span className="font-medium text-foreground">{sheetName}</span>.
              </p>
            )}
            {!layout && (
              <p role="alert" className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                In questo foglio non sono state trovate date o persone valide. Scegli un altro foglio o verifica il file.
              </p>
            )}
          </Step>
        )}

        {layout && (
          <Step n={4} title="Scegli la persona">
            <label htmlFor="ricerca" className="mb-2 block text-sm font-medium text-foreground">
              Cerca per cognome
            </label>
            <input
              id="ricerca"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Es. ROSSI"
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto" aria-label="Elenco persone">
              {filteredPeople.map((p) => {
                const active = p.rowIndex === personRow;
                return (
                  <li key={p.rowIndex}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setPersonRow(p.rowIndex);
                        setNote(null);
                      }}
                      className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-foreground hover:bg-accent"
                      }`}
                    >
                      <span className="font-medium">{p.name}</span>
                      <span className={active ? "opacity-80" : "text-muted-foreground"}> — riga {p.excelRow}</span>
                    </button>
                  </li>
                );
              })}
              {filteredPeople.length === 0 && (
                <li className="px-1 py-2 text-sm text-muted-foreground">Nessuna persona trovata.</li>
              )}
            </ul>
          </Step>
        )}

        {selectedPerson && (
          <Step n={5} title="Controlla i turni">
            <p className="text-sm text-muted-foreground">
              Persona: <span className="font-medium text-foreground">{selectedPerson.name}</span> (riga{" "}
              {selectedPerson.excelRow}) · <span className="font-medium text-foreground">{validRows.length}</span> eventi
              da esportare
            </p>

            {validRows.length > 0 && (
              <>
                <div className="mt-4 hidden overflow-x-auto sm:block">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                        <th scope="col" className="py-2 pr-3">Data</th>
                        <th scope="col" className="py-2 pr-3">Codice</th>
                        <th scope="col" className="py-2 pr-3">Titolo</th>
                        <th scope="col" className="py-2 pr-3">Inizio</th>
                        <th scope="col" className="py-2 pr-3">Fine</th>
                        <th scope="col" className="py-2">Stato</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validRows.map((r, i) => (
                        <tr key={i} className="border-b border-border/60">
                          <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(r.date)}</td>
                          <td className="py-2 pr-3 font-mono">{r.raw}</td>
                          <td className="py-2 pr-3 font-mono">{r.title}</td>
                          <td className="py-2 pr-3 whitespace-nowrap">{r.start}</td>
                          <td className="py-2 pr-3 whitespace-nowrap">{r.end}</td>
                          <td className="py-2">Ok</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <ul className="mt-4 space-y-2 sm:hidden">
                  {validRows.map((r, i) => (
                    <li key={i} className="rounded-lg border border-border p-3 text-sm">
                      <p className="font-medium text-foreground">{fmtDate(r.date)}</p>
                      <p className="mt-1 text-muted-foreground">
                        Codice <span className="font-mono text-foreground">{r.raw}</span> · titolo{" "}
                        <span className="font-mono text-foreground">{r.title}</span>
                      </p>
                      <p className="text-muted-foreground">
                        {r.start === "Tutto il giorno" ? "Tutto il giorno" : `Dalle ${r.start} alle ${r.end}`}
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {invalidRows.length > 0 && (
              <div className="mt-5 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                <h3 className="text-sm font-semibold text-destructive">
                  Codici non riconosciuti ({invalidRows.length}) — non verranno esportati
                </h3>
                <ul className="mt-2 space-y-1 text-sm text-foreground">
                  {invalidRows.map((r, i) => (
                    <li key={i}>
                      {fmtDate(r.date)} — <span className="font-mono">{r.raw}</span> — Codice non riconosciuto
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {rows.length === 0 && (
              <p className="mt-3 text-sm text-muted-foreground">Nessun turno presente per questa persona.</p>
            )}
          </Step>
        )}

        {selectedPerson && validRows.length > 0 && (
          <Step n={6} title="Esporta calendario">
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => download("apple")}
                className="rounded-lg bg-primary px-4 py-4 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                Scarica per Apple Calendar
              </button>
              <button
                type="button"
                onClick={() => download("google")}
                className="rounded-lg border border-primary px-4 py-4 text-base font-semibold text-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                Scarica per Google Calendar
              </button>
            </div>
            {note && (
              <p role="status" className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
                {note}
              </p>
            )}
          </Step>
        )}
      </div>

      <footer className="mt-10 text-center text-xs text-muted-foreground">
        Nessun dato viene inviato o salvato: tutto avviene nel tuo browser e si azzera al ricaricamento della pagina.
      </footer>
    </main>
  );
}
