import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "it" | "en";

interface Dict {
  months: string[];
  weekdays: string[];
  themeToLight: string;
  themeToDark: string;
  themeLight: string;
  themeDark: string;
  langLabel: string;
  kicker: string;
  intro: string;
  step1: string;
  companyLabel: string;
  dropHint: string;
  chooseFile: string;
  fileInputLabel: string;
  chosenFile: string;
  getCalendar: string;
  reading: string;
  errUnsupported: string;
  errNoSheets: string;
  errUnreadable: string;
  errNoLayout: string;
  step2: string;
  surnameLabel: (n: number) => string;
  selectSurname: string;
  rowWord: string;
  step3: string;
  shiftsReady: string;
  downloadApple: string;
  downloadGoogle: string;
  noteApple: string;
  noteGoogle: string;
  previewTitle: string;
  allDay: string;
  unrecognized: (n: number) => string;
  noShifts: string;
  privacy: string;
}

const it: Dict = {
  months: [
    "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
    "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
  ],
  weekdays: ["lun", "mar", "mer", "gio", "ven", "sab", "dom"],
  themeToLight: "Passa al tema chiaro",
  themeToDark: "Passa al tema scuro",
  themeLight: "Chiaro",
  themeDark: "Scuro",
  langLabel: "Lingua",
  kicker: "Dai turni al calendario",
  intro:
    "Carica il file Excel dei turni: viene letto il primo foglio del file. Scegli il tuo cognome e scarica il calendario. Tutto avviene nel tuo browser, nessun dato viene inviato.",
  step1: "Carica il file e scegli l'azienda",
  companyLabel: "Azienda / formato",
  dropHint: "Trascina qui il file Excel oppure",
  chooseFile: "Scegli file",
  fileInputLabel: "Carica il file Excel dei turni",
  chosenFile: "File scelto:",
  getCalendar: "Ottieni calendario",
  reading: "Lettura in corso…",
  errUnsupported: "Formato non supportato. Carica un file .xlsx o .xls.",
  errNoSheets: "Il file non contiene fogli leggibili.",
  errUnreadable: "Impossibile leggere il file.",
  errNoLayout: "Nel primo foglio non sono state trovate date o persone valide. Verifica il file.",
  step2: "Scegli il cognome",
  surnameLabel: (n) => `Cognome (${n} trovati nel file)`,
  selectSurname: "— Seleziona un cognome —",
  rowWord: "riga",
  step3: "Esporta e controlla il calendario",
  shiftsReady: "turni pronti per l'esportazione",
  downloadApple: "Scarica per Apple Calendar",
  downloadGoogle: "Scarica per Google Calendar",
  noteApple: "Apri il file scaricato con Calendario e scegli il calendario di destinazione.",
  noteGoogle:
    "Importa il file scaricato in Google Calendar da computer, scegliendo il calendario di destinazione.",
  previewTitle: "Anteprima calendario",
  allDay: "tutto il giorno",
  unrecognized: (n) => `Codici non riconosciuti (${n}) — non verranno esportati`,
  noShifts: "Nessun turno presente per questa persona.",
  privacy:
    "Nessun dato viene inviato o salvato: tutto avviene nel tuo browser e si azzera al ricaricamento della pagina.",
};

const en: Dict = {
  months: [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ],
  weekdays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
  themeToLight: "Switch to light theme",
  themeToDark: "Switch to dark theme",
  themeLight: "Light",
  themeDark: "Dark",
  langLabel: "Language",
  kicker: "From shifts to your calendar",
  intro:
    "Upload the Excel shift file: the first sheet is used. Pick your surname and download the calendar. Everything happens in your browser, no data is sent.",
  step1: "Upload the file and choose the company",
  companyLabel: "Company / format",
  dropHint: "Drag the Excel file here or",
  chooseFile: "Choose file",
  fileInputLabel: "Upload the Excel shift file",
  chosenFile: "Selected file:",
  getCalendar: "Get calendar",
  reading: "Reading…",
  errUnsupported: "Unsupported format. Please upload an .xlsx or .xls file.",
  errNoSheets: "The file contains no readable sheets.",
  errUnreadable: "The file could not be read.",
  errNoLayout: "No valid dates or people were found in the first sheet. Please check the file.",
  step2: "Choose the surname",
  surnameLabel: (n) => `Surname (${n} found in the file)`,
  selectSurname: "— Select a surname —",
  rowWord: "row",
  step3: "Export and check the calendar",
  shiftsReady: "shifts ready to export",
  downloadApple: "Download for Apple Calendar",
  downloadGoogle: "Download for Google Calendar",
  noteApple: "Open the downloaded file with Calendar and choose the destination calendar.",
  noteGoogle:
    "Import the downloaded file into Google Calendar from a computer, choosing the destination calendar.",
  previewTitle: "Calendar preview",
  allDay: "all day",
  unrecognized: (n) => `Unrecognised codes (${n}) — they will not be exported`,
  noShifts: "No shifts found for this person.",
  privacy:
    "No data is sent or stored: everything happens in your browser and is cleared when the page reloads.",
};

const DICTS: Record<Lang, Dict> = { it, en };

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Dict;
}

const I18nContext = createContext<I18nValue>({ lang: "it", setLang: () => {}, t: it });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("it");

  useEffect(() => {
    const stored = localStorage.getItem("tf-lang");
    if (stored === "en" || stored === "it") setLang(stored);
    else if (typeof navigator !== "undefined" && !navigator.language.toLowerCase().startsWith("it")) {
      setLang("en");
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem("tf-lang", lang);
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t: DICTS[lang] }), [lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
