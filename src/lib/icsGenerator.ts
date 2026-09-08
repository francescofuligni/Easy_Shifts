export interface CalendarEvent {
  title: string;
  allDay: boolean;
  /** Data del turno (giorno locale) */
  date: Date;
  startMinutes?: number;
  durationMinutes?: number;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function dateStamp(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function localStamp(d: Date): string {
  return `${dateStamp(d)}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function fold(line: string): string {
  if (line.length <= 74) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 74));
  rest = rest.slice(74);
  while (rest.length > 73) {
    parts.push(" " + rest.slice(0, 73));
    rest = rest.slice(73);
  }
  if (rest) parts.push(" " + rest);
  return parts.join("\r\n");
}

const VTIMEZONE_ROME = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Rome",
  "X-LIC-LOCATION:Europe/Rome",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

function utcStamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

export function generateIcs(events: CalendarEvent[], timeZone: string): string {
  const now = utcStamp(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Turni Calendario//IT//IT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...VTIMEZONE_ROME,
  ];

  events.forEach((ev, i) => {
    const uid = `${dateStamp(ev.date)}-${i}-${Math.random().toString(36).slice(2, 10)}@turni-calendario`;
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${now}`);
    if (ev.allDay) {
      const end = new Date(ev.date);
      end.setDate(end.getDate() + 1);
      lines.push(`DTSTART;VALUE=DATE:${dateStamp(ev.date)}`);
      lines.push(`DTEND;VALUE=DATE:${dateStamp(end)}`);
    } else {
      const start = new Date(ev.date);
      start.setMinutes(start.getMinutes() + (ev.startMinutes ?? 0));
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + (ev.durationMinutes ?? 0));
      lines.push(`DTSTART;TZID=${timeZone}:${localStamp(start)}`);
      lines.push(`DTEND;TZID=${timeZone}:${localStamp(end)}`);
    }
    lines.push(`SUMMARY:${escapeText(ev.title)}`);
    lines.push("END:VEVENT");
  });

  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function safeFileName(surname: string, month: number, year: number): string {
  const slug =
    surname
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "persona";
  return `turni-${slug}-${pad(month)}-${year}.ics`;
}

export function downloadIcs(content: string, fileName: string): void {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
