# Easy Shifts

**Easy Shifts** is a static web app that converts an Excel work-shift schedule into an `.ics` calendar file, ready to import into Apple Calendar or Google Calendar.

The app runs entirely in the browser: Excel files and personal data are never uploaded, sent, or stored on a server.

> Currently supported company profile: **GH Bologna CKIN + LOST**

## Features

- Local upload of `.xlsx` and `.xls` files
- Support for workbooks with one or multiple sheets
- Automatic detection of the date row and schedule columns
- Employee search and selection
- Duplicate surnames remain distinguishable through their row number
- Chronological shift preview, including unrecognized codes
- `.ics` export compatible with Apple Calendar and Google Calendar
- Accessible, responsive, Italian-language interface

## Privacy

Your uploaded file is processed locally in your browser.

- No backend, database, user account, or authentication
- No upload or retention of Excel files or personal data
- No Google Calendar integration, Google OAuth, or external APIs
- No tracking cookies or analytics

All processed data is removed when the page is refreshed.

## Supported Excel format

For the **GH Bologna CKIN + LOST** profile:

- Surnames are in the first column (A).
- The row with the largest number of date cells is detected automatically.
- Columns with valid dates are detected dynamically, supporting months with 28 to 31 days in any year.
- Employees are the rows after the date row that contain a value in column A.
- Surnames are preserved exactly as written in the spreadsheet, including spaces, asterisks, and symbols.

## Shift codes

| Code | Generated event |
| --- | --- |
| Empty cell | No event |
| `R`, `R1`, `R2`, `RC` | All-day event |
| `C` | 08:00–22:00 |
| One-letter code, e.g. `F` or `X` | All-day event |
| `L0706` | `L070`, 07:00–13:00 |
| `B1445` | `B144`, 14:40–19:40 |
| Unrecognized code | No event; clearly shown in the preview |

A complete shift code has this format:

```
letter + 3 time digits + 1 duration digit
```

The third time digit represents the tens of minutes:

- `0` → `:00`
- `3` → `:30`
- `4` → `:40`

For example, `B1445` becomes a `B144` event from 14:40 to 19:40. If a shift ends after midnight, the event correctly ends on the following day.

## Calendar export

Easy Shifts generates files compliant with [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545), using the `Europe/Rome` timezone.

- All-day events end on the following date, as required by ICS.
- Timed shifts include the correct start and end times.
- ICS titles are safely escaped.
- No colors, descriptions, guests, reminders, or proprietary metadata are added.
- Exported files use names similar to `shifts-rossi-september-2026.ics`.

The Apple Calendar and Google Calendar download buttons both generate the same `.ics` file.

## Tech stack

- React
- TypeScript
- [SheetJS / xlsx](https://sheetjs.com/) for local Excel parsing
- In-browser ICS generation

The architecture is designed to support additional company formats without rewriting the application:

```
src/
├── companyProfiles/  # company/format configurations
├── excelParser/      # Excel parsing and data detection
├── shiftParser/      # shift-code interpretation
├── icsGenerator/     # .ics file generation
└── components/       # UI components
```

## Run locally

Node.js and npm are required.

```sh
git clone https://github.com/francescofuligni/Easy_Shifts.git
cd Easy_Shifts
npm install
npm run dev
```

## Demo

Try the live app at [turni-facili.lovable.app](https://turni-facili.lovable.app).

## Contributing

To propose an improvement or add support for another Excel format:

1. Create a dedicated branch.
2. Keep all file and personal-data processing client-side.
3. Add the new configuration under `companyProfiles`.
4. Test different month lengths, multiple sheets, duplicate surnames, overnight shifts, and unrecognized codes.

---

Built with [Lovable](https://lovable.dev).
