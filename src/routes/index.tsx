import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { COMPANY_PROFILES, DEFAULT_PROFILE_ID, getProfile } from "@/lib/companyProfiles";
import { analyseSheet, cellToText, readWorkbook, type SheetLayout, type WorkbookData } from "@/lib/excelParser";
import { parseShiftCode } from "@/lib/shiftParser";
import { downloadIcs, generateIcs, safeFileName, type CalendarEvent } from "@/lib/icsGenerator";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useI18n } from "@/lib/i18n";

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
  allDayLabel?: boolean;
  event?: CalendarEvent;
}


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
  const { t } = useI18n();
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
        {t.months[month]} {year}
      </h3>
      <div className="grid grid-cols-7 gap-1 text-center text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
        {t.weekdays.map((w) => (
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
                    <span className="mt-0.5 block text-[0.7rem] font-bold leading-tight text-foreground">
                      {shift.title}
                      <span className="block font-medium">
                        {shift.allDayLabel ? t.allDay : `${shift.start}–${shift.end}`}
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
  const { t, lang } = useI18n();

  useEffect(() => {
    document.title = `${t.siteTitle} | ${t.kicker}`;
  }, [t]);

  const [profileId, setProfileId] = useState(DEFAULT_PROFILE_ID);
  const [file, setFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<WorkbookData | null>(null);
  const [personRow, setPersonRow] = useState<number | null>(null);
  const [error, setError] = useState<"unsupported" | "noSheets" | "unreadable" | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [note, setNote] = useState<"apple" | "google" | null>(null);
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
        start: parsed.allDay ? "" : fmtTime(day.date, parsed.startMinutes!),
        end: parsed.allDay ? "" : fmtTime(day.date, parsed.startMinutes! + parsed.durationMinutes!),
        ok: true,
        allDayLabel: !!parsed.allDay,
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
        setError("unsupported");
        return;
      }
      const data = await readWorkbook(file);
      if (data.sheetNames.length === 0) {
        setError("noSheets");
        return;
      }
      setWorkbook(data);
    } catch {
      setError("unreadable");
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
    setNote(kind);
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-brand">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap justify-end gap-1.5 px-4 pt-2 sm:pt-3">
          <LanguageToggle />
          <ThemeToggle />
        </div>
        <header className="mx-auto w-full max-w-4xl px-4 pb-12 pt-6 text-center sm:pb-16">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.25em] text-brand-foreground">
            {t.kicker}
          </p>
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-brand-foreground sm:text-5xl">
            {t.siteTitle}
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-sm text-brand-foreground sm:text-base">{t.intro}</p>
        </header>
      </div>

      <main className="mx-auto -mt-8 w-full max-w-4xl space-y-5 px-4 pb-16">
        <Card step={1} title={t.step1}>
          <label htmlFor="azienda" className="mb-2 block text-sm font-medium text-foreground">
            {t.companyLabel}
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
            <p className="text-sm text-muted-foreground">{t.dropHint}</p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-3 inline-flex items-center justify-center rounded-xl border border-brand bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {t.chooseFile}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              aria-label={t.fileInputLabel}
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pickFile(f);
                e.target.value = "";
              }}
            />
            {file && (
              <p className="mt-3 text-sm text-foreground">
                {t.chosenFile} <span className="font-semibold">{file.name}</span>
              </p>
            )}
          </div>

          <button
            type="button"
            disabled={!file || loading}
            onClick={() => void process()}
            className="mt-4 w-full rounded-xl bg-gradient-brand px-4 py-4 font-display text-base font-bold text-brand-foreground shadow-soft transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? t.reading : t.getCalendar}
          </button>

          {error && (
            <p role="alert" className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              {error === "unsupported" ? t.errUnsupported : error === "noSheets" ? t.errNoSheets : t.errUnreadable}
            </p>
          )}
          {workbook && !layout && (
            <p role="alert" className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              {t.errNoLayout}
            </p>
          )}
        </Card>

        {layout && (
          <Card step={2} title={t.step2}>
            <label htmlFor="cognome" className="mb-2 block text-sm font-medium text-foreground">
              {t.surnameLabel(layout.people.length)}
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
              <option value="">{t.selectSurname}</option>
              {layout.people.map((p) => (
                <option key={p.rowIndex} value={p.rowIndex}>
                  {p.name} ({t.rowWord} {p.excelRow})
                </option>
              ))}
            </select>
          </Card>
        )}

        {selectedPerson && (
          <Card step={3} title={t.step3}>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{selectedPerson.name}</span> ·{" "}
              <span className="font-semibold text-foreground">{validRows.length}</span> {t.shiftsReady}
            </p>

            {validRows.length > 0 && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => download("apple")}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-brand px-4 py-4 font-display text-base font-bold text-brand-foreground shadow-soft transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <span className="rounded bg-accent px-1.5 py-0.5 text-xs font-bold text-accent-foreground">.ics</span>
                  {t.downloadApple}
                </button>
                <button
                  type="button"
                  onClick={() => download("google")}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-brand px-4 py-4 font-display text-base font-bold text-brand-foreground shadow-soft transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <span className="rounded bg-accent px-1.5 py-0.5 text-xs font-bold text-accent-foreground">.ics</span>
                  {t.downloadGoogle}
                </button>
              </div>
            )}

            {note && (
              <p role="status" className="mt-4 rounded-xl bg-muted px-3 py-2 text-sm text-foreground">
                {note === "apple" ? t.noteApple : t.noteGoogle}
              </p>
            )}

            {months.length > 0 && (
              <div className="mt-6 space-y-4">
                <h3 className="font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  {t.previewTitle}
                </h3>
                {months.map((m) => (
                  <MonthGrid key={`${m.year}-${m.month}`} year={m.year} month={m.month} rows={m.rows} />
                ))}
              </div>
            )}

            {invalidRows.length > 0 && (
              <div className="mt-5 rounded-xl border border-destructive/40 bg-destructive/5 p-3">
                <h3 className="text-sm font-semibold text-destructive">
                  {t.unrecognized(invalidRows.length)}
                </h3>
                <ul className="mt-2 space-y-1 text-sm text-foreground">
                  {invalidRows.map((r, i) => (
                    <li key={i}>
                      {r.date.getDate()} {t.months[r.date.getMonth()]} — <span className="font-mono">{r.raw}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {rows.length === 0 && (
              <p className="mt-3 text-sm text-muted-foreground">{t.noShifts}</p>
            )}
          </Card>
        )}

        <footer className="space-y-3 pt-6 text-center text-xs text-muted-foreground">
          <p>{t.privacy}</p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <a
              href="https://github.com/francescofuligni"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 underline-offset-2 transition-colors hover:text-accent hover:underline"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-current">
                <path d="M12 .297C5.37.297 0 5.67 0 12.297c0 5.304 3.438 9.8 8.207 11.387.6.11.793-.26.793-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.73.083-.73 1.205.085 1.84 1.236 1.84 1.236 1.07 1.835 2.807 1.305 3.492.998.108-.776.42-1.305.763-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.468-2.382 1.235-3.22-.124-.303-.535-1.523.117-3.176 0 0 1.008-.322 3.3 1.23A11.51 11.51 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.29-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.873.118 3.176.77.838 1.233 1.91 1.233 3.22 0 4.61-2.807 5.625-5.48 5.92.43.372.815 1.103.815 2.222 0 1.606-.015 2.898-.015 3.293 0 .32.192.694.8.577C20.565 22.092 24 17.598 24 12.297 24 5.67 18.627.297 12 .297z" />
              </svg>
              GitHub
            </a>
            <a
              href="https://linktr.ee/francescofuligni"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 underline-offset-2 transition-colors hover:text-accent hover:underline"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-current">
                <path d="M7.2 3.6a1.2 1.2 0 011.2 1.2 1.2 1.2 0 01-1.2 1.2A1.2 1.2 0 016 4.8a1.2 1.2 0 011.2-1.2zm0 7.2a1.2 1.2 0 011.2 1.2 1.2 1.2 0 01-1.2 1.2A1.2 1.2 0 016 12a1.2 1.2 0 011.2-1.2zm0 7.2a1.2 1.2 0 011.2 1.2 1.2 1.2 0 01-1.2 1.2A1.2 1.2 0 016 19.2a1.2 1.2 0 011.2-1.2zM12 6a6 6 0 016 6 6 6 0 01-6 6 6 6 0 01-6-6 6 6 0 016-6zm0 1.2A4.8 4.8 0 007.2 12 4.8 4.8 0 0012 16.8 4.8 4.8 0 0016.8 12 4.8 4.8 0 0012 7.2z" />
              </svg>
              Linktree
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}
