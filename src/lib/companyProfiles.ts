export interface CompanyProfile {
  id: string;
  /** Nome mostrato nel selettore */
  label: string;
  /** Fuso orario usato per gli eventi con orario */
  timeZone: string;
  /** Colonna (0-based) che contiene i cognomi */
  nameColumnIndex: number;
  /** Numero massimo di righe in cui cercare la riga delle date */
  dateRowSearchLimit: number;
  /** Numero minimo di celle data perché una riga sia considerata riga delle date */
  minDateCells: number;
}

export const COMPANY_PROFILES: CompanyProfile[] = [
  {
    id: "gh-bologna-ckin-lost",
    label: "GH Bologna CKIN + LOST",
    timeZone: "Europe/Rome",
    nameColumnIndex: 0,
    dateRowSearchLimit: 20,
    minDateCells: 3,
  },
];

export const DEFAULT_PROFILE_ID = COMPANY_PROFILES[0]!.id;

export function getProfile(id: string): CompanyProfile {
  return COMPANY_PROFILES.find((p) => p.id === id) ?? COMPANY_PROFILES[0]!;
}
