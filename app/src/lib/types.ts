export type Rolle = "admin" | "hebamme";

export type SchichtTyp =
  | "tagdienst"
  | "nachtdienst"
  | "bd_tag"
  | "bd_nacht"
  | "anmeldung";

export type VerfuegbarFuer =
  | "alle"
  | "tagdienst"
  | "nachtdienst"
  | "bd_tag"
  | "bd_nacht"
  | "anmeldung";

export type FreiWunsch = "wichtig" | "waere_schoen";

export type PlanStatus = "entwurf" | "generiert" | "freigegeben";

export type FeiertagTyp = "feiertag" | "ferien";

export interface HebammeSettings {
  nur_tagdienste?: boolean;
  nur_bds?: boolean;
  keine_anmeldung?: boolean;
  bd_24h?: boolean;
  lieber_nachtdienste?: boolean;
  max_we_dienste?: number;
  fix_blocked_weekdays?: number[]; // 0=So..6=Sa
  fix_frei_weekdays?: number[];
  fix_blocked_dates?: string[]; // YYYY-MM-DD, höhere Priorität als Wochentag-Pattern
  fix_frei_dates?: string[];
}

export interface Hebamme {
  id: string;
  email: string;
  vorname: string;
  nachname: string;
  rolle: Rolle;
  farbe: string;
  fairness_score: number;
  aktiv: boolean;
  settings?: HebammeSettings | null;
}

export interface SchichtSlot {
  id: string;
  datum: string;
  typ: SchichtTyp;
  ist_feiertag: boolean;
  monat: string;
  notizen: string;
}

export interface DienstEintrag {
  typ: SchichtTyp;
  zeit_von: string;
  zeit_bis: string;
}

export interface Wunsch {
  id: string;
  hebamme: string;
  datum: string;
  monat: string;
  verfuegbar_fuer: VerfuegbarFuer[];
  frei_wunsch: FreiWunsch | null;
  ist_urlaub: boolean;
  ziel_dienste: number; // legacy / fallback for max
  ziel_dienste_min?: number;
  ziel_dienste_max?: number;
  ziel_anmeldungen: number;
  besonderheiten: string;
  zeit_von: string;
  zeit_bis: string;
  dienste_json?: DienstEintrag[] | null;
}

export interface Zuweisung {
  id: string;
  hebamme: string;
  schicht_slot: string;
  monat: string;
  wunsch_erfuellt: boolean;
  manuell_geaendert: boolean;
  notizen: string;
  zeit_von: string;
  zeit_bis: string;
  expand?: {
    hebamme?: Hebamme;
    schicht_slot?: SchichtSlot;
  };
}

export interface Dienstplan {
  id: string;
  monat: string;
  status: PlanStatus;
  generiert_am: string;
  freigegeben_am: string;
  freigegeben_von: string;
  statistik: Record<string, unknown>;
}

export interface Feiertag {
  id: string;
  datum: string;
  name: string;
  typ: FeiertagTyp;
}

export const SCHICHT_LABELS: Record<SchichtTyp, string> = {
  tagdienst: "Tagdienst",
  nachtdienst: "Nachtdienst",
  bd_tag: "BD Tag",
  bd_nacht: "BD Nacht",
  anmeldung: "Anmeldung",
};

export const SCHICHT_FARBEN: Record<SchichtTyp, string> = {
  tagdienst: "from-amber-400/80 to-orange-400/80",
  nachtdienst: "from-indigo-500/80 to-purple-500/80",
  bd_tag: "from-sky-400/80 to-cyan-400/80",
  bd_nacht: "from-blue-600/80 to-indigo-600/80",
  anmeldung: "from-emerald-400/80 to-teal-400/80",
};

export const WOCHENTAGE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

export const VERFUEGBAR_LABELS: Record<VerfuegbarFuer, string> = {
  alle: "Alle Dienste",
  tagdienst: "Tagdienst",
  nachtdienst: "Nachtdienst",
  bd_tag: "BD Tag",
  bd_nacht: "BD Nacht",
  anmeldung: "Anmeldung",
};
