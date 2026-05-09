"use client";

import { AuthGuard } from "@/components/auth-guard";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { NavBar } from "@/components/ui/nav-bar";
import { GlassCard } from "@/components/ui/glass-card";
import type { SchichtTyp, Feiertag } from "@/lib/types";
import { getWuensche, saveWuenscheBulk, getTeam, getFeiertage, type WunschBulkEintrag } from "@/lib/api";
import { getBayernHolidays, type HolidayMap } from "@/lib/holidays";
import type { Hebamme } from "@/lib/types";
import {
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  Save,
  Sun,
  Moon,
  Clock,
  FileText,
  Info,
  X,
  Check,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

type DayStatus =
  | "leer"
  | "verfuegbar"
  | "frei_schoen"
  | "frei_wichtig"
  | "urlaub";

type ZeitFenster = { von: string; bis: string };

type DienstEintrag = {
  typ: SchichtTyp;
  zeit: ZeitFenster;
};

type DayDetail = {
  dienste: DienstEintrag[];
};

const STATUS_CYCLE: DayStatus[] = [
  "leer",
  "verfuegbar",
  "frei_schoen",
  "frei_wichtig",
  "urlaub",
];

const STATUS_CONFIG: Record<
  DayStatus,
  { bg: string; ring: string; emoji: string; label: string; textClr: string }
> = {
  leer: { bg: "", ring: "", emoji: "", label: "Nicht ausgefüllt", textClr: "" },
  verfuegbar: { bg: "bg-emerald-500/25", ring: "ring-1 ring-emerald-400/40", emoji: "✓", label: "Kann arbeiten", textClr: "text-emerald-300" },
  frei_schoen: { bg: "bg-amber-500/25", ring: "ring-1 ring-amber-400/40", emoji: "♡", label: "Wäre schön frei", textClr: "text-amber-300" },
  frei_wichtig: { bg: "bg-orange-500/25", ring: "ring-1 ring-orange-400/40", emoji: "!", label: "Wichtig frei", textClr: "text-orange-300" },
  urlaub: { bg: "bg-blue-500/25", ring: "ring-1 ring-blue-400/40", emoji: "🏖", label: "Urlaub", textClr: "text-blue-300" },
};

const DEFAULT_ZEITEN: Record<SchichtTyp, ZeitFenster> = {
  tagdienst: { von: "07:00", bis: "19:00" },
  nachtdienst: { von: "19:00", bis: "07:00" },
  bd_tag: { von: "07:00", bis: "19:00" },
  bd_nacht: { von: "19:00", bis: "07:00" },
  anmeldung: { von: "09:00", bis: "14:00" },
};

const ZEIT_OPTIONEN = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

const DIENST_OPTIONEN: {
  value: SchichtTyp;
  label: string;
  icon: typeof Sun;
  farbe: string;
  farbeBg: string;
}[] = [
  { value: "tagdienst", label: "Tagdienst (TD)", icon: Sun, farbe: "text-amber-300", farbeBg: "bg-amber-500/15 ring-amber-400/30" },
  { value: "nachtdienst", label: "Nachtdienst (ND)", icon: Moon, farbe: "text-indigo-300", farbeBg: "bg-indigo-500/15 ring-indigo-400/30" },
  { value: "bd_tag", label: "Tagbereitschaft (TBD)", icon: Clock, farbe: "text-sky-300", farbeBg: "bg-sky-500/15 ring-sky-400/30" },
  { value: "bd_nacht", label: "Nachtbereitschaft (NBD)", icon: Clock, farbe: "text-blue-300", farbeBg: "bg-blue-500/15 ring-blue-400/30" },
  { value: "anmeldung", label: "Geburtsanmeldung", icon: FileText, farbe: "text-emerald-300", farbeBg: "bg-emerald-500/15 ring-emerald-400/30" },
];

const PRESETS: { label: string; dienste: SchichtTyp[] }[] = [
  { label: "Alles", dienste: ["tagdienst", "nachtdienst", "bd_tag", "bd_nacht", "anmeldung"] },
  { label: "Nur tagsüber (TD+TBD)", dienste: ["tagdienst", "bd_tag"] },
  { label: "Nur nachts (ND+NBD)", dienste: ["nachtdienst", "bd_nacht"] },
  { label: "Tagsüber oder BD (TD/TBD/NBD)", dienste: ["tagdienst", "bd_tag", "bd_nacht"] },
  { label: "Nachts oder BD (ND/TBD/NBD)", dienste: ["nachtdienst", "bd_tag", "bd_nacht"] },
  { label: "Bereitschaft 24 h", dienste: ["bd_tag", "bd_nacht"] },
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

const MONATE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];
const WOCHENTAGE_LANG = [
  "Sonntag", "Montag", "Dienstag", "Mittwoch",
  "Donnerstag", "Freitag", "Samstag",
];

const SHEET_DELAY = 1500;

function kurzZeit(z: string) {
  const [h, m] = z.split(":");
  const hNum = parseInt(h, 10);
  return m === "00" ? `${hNum}` : `${hNum}:${m}`;
}

type TeamDayStatus = {
  verfuegbar: number;
  freiWunsch: number;
  nichtVerfuegbar: number;
};

type TeamCoverage = {
  von: string;
  bis: string;
  name: string;
};

type TeamShiftCoverage = Partial<Record<SchichtTyp, TeamCoverage[]>>;

function getInitialMonth() {
  // default to next month
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

function getSmartDefault(typ: SchichtTyp, coverage?: TeamCoverage[]): ZeitFenster {
  const base = DEFAULT_ZEITEN[typ];
  if (!coverage || coverage.length === 0) return { ...base };
  const lastBis = coverage.reduce((latest, c) => (c.bis > latest ? c.bis : latest), "00:00");
  if (lastBis >= base.bis && base.von < base.bis) return { ...base };
  return { von: lastBis, bis: base.bis };
}

export default function WunschplanPage() {
  const { user } = useAuth();
  const init = getInitialMonth();
  const [year, setYear] = useState(init.year);
  const [month, setMonth] = useState(init.month);

  const [dayStates, setDayStates] = useState<Record<number, DayStatus>>({});
  const [dayDetails, setDayDetails] = useState<Record<number, DayDetail>>({});
  const [sheetDay, setSheetDay] = useState<number | null>(null);
  const [sheetZeiten, setSheetZeiten] = useState<Record<string, ZeitFenster>>({});
  const [zielDiensteMin, setZielDiensteMin] = useState(5);
  const [zielDiensteMax, setZielDiensteMax] = useState(8);
  const [zielAnmeldungen, setZielAnmeldungen] = useState(1);
  const [showHelp, setShowHelp] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [teamMembers, setTeamMembers] = useState<Hebamme[]>([]);
  const [feiertage, setFeiertage] = useState<Feiertag[]>([]);
  const [bayernHolidays, setBayernHolidays] = useState<HolidayMap>({});

  const sheetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const monatKey = `${year}-${String(month + 1).padStart(2, "0")}`;

  // Load team + Feiertage
  useEffect(() => {
    getTeam().then(setTeamMembers).catch(() => {});
  }, []);
  useEffect(() => {
    getFeiertage(year).then(setFeiertage).catch(() => {});
    getBayernHolidays(year).then(setBayernHolidays).catch(() => setBayernHolidays({}));
  }, [year]);

  // Combined map: user-defined feiertage take precedence, else Bayern data
  const holidayByDay = useMemo(() => {
    const map: Record<string, { name: string; kind: "feiertag" | "ferien" }> = { ...bayernHolidays };
    for (const f of feiertage) {
      const key = f.datum.slice(0, 10);
      map[key] = { name: f.name || (f.typ === "feiertag" ? "Feiertag" : "Ferien"), kind: f.typ };
    }
    return map;
  }, [bayernHolidays, feiertage]);

  // Pre-fill with user's fixed weekdays + specific dates (settings)
  const applyFixSettings = useCallback(
    (states: Record<number, DayStatus>, daysInM: number) => {
      const settings = user?.settings;
      if (!settings) return states;
      const blockedWd = settings.fix_blocked_weekdays || [];
      const freiWd = settings.fix_frei_weekdays || [];
      const blockedDates = new Set(settings.fix_blocked_dates || []);
      const freiDates = new Set(settings.fix_frei_dates || []);
      for (let d = 1; d <= daysInM; d++) {
        if (states[d]) continue; // explicit user choice has priority
        const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        // Specific dates win over weekday patterns
        if (blockedDates.has(dateKey)) { states[d] = "urlaub"; continue; }
        if (freiDates.has(dateKey)) { states[d] = "frei_schoen"; continue; }
        const dow = new Date(year, month, d).getDay();
        if (blockedWd.includes(dow)) states[d] = "urlaub";
        else if (freiWd.includes(dow)) states[d] = "frei_schoen";
      }
      return states;
    },
    [user, year, month]
  );

  // Load existing wishes when month changes
  useEffect(() => {
    if (!user) return;
    setSaved(false);
    getWuensche(monatKey, user.id).then((wuensche) => {
      const states: Record<number, DayStatus> = {};
      const details: Record<number, DayDetail> = {};
      let dMin = 5;
      let dMax = 8;
      let anmeldungen = 1;

      for (const w of wuensche) {
        const d = new Date(w.datum).getDate();
        if (w.ist_urlaub) {
          states[d] = "urlaub";
        } else if (w.frei_wunsch === "wichtig") {
          states[d] = "frei_wichtig";
        } else if (w.frei_wunsch === "waere_schoen") {
          states[d] = "frei_schoen";
        } else if (w.dienste_json && Array.isArray(w.dienste_json) && w.dienste_json.length > 0) {
          states[d] = "verfuegbar";
          details[d] = {
            dienste: w.dienste_json.map((entry) => ({
              typ: entry.typ,
              zeit: { von: entry.zeit_von, bis: entry.zeit_bis },
            })),
          };
        } else if (w.verfuegbar_fuer && w.verfuegbar_fuer.length > 0) {
          states[d] = "verfuegbar";
          details[d] = {
            dienste: w.verfuegbar_fuer
              .filter((t) => t !== "alle")
              .map((typ) => ({
                typ: typ as SchichtTyp,
                zeit: {
                  von: w.zeit_von || DEFAULT_ZEITEN[typ as SchichtTyp]?.von || "07:00",
                  bis: w.zeit_bis || DEFAULT_ZEITEN[typ as SchichtTyp]?.bis || "19:00",
                },
              })),
          };
        }
        if (w.ziel_dienste_min !== undefined && w.ziel_dienste_min !== null) dMin = w.ziel_dienste_min;
        else if (w.ziel_dienste) dMin = Math.max(1, w.ziel_dienste - 2);
        if (w.ziel_dienste_max !== undefined && w.ziel_dienste_max !== null) dMax = w.ziel_dienste_max;
        else if (w.ziel_dienste) dMax = w.ziel_dienste;
        if (w.ziel_anmeldungen) anmeldungen = w.ziel_anmeldungen;
      }

      const daysInM = getDaysInMonth(year, month);
      setDayStates(applyFixSettings(states, daysInM));
      setDayDetails(details);
      setZielDiensteMin(dMin);
      setZielDiensteMax(dMax);
      setZielAnmeldungen(anmeldungen);
    }).catch(() => {});
  }, [monatKey, user, year, month, applyFixSettings]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const wuensche: WunschBulkEintrag[] = [];
      const daysInM = getDaysInMonth(year, month);

      for (let d = 1; d <= daysInM; d++) {
        const status = dayStates[d];
        if (!status || status === "leer") continue;

        const datum = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")} 00:00:00.000Z`;
        const detail = dayDetails[d];

        if (status === "verfuegbar") {
          const dienste = detail?.dienste || [];
          wuensche.push({
            datum,
            verfuegbar_fuer: dienste.length > 0 ? dienste.map((e) => e.typ) : ["alle"],
            frei_wunsch: null,
            ist_urlaub: false,
            dienste: dienste.map((d) => ({
              typ: d.typ,
              zeit_von: d.zeit.von,
              zeit_bis: d.zeit.bis,
            })),
          });
        } else if (status === "frei_schoen") {
          wuensche.push({
            datum,
            verfuegbar_fuer: [],
            frei_wunsch: "waere_schoen",
            ist_urlaub: false,
            dienste: [],
          });
        } else if (status === "frei_wichtig") {
          wuensche.push({
            datum,
            verfuegbar_fuer: [],
            frei_wunsch: "wichtig",
            ist_urlaub: false,
            dienste: [],
          });
        } else if (status === "urlaub") {
          wuensche.push({
            datum,
            verfuegbar_fuer: [],
            frei_wunsch: null,
            ist_urlaub: true,
            dienste: [],
          });
        }
      }

      await saveWuenscheBulk(user.id, monatKey, wuensche, zielDiensteMin, zielDiensteMax, zielAnmeldungen);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  };

  const prevMonth = () => {
    cancelSheetTimer();
    setSheetDay(null);
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    cancelSheetTimer();
    setSheetDay(null);
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const [teamStatus, setTeamStatus] = useState<Record<number, TeamDayStatus>>({});
  const [teamCoverage, setTeamCoverage] = useState<Record<number, TeamShiftCoverage>>({});

  useEffect(() => {
    if (!user) return;
    getWuensche(monatKey).then((allWuensche) => {
      const status: Record<number, TeamDayStatus> = {};
      const coverage: Record<number, TeamShiftCoverage> = {};

      for (const w of allWuensche) {
        if (w.hebamme === user.id) continue;
        const d = new Date(w.datum).getDate();
        if (!status[d]) status[d] = { verfuegbar: 0, freiWunsch: 0, nichtVerfuegbar: 0 };

        if (w.ist_urlaub || w.frei_wunsch === "wichtig") {
          status[d].nichtVerfuegbar++;
        } else if (w.frei_wunsch === "waere_schoen") {
          status[d].freiWunsch++;
        } else if ((w.dienste_json && w.dienste_json.length > 0) || (w.verfuegbar_fuer && w.verfuegbar_fuer.length > 0)) {
          status[d].verfuegbar++;
          const member = teamMembers.find((m) => m.id === w.hebamme);
          if (member) {
            if (!coverage[d]) coverage[d] = {};
            const dienste = w.dienste_json && w.dienste_json.length > 0
              ? w.dienste_json
              : (w.verfuegbar_fuer || [])
                  .filter((t) => t !== "alle")
                  .map((t) => ({
                    typ: t as SchichtTyp,
                    zeit_von: w.zeit_von || DEFAULT_ZEITEN[t as SchichtTyp]?.von || "07:00",
                    zeit_bis: w.zeit_bis || DEFAULT_ZEITEN[t as SchichtTyp]?.bis || "19:00",
                  }));
            for (const dn of dienste) {
              const key = dn.typ;
              if (!coverage[d][key]) coverage[d][key] = [];
              coverage[d][key]!.push({
                von: dn.zeit_von,
                bis: dn.zeit_bis,
                name: member.vorname,
              });
            }
          }
        }
      }

      setTeamStatus(status);
      setTeamCoverage(coverage);
    }).catch(() => {
      setTeamStatus({});
      setTeamCoverage({});
    });
  }, [monatKey, user, teamMembers]);

  const cancelSheetTimer = useCallback(() => {
    if (sheetTimerRef.current) { clearTimeout(sheetTimerRef.current); sheetTimerRef.current = null; }
  }, []);

  useEffect(() => { return () => cancelSheetTimer(); }, [cancelSheetTimer]);

  useEffect(() => {
    if (sheetDay !== null) {
      document.body.style.overflow = "hidden";
      const existing = dayDetails[sheetDay]?.dienste ?? [];
      const dayCoverage = teamCoverage[sheetDay] ?? {};
      const zeiten: Record<string, ZeitFenster> = {};
      for (const opt of DIENST_OPTIONEN) {
        const found = existing.find((d) => d.typ === opt.value);
        zeiten[opt.value] = found
          ? { ...found.zeit }
          : getSmartDefault(opt.value, dayCoverage[opt.value]);
      }
      setSheetZeiten(zeiten);
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetDay]);

  const tapDay = (day: number) => {
    cancelSheetTimer();
    const current = dayStates[day] || "leer";
    const currentIndex = STATUS_CYCLE.indexOf(current);
    const next = STATUS_CYCLE[(currentIndex + 1) % STATUS_CYCLE.length];
    setDayStates((prev) => ({ ...prev, [day]: next }));
    if (current === "verfuegbar") {
      setDayDetails((prev) => { const copy = { ...prev }; delete copy[day]; return copy; });
    }
    if (next === "verfuegbar") {
      sheetTimerRef.current = setTimeout(() => setSheetDay(day), SHEET_DELAY);
    }
  };

  const confirmDienst = (day: number, typ: SchichtTyp) => {
    const zeit = sheetZeiten[typ] ?? DEFAULT_ZEITEN[typ];
    setDayDetails((prev) => {
      const existing = prev[day] || { dienste: [] };
      const has = existing.dienste.find((d) => d.typ === typ);
      if (has) {
        return { ...prev, [day]: { dienste: existing.dienste.filter((d) => d.typ !== typ) } };
      }
      return { ...prev, [day]: { dienste: [...existing.dienste, { typ, zeit }] } };
    });
  };

  const applyPreset = (day: number, types: SchichtTyp[]) => {
    const filtered = types.filter((t) => {
      if (t === "anmeldung" && !isAnmeldungTag(day)) return false;
      return true;
    });
    setDayDetails((prev) => ({
      ...prev,
      [day]: {
        dienste: filtered.map((typ) => {
          const userBd24 = user?.settings?.bd_24h && (typ === "bd_tag" || typ === "bd_nacht");
          const z = sheetZeiten[typ] ?? DEFAULT_ZEITEN[typ];
          return {
            typ,
            zeit: userBd24
              ? { von: typ === "bd_tag" ? "07:00" : "19:00", bis: typ === "bd_tag" ? "19:00" : "07:00" }
              : z,
          };
        }),
      },
    }));
  };

  const updateSheetZeit = (typ: string, field: "von" | "bis", value: string) => {
    setSheetZeiten((prev) => ({ ...prev, [typ]: { ...prev[typ], [field]: value } }));
  };

  const dayOfWeekForDate = (day: number) => new Date(year, month, day).getDay();
  const isWeekend = (day: number) => { const d = dayOfWeekForDate(day); return d === 0 || d === 6; };
  const isAnmeldungTag = (day: number) => {
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (holidayByDay[dateKey]?.kind === "feiertag") return false;
    const d = dayOfWeekForDate(day);
    return d === 2 || d === 5;
  };

  const getDayInfo = (day: number) => {
    const details = dayDetails[day];
    if (!details || details.dienste.length === 0) return null;
    return details.dienste.map((d) => {
      const opt = DIENST_OPTIONEN.find((o) => o.value === d.typ);
      return opt ? { ...opt, zeit: d.zeit } : null;
    }).filter(Boolean) as (typeof DIENST_OPTIONEN[number] & { zeit: ZeitFenster })[];
  };

  const stats = {
    verfuegbar: Object.values(dayStates).filter((s) => s === "verfuegbar").length,
    schoen: Object.values(dayStates).filter((s) => s === "frei_schoen").length,
    wichtig: Object.values(dayStates).filter((s) => s === "frei_wichtig").length,
    urlaub: Object.values(dayStates).filter((s) => s === "urlaub").length,
    offen: daysInMonth - Object.values(dayStates).filter((s) => s !== "leer").length,
  };

  return (
    <AuthGuard>
    <div className="flex flex-col h-[100dvh] overflow-hidden">
      <NavBar />

      <div className="shrink-0 mx-auto w-full max-w-2xl px-4 pt-3 pb-2 sm:px-6">
        <div className="flex items-center">
          <button onClick={prevMonth} className="flex-1 flex items-center justify-start gap-1 py-3 text-white/30 hover:text-white/50 active:scale-95 transition-all">
            <ChevronLeft className="h-5 w-5" />
            <span className="text-sm font-medium">{MONATE[month === 0 ? 11 : month - 1]}</span>
          </button>
          <div className="px-4">
            <h2 className="text-xl font-bold text-white whitespace-nowrap">{MONATE[month]}</h2>
            <p className="text-[11px] text-white/30 text-center">{year}</p>
          </div>
          <button onClick={nextMonth} className="flex-1 flex items-center justify-end gap-1 py-3 text-white/30 hover:text-white/50 active:scale-95 transition-all">
            <span className="text-sm font-medium">{MONATE[month === 11 ? 0 : month + 1]}</span>
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto scroll-smooth overscroll-contain"
        style={{
          maskImage: "linear-gradient(to bottom, transparent 0%, black 4%, black 88%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 4%, black 88%, transparent 100%)",
        }}
      >
        <div className="mx-auto w-full max-w-2xl px-4 sm:px-6">

        {showHelp && (
          <GlassCard className="mb-4 mt-2 p-4 relative">
            <button onClick={() => setShowHelp(false)} className="absolute top-3 right-3 text-white/30 hover:text-white/60"><X className="h-4 w-4" /></button>
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-white mb-2">Tippe einen Tag mehrfach an:</p>
                <div className="space-y-1.5">
                  {(["verfuegbar", "frei_schoen", "frei_wichtig", "urlaub"] as DayStatus[]).map((s, i) => (
                    <div key={s} className="flex items-center gap-3">
                      <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm", STATUS_CONFIG[s].bg, STATUS_CONFIG[s].ring)}>{STATUS_CONFIG[s].emoji}</div>
                      <span className="text-xs text-white/65"><strong className={STATUS_CONFIG[s].textClr}>{i + 1}x</strong> = {STATUS_CONFIG[s].label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </GlassCard>
        )}

        <GlassCard className="mb-4">
          <div className="grid grid-cols-7 gap-1.5 mb-2">
            {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
              <div key={d} className={cn("text-center text-sm font-semibold py-2", d === "Sa" || d === "So" ? "text-white/25" : "text-white/50")}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} className="aspect-square" />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const status = dayStates[day] || "leer";
              const config = STATUS_CONFIG[status];
              const weekend = isWeekend(day);
              const info = getDayInfo(day);
              const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const holiday = holidayByDay[dateKey];
              const isHoliday = holiday?.kind === "feiertag";
              const isFerien = holiday?.kind === "ferien";

              return (
                <button
                  key={day}
                  onClick={() => tapDay(day)}
                  title={holiday ? holiday.name : undefined}
                  className={cn(
                    "aspect-square rounded-2xl font-semibold transition-all duration-200 relative flex flex-col items-center justify-center select-none active:scale-95",
                    weekend && status === "leer" ? "text-white/25" : status === "leer" ? "text-white/60 hover:bg-white/5" : "text-white",
                    // Holiday/ferien tint: only visible when no explicit user status
                    status === "leer" && isHoliday && "bg-amber-400/15 ring-1 ring-amber-300/35",
                    status === "leer" && isFerien && "bg-emerald-400/12 ring-1 ring-emerald-300/25",
                    // Status-color overrides
                    config.bg, config.ring
                  )}
                >
                  <span className="text-[15px] leading-none">{day}</span>

                  {info && info.length > 0 ? (
                    <div className="flex flex-col items-center gap-0 mt-0.5">
                      {info.slice(0, 2).map((d) => {
                        const Icon = d.icon;
                        return (
                          <div key={d.value} className="flex items-center gap-0.5">
                            <Icon className={cn("h-2 w-2", d.farbe)} />
                            <span className="text-[8px] leading-none text-white/50">
                              {kurzZeit(d.zeit.von)}-{kurzZeit(d.zeit.bis)}
                            </span>
                          </div>
                        );
                      })}
                      {info.length > 2 && (<span className="text-[8px] text-white/30">+{info.length - 2}</span>)}
                    </div>
                  ) : config.emoji ? (
                    <span className="text-[11px] leading-none mt-0.5 opacity-80">{config.emoji}</span>
                  ) : null}

                  {teamStatus[day] && (
                    <div className="absolute top-[5px] right-[5px] flex gap-[2px]">
                      {teamStatus[day].verfuegbar > 0 && (<div className="h-[6px] w-[6px] rounded-full bg-emerald-400" />)}
                      {teamStatus[day].freiWunsch > 0 && (<div className="h-[6px] w-[6px] rounded-full bg-amber-400" />)}
                      {teamStatus[day].nichtVerfuegbar > 0 && (<div className="h-[6px] w-[6px] rounded-full bg-red-400" />)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-5 pt-4 border-t border-white/5 space-y-3">
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
              {(["verfuegbar", "frei_schoen", "frei_wichtig", "urlaub"] as DayStatus[]).map((s) => (
                <div key={s} className="flex items-center gap-1.5 text-xs text-white/40">
                  <div className={cn("h-3 w-3 rounded", STATUS_CONFIG[s].bg, STATUS_CONFIG[s].ring)} />
                  {STATUS_CONFIG[s].label}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-1 text-[11px] text-white/30">
              <span>Punkte = Team:</span>
              <div className="h-[6px] w-[6px] rounded-full bg-emerald-400" /><span>kann</span>
              <div className="h-[6px] w-[6px] rounded-full bg-amber-400 ml-1" /><span>schön frei</span>
              <div className="h-[6px] w-[6px] rounded-full bg-red-400 ml-1" /><span>kann nicht</span>
            </div>
            <div className="flex items-center justify-center gap-3 text-[11px] text-white/30">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-emerald-400/12 ring-1 ring-emerald-300/25" />
                <span>Schulferien</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-amber-400/15 ring-1 ring-amber-300/35" />
                <span>Feiertag</span>
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="mb-6">
          <h3 className="text-base font-semibold text-white mb-1">Wie viele Dienste möchtest du?</h3>
          <p className="text-xs text-white/40 mb-4">Solver versucht erst das Minimum für alle, geht dann Richtung Maximum, bevor andere erzwungen werden.</p>
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-medium text-white/80">Bevorzugt (Min)</p><p className="text-xs text-white/40">Möchte mindestens so viele</p></div>
              <div className="flex items-center gap-3">
                <button onClick={() => setZielDiensteMin(Math.max(1, zielDiensteMin - 1))} className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-white/60 hover:bg-white/10 transition-glass active:scale-95"><Minus className="h-5 w-5" /></button>
                <span className="text-2xl font-bold text-emerald-300 w-8 text-center">{zielDiensteMin}</span>
                <button onClick={() => setZielDiensteMin(Math.min(zielDiensteMax, zielDiensteMin + 1))} className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-white/60 hover:bg-white/10 transition-glass active:scale-95"><Plus className="h-5 w-5" /></button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-medium text-white/80">Maximum</p><p className="text-xs text-white/40">Mehr nur, wenn unbedingt nötig</p></div>
              <div className="flex items-center gap-3">
                <button onClick={() => setZielDiensteMax(Math.max(zielDiensteMin, zielDiensteMax - 1))} className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-white/60 hover:bg-white/10 transition-glass active:scale-95"><Minus className="h-5 w-5" /></button>
                <span className="text-2xl font-bold text-white w-8 text-center">{zielDiensteMax}</span>
                <button onClick={() => setZielDiensteMax(Math.min(20, zielDiensteMax + 1))} className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-white/60 hover:bg-white/10 transition-glass active:scale-95"><Plus className="h-5 w-5" /></button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-medium text-white/80">Anmeldungen</p><p className="text-xs text-white/40">Mindestens 1 pro Monat</p></div>
              <div className="flex items-center gap-3">
                <button onClick={() => setZielAnmeldungen(Math.max(0, zielAnmeldungen - 1))} className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-white/60 hover:bg-white/10 transition-glass active:scale-95"><Minus className="h-5 w-5" /></button>
                <span className="text-2xl font-bold text-white w-8 text-center">{zielAnmeldungen}</span>
                <button onClick={() => setZielAnmeldungen(Math.min(5, zielAnmeldungen + 1))} className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-white/60 hover:bg-white/10 transition-glass active:scale-95"><Plus className="h-5 w-5" /></button>
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="mb-6 p-4">
          <div className="grid grid-cols-5 gap-2 text-center">
            <div><p className="text-lg font-bold text-emerald-400">{stats.verfuegbar}</p><p className="text-[10px] text-white/40 mt-0.5">Verfügbar</p></div>
            <div><p className="text-lg font-bold text-amber-400">{stats.schoen}</p><p className="text-[10px] text-white/40 mt-0.5">Schön frei</p></div>
            <div><p className="text-lg font-bold text-orange-400">{stats.wichtig}</p><p className="text-[10px] text-white/40 mt-0.5">Wichtig frei</p></div>
            <div><p className="text-lg font-bold text-blue-400">{stats.urlaub}</p><p className="text-[10px] text-white/40 mt-0.5">Urlaub</p></div>
            <div><p className="text-lg font-bold text-white/30">{stats.offen}</p><p className="text-[10px] text-white/40 mt-0.5">Offen</p></div>
          </div>
        </GlassCard>

        <button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            "w-full flex items-center justify-center gap-3 rounded-2xl py-5 text-lg font-bold text-white transition-all active:scale-[0.98]",
            saved ? "bg-emerald-500/20 ring-1 ring-emerald-400/30" : "bg-gradient-to-r from-primary to-accent hover:opacity-90 glow"
          )}
        >
          {saving ? (
            <><div className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Wird gespeichert...</>
          ) : saved ? (
            <><Check className="h-5 w-5 text-emerald-400" /> Gespeichert!</>
          ) : (
            <><Save className="h-5 w-5" /> Wunschplan abschicken</>
          )}
        </button>
        <p className="text-center text-xs text-white/30 mt-3 mb-8">Du kannst deinen Plan jederzeit ändern, solange die Frist nicht abgelaufen ist.</p>

        </div>
      </div>

      {sheetDay !== null && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setSheetDay(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg animate-in slide-in-from-bottom duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="glass-strong rounded-t-3xl px-6 pt-4 pb-8 border-t border-white/15 max-h-[88vh] overflow-y-auto">
              <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20" />

              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-bold text-white">
                  {WOCHENTAGE_LANG[dayOfWeekForDate(sheetDay)]}, {sheetDay}. {MONATE[month]}
                </h3>
                <button onClick={() => setSheetDay(null)} className="rounded-xl p-2 text-white/40 hover:text-white hover:bg-white/10 transition-glass">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-sm text-white/40 mb-4">
                Wähle einen Schnell-Bausatz oder einzelne Dienste.
              </p>

              {/* Quick Presets */}
              <div className="mb-5 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => applyPreset(sheetDay, p.dienste)}
                    className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary/15 hover:bg-primary/25 ring-1 ring-primary/25 px-3 py-1.5 text-xs font-medium text-white/85 transition-all active:scale-95"
                  >
                    <Sparkles className="h-3 w-3" />
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {DIENST_OPTIONEN.map((opt) => {
                  if (opt.value === "anmeldung" && !isAnmeldungTag(sheetDay)) return null;

                  const alreadySelected = dayDetails[sheetDay]?.dienste?.some((d) => d.typ === opt.value) ?? false;
                  const Icon = opt.icon;
                  const zeit = sheetZeiten[opt.value] ?? DEFAULT_ZEITEN[opt.value];
                  const coverage = teamCoverage[sheetDay]?.[opt.value] ?? [];

                  return (
                    <div
                      key={opt.value}
                      className={cn(
                        "rounded-2xl overflow-hidden transition-all",
                        alreadySelected ? cn(opt.farbeBg, "ring-1") : "bg-white/[0.03]"
                      )}
                    >
                      {coverage.length > 0 && (
                        <div className="px-4 pt-3 pb-1">
                          {coverage.map((c, i) => (
                            <p key={i} className="text-xs text-white/40">
                              <span className="text-white/60">{c.name}</span> {c.von}–{c.bis} Uhr
                            </p>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
                        <div className="flex-1 flex items-center gap-2">
                          <select
                            value={zeit.von}
                            onChange={(e) => updateSheetZeit(opt.value, "von", e.target.value)}
                            className="w-full rounded-lg bg-white/10 border-0 px-2 py-2 text-sm text-white font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50 text-center"
                          >
                            {ZEIT_OPTIONEN.map((z) => (
                              <option key={z} value={z} className="bg-gray-900 text-white">{z}</option>
                            ))}
                          </select>
                          <span className="text-white/20 text-sm shrink-0">bis</span>
                          <select
                            value={zeit.bis}
                            onChange={(e) => updateSheetZeit(opt.value, "bis", e.target.value)}
                            className="w-full rounded-lg bg-white/10 border-0 px-2 py-2 text-sm text-white font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50 text-center"
                          >
                            {ZEIT_OPTIONEN.map((z) => (
                              <option key={z} value={z} className="bg-gray-900 text-white">{z}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <button
                        onClick={() => confirmDienst(sheetDay, opt.value)}
                        className="flex w-full items-center gap-4 px-4 pb-4 pt-2 transition-all duration-200 active:scale-[0.98]"
                      >
                        <div className={cn(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                          alreadySelected ? "bg-white/15" : "bg-white/5"
                        )}>
                          <Icon className={cn("h-5 w-5", alreadySelected ? opt.farbe : "text-white/40")} />
                        </div>
                        <div className="flex-1 text-left">
                          <p className={cn("text-base font-semibold", alreadySelected ? "text-white" : "text-white/70")}>
                            {opt.label}
                          </p>
                          <p className="text-xs text-white/30">
                            {alreadySelected ? "Nochmal tippen zum Abwählen" : "Tippen zum Auswählen"}
                          </p>
                        </div>
                        {alreadySelected && (<Check className={cn("h-5 w-5 shrink-0", opt.farbe)} />)}
                      </button>
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-white/30 text-center mt-5">
                Erst Uhrzeit einstellen, dann Dienst antippen
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
    </AuthGuard>
  );
}
