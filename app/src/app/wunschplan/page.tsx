"use client";

import { AuthGuard } from "@/components/auth-guard";
import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { NavBar } from "@/components/ui/nav-bar";
import { GlassCard } from "@/components/ui/glass-card";
import { type VerfuegbarFuer } from "@/lib/types";
import { getWuensche, saveWuenscheBulk, getTeam } from "@/lib/api";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

type DayStatus = "leer" | "verfuegbar" | "frei_wunsch" | "nicht_verfuegbar";

type ZeitFenster = { von: string; bis: string };

type DienstEintrag = {
  typ: VerfuegbarFuer;
  zeit: ZeitFenster;
};

type DayDetail = {
  dienste: DienstEintrag[];
};

const STATUS_CYCLE: DayStatus[] = [
  "leer", "verfuegbar", "frei_wunsch", "nicht_verfuegbar",
];

const STATUS_CONFIG: Record<
  DayStatus,
  { bg: string; ring: string; emoji: string; label: string }
> = {
  leer: { bg: "", ring: "", emoji: "", label: "Nicht ausgefullt" },
  verfuegbar: { bg: "bg-emerald-500/25", ring: "ring-1 ring-emerald-400/40", emoji: "✓", label: "Kann arbeiten" },
  frei_wunsch: { bg: "bg-amber-500/25", ring: "ring-1 ring-amber-400/40", emoji: "♡", label: "Lieber frei" },
  nicht_verfuegbar: { bg: "bg-red-500/20", ring: "ring-1 ring-red-400/30", emoji: "✕", label: "Kann nicht" },
};

const DEFAULT_ZEITEN: Record<string, ZeitFenster> = {
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
  value: VerfuegbarFuer;
  label: string;
  icon: typeof Sun;
  farbe: string;
  farbeBg: string;
  farbeActive: string;
}[] = [
  { value: "tagdienst", label: "Tagdienst", icon: Sun, farbe: "text-amber-300", farbeBg: "bg-amber-500/15 ring-amber-400/30", farbeActive: "bg-amber-500/25" },
  { value: "nachtdienst", label: "Nachtdienst", icon: Moon, farbe: "text-indigo-300", farbeBg: "bg-indigo-500/15 ring-indigo-400/30", farbeActive: "bg-indigo-500/25" },
  { value: "bd_tag", label: "BD Tag", icon: Clock, farbe: "text-sky-300", farbeBg: "bg-sky-500/15 ring-sky-400/30", farbeActive: "bg-sky-500/25" },
  { value: "bd_nacht", label: "BD Nacht", icon: Clock, farbe: "text-blue-300", farbeBg: "bg-blue-500/15 ring-blue-400/30", farbeActive: "bg-blue-500/25" },
  { value: "anmeldung", label: "Anmeldung", icon: FileText, farbe: "text-emerald-300", farbeBg: "bg-emerald-500/15 ring-emerald-400/30", farbeActive: "bg-emerald-500/25" },
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

const MONATE = [
  "Januar", "Februar", "Marz", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];
const WOCHENTAGE_LANG = [
  "Sonntag", "Montag", "Dienstag", "Mittwoch",
  "Donnerstag", "Freitag", "Samstag",
];

const SHEET_DELAY = 1500;

// Format "07:00" → "7" and "19:00" → "19", "07:30" → "7:30"
function kurzZeit(z: string) {
  const [h, m] = z.split(":");
  const hNum = parseInt(h, 10);
  return m === "00" ? `${hNum}` : `${hNum}:${m}`;
}

// Team status per day – counts + existing coverage per shift type
// In production this comes from PocketBase
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

type TeamShiftCoverage = Partial<Record<VerfuegbarFuer, TeamCoverage[]>>;


// Calculate smart default time based on existing coverage
function getSmartDefault(typ: VerfuegbarFuer, coverage?: TeamCoverage[]): ZeitFenster {
  const base = DEFAULT_ZEITEN[typ];
  if (!coverage || coverage.length === 0) return { ...base };

  // Find the last covered "bis" time and use it as new "von"
  const lastBis = coverage.reduce((latest, c) => {
    return c.bis > latest ? c.bis : latest;
  }, "00:00");

  // If the shift is already fully covered, still return base
  if (lastBis >= base.bis && base.von < base.bis) return { ...base };

  return { von: lastBis, bis: base.bis };
}

export default function WunschplanPage() {
  const { user } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1 > 11 ? 0 : now.getMonth() + 1); // next month default
  const [dayStates, setDayStates] = useState<Record<number, DayStatus>>({});
  const [dayDetails, setDayDetails] = useState<Record<number, DayDetail>>({});
  const [sheetDay, setSheetDay] = useState<number | null>(null);
  const [sheetZeiten, setSheetZeiten] = useState<Record<string, ZeitFenster>>({});
  const [zielDienste, setZielDienste] = useState(8);
  const [zielAnmeldungen, setZielAnmeldungen] = useState(1);
  const [showHelp, setShowHelp] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [teamMembers, setTeamMembers] = useState<Hebamme[]>([]);

  const sheetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const monatKey = `${year}-${String(month + 1).padStart(2, "0")}`;

  // Load team members
  useEffect(() => {
    getTeam().then(setTeamMembers).catch(() => {});
  }, []);

  // Load existing wishes when month changes
  useEffect(() => {
    if (!user) return;
    setSaved(false);
    getWuensche(monatKey, user.id).then((wuensche) => {
      const states: Record<number, DayStatus> = {};
      const details: Record<number, DayDetail> = {};
      let dienste = 8;
      let anmeldungen = 1;

      for (const w of wuensche) {
        const d = new Date(w.datum).getDate();
        if (w.ist_urlaub) {
          states[d] = "nicht_verfuegbar";
        } else if (w.frei_wunsch === "wichtig") {
          states[d] = "nicht_verfuegbar";
        } else if (w.frei_wunsch === "waere_schoen") {
          states[d] = "frei_wunsch";
        } else if (w.verfuegbar_fuer && w.verfuegbar_fuer.length > 0) {
          states[d] = "verfuegbar";
          details[d] = {
            dienste: w.verfuegbar_fuer.map((typ) => ({
              typ: typ as VerfuegbarFuer,
              zeit: {
                von: w.zeit_von || DEFAULT_ZEITEN[typ]?.von || "07:00",
                bis: w.zeit_bis || DEFAULT_ZEITEN[typ]?.bis || "19:00",
              },
            })),
          };
        }
        if (w.ziel_dienste) dienste = w.ziel_dienste;
        if (w.ziel_anmeldungen) anmeldungen = w.ziel_anmeldungen;
      }

      setDayStates(states);
      setDayDetails(details);
      setZielDienste(dienste);
      setZielAnmeldungen(anmeldungen);
    }).catch(() => {});
  }, [monatKey, user]);

  // Save handler
  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const wuensche: Parameters<typeof saveWuenscheBulk>[2] = [];
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
            zeit_von: dienste[0]?.zeit?.von || "",
            zeit_bis: dienste[0]?.zeit?.bis || "",
          });
        } else if (status === "frei_wunsch") {
          wuensche.push({
            datum,
            verfuegbar_fuer: [],
            frei_wunsch: "waere_schoen",
            ist_urlaub: false,
          });
        } else if (status === "nicht_verfuegbar") {
          wuensche.push({
            datum,
            verfuegbar_fuer: [],
            frei_wunsch: "wichtig",
            ist_urlaub: true,
          });
        }
      }

      await saveWuenscheBulk(user.id, monatKey, wuensche, zielDienste, zielAnmeldungen);
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

  // Team data from other members
  const [teamStatus, setTeamStatus] = useState<Record<number, TeamDayStatus>>({});
  const [teamCoverage, setTeamCoverage] = useState<Record<number, TeamShiftCoverage>>({});

  useEffect(() => {
    if (!user) return;
    // Load all wishes for this month (from all team members)
    getWuensche(monatKey).then((allWuensche) => {
      const status: Record<number, TeamDayStatus> = {};
      const coverage: Record<number, TeamShiftCoverage> = {};

      for (const w of allWuensche) {
        if (w.hebamme === user.id) continue; // skip own wishes
        const d = new Date(w.datum).getDate();
        if (!status[d]) status[d] = { verfuegbar: 0, freiWunsch: 0, nichtVerfuegbar: 0 };

        if (w.ist_urlaub || w.frei_wunsch === "wichtig") {
          status[d].nichtVerfuegbar++;
        } else if (w.frei_wunsch === "waere_schoen") {
          status[d].freiWunsch++;
        } else if (w.verfuegbar_fuer && w.verfuegbar_fuer.length > 0) {
          status[d].verfuegbar++;
          // Build coverage
          const member = teamMembers.find((m) => m.id === w.hebamme);
          if (member) {
            if (!coverage[d]) coverage[d] = {};
            for (const typ of w.verfuegbar_fuer) {
              const key = typ as VerfuegbarFuer;
              if (!coverage[d][key]) coverage[d][key] = [];
              coverage[d][key]!.push({
                von: w.zeit_von || DEFAULT_ZEITEN[typ]?.von || "07:00",
                bis: w.zeit_bis || DEFAULT_ZEITEN[typ]?.bis || "19:00",
                name: member.vorname,
              });
            }
          }
        }
      }

      setTeamStatus(status);
      setTeamCoverage(coverage);
    }).catch(() => {
      // Fallback: empty
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
      // Initialize sheet times: use existing selection, or smart defaults based on coverage
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

  // Confirm a dienst selection: save it with the current sheet times and close
  const confirmDienst = (day: number, typ: VerfuegbarFuer) => {
    const zeit = sheetZeiten[typ] ?? DEFAULT_ZEITEN[typ];
    setDayDetails((prev) => {
      const existing = prev[day] || { dienste: [] };
      const has = existing.dienste.find((d) => d.typ === typ);
      if (has) {
        // Deselect
        return { ...prev, [day]: { dienste: existing.dienste.filter((d) => d.typ !== typ) } };
      }
      // Add
      return { ...prev, [day]: { dienste: [...existing.dienste, { typ, zeit }] } };
    });
    setSheetDay(null);
  };

  const updateSheetZeit = (typ: string, field: "von" | "bis", value: string) => {
    setSheetZeiten((prev) => ({
      ...prev,
      [typ]: { ...prev[typ], [field]: value },
    }));
  };

  const dayOfWeekForDate = (day: number) => new Date(year, month, day).getDay();
  const isWeekend = (day: number) => { const d = dayOfWeekForDate(day); return d === 0 || d === 6; };
  const isAnmeldungTag = (day: number) => { const d = dayOfWeekForDate(day); return d === 2 || d === 5; };


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
    frei: Object.values(dayStates).filter((s) => s === "frei_wunsch").length,
    nicht: Object.values(dayStates).filter((s) => s === "nicht_verfuegbar").length,
    offen: daysInMonth - Object.values(dayStates).filter((s) => s !== "leer").length,
  };

  return (
    <AuthGuard>
    <div className="flex flex-col h-[100dvh] overflow-hidden">
      <NavBar />

      {/* Sticky header: month picker */}
      <div className="shrink-0 mx-auto w-full max-w-2xl px-4 pt-3 pb-2 sm:px-6">
        <div className="flex items-center">
          <button
            onClick={prevMonth}
            className="flex-1 flex items-center justify-start gap-1 py-3 text-white/30 hover:text-white/50 active:scale-95 transition-all"
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="text-sm font-medium">{MONATE[month === 0 ? 11 : month - 1]}</span>
          </button>
          <div className="px-4">
            <h2 className="text-xl font-bold text-white whitespace-nowrap">{MONATE[month]}</h2>
            <p className="text-[11px] text-white/30 text-center">{year}</p>
          </div>
          <button
            onClick={nextMonth}
            className="flex-1 flex items-center justify-end gap-1 py-3 text-white/30 hover:text-white/50 active:scale-95 transition-all"
          >
            <span className="text-sm font-medium">{MONATE[month === 11 ? 0 : month + 1]}</span>
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Scrollable content with fade */}
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
                <p className="text-sm font-semibold text-white mb-2">So funktioniert&apos;s:</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/25 ring-1 ring-emerald-400/40 text-sm">✓</div>
                    <span className="text-sm text-white/70"><strong className="text-emerald-300">1x</strong> = Kann arbeiten</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/25 ring-1 ring-amber-400/40 text-sm">♡</div>
                    <span className="text-sm text-white/70"><strong className="text-amber-300">2x</strong> = Lieber frei</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/20 ring-1 ring-red-400/30 text-sm">✕</div>
                    <span className="text-sm text-white/70"><strong className="text-red-300">3x</strong> = Kann nicht</span>
                  </div>
                </div>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Calendar */}
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

              return (
                <button
                  key={day}
                  onClick={() => tapDay(day)}
                  className={cn(
                    "aspect-square rounded-2xl font-semibold transition-all duration-200 relative flex flex-col items-center justify-center select-none active:scale-95",
                    weekend && status === "leer" ? "text-white/25" : status === "leer" ? "text-white/60 hover:bg-white/5" : "text-white",
                    config.bg, config.ring
                  )}
                >
                  <span className="text-[15px] leading-none">{day}</span>

                  {/* Show dienst info with time */}
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
                      {info.length > 2 && (
                        <span className="text-[8px] text-white/30">+{info.length - 2}</span>
                      )}
                    </div>
                  ) : config.emoji ? (
                    <span className="text-[11px] leading-none mt-0.5 opacity-80">{config.emoji}</span>
                  ) : null}

                  {/* Team status dots */}
                  {teamStatus[day] && (
                    <div className="absolute top-[5px] right-[5px] flex gap-[2px]">
                      {teamStatus[day].verfuegbar > 0 && (
                        <div className="h-[6px] w-[6px] rounded-full bg-emerald-400" />
                      )}
                      {teamStatus[day].freiWunsch > 0 && (
                        <div className="h-[6px] w-[6px] rounded-full bg-amber-400" />
                      )}
                      {teamStatus[day].nichtVerfuegbar > 0 && (
                        <div className="h-[6px] w-[6px] rounded-full bg-red-400" />
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          {/* Legend */}
          <div className="mt-5 pt-4 border-t border-white/5 space-y-3">
            <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
              {(["verfuegbar", "frei_wunsch", "nicht_verfuegbar"] as DayStatus[]).map((s) => (
                <div key={s} className="flex items-center gap-1.5 text-xs text-white/40">
                  <div className={cn("h-3 w-3 rounded", STATUS_CONFIG[s].bg, STATUS_CONFIG[s].ring)} />
                  {STATUS_CONFIG[s].label}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-1 text-[11px] text-white/30">
              <span>Punkte = Team:</span>
              <div className="h-[6px] w-[6px] rounded-full bg-emerald-400" />
              <span>eingetragen</span>
              <div className="h-[6px] w-[6px] rounded-full bg-amber-400 ml-1" />
              <span>lieber frei</span>
              <div className="h-[6px] w-[6px] rounded-full bg-red-400 ml-1" />
              <span>kann nicht</span>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="mb-6">
          <h3 className="text-base font-semibold text-white mb-4">Wie viele Dienste mochtest du?</h3>
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-medium text-white/80">Dienste gesamt</p><p className="text-xs text-white/40">Schichten im Monat</p></div>
              <div className="flex items-center gap-3">
                <button onClick={() => setZielDienste(Math.max(1, zielDienste - 1))} className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-white/60 hover:bg-white/10 transition-glass active:scale-95"><Minus className="h-5 w-5" /></button>
                <span className="text-2xl font-bold text-white w-8 text-center">{zielDienste}</span>
                <button onClick={() => setZielDienste(Math.min(20, zielDienste + 1))} className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-white/60 hover:bg-white/10 transition-glass active:scale-95"><Plus className="h-5 w-5" /></button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-medium text-white/80">Anmeldungen</p><p className="text-xs text-white/40">Mindestens 1 pro Monat</p></div>
              <div className="flex items-center gap-3">
                <button onClick={() => setZielAnmeldungen(Math.max(1, zielAnmeldungen - 1))} className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-white/60 hover:bg-white/10 transition-glass active:scale-95"><Minus className="h-5 w-5" /></button>
                <span className="text-2xl font-bold text-white w-8 text-center">{zielAnmeldungen}</span>
                <button onClick={() => setZielAnmeldungen(Math.min(5, zielAnmeldungen + 1))} className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-white/60 hover:bg-white/10 transition-glass active:scale-95"><Plus className="h-5 w-5" /></button>
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="mb-6 p-4">
          <div className="grid grid-cols-4 gap-3 text-center">
            <div><p className="text-xl font-bold text-emerald-400">{stats.verfuegbar}</p><p className="text-[11px] text-white/40 mt-0.5">Verfugbar</p></div>
            <div><p className="text-xl font-bold text-amber-400">{stats.frei}</p><p className="text-[11px] text-white/40 mt-0.5">Lieber frei</p></div>
            <div><p className="text-xl font-bold text-red-400">{stats.nicht}</p><p className="text-[11px] text-white/40 mt-0.5">Kann nicht</p></div>
            <div><p className="text-xl font-bold text-white/30">{stats.offen}</p><p className="text-[11px] text-white/40 mt-0.5">Offen</p></div>
          </div>
        </GlassCard>

        <button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            "w-full flex items-center justify-center gap-3 rounded-2xl py-5 text-lg font-bold text-white transition-all active:scale-[0.98]",
            saved
              ? "bg-emerald-500/20 ring-1 ring-emerald-400/30"
              : "bg-gradient-to-r from-primary to-accent hover:opacity-90 glow"
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
        <p className="text-center text-xs text-white/30 mt-3 mb-8">Du kannst deinen Plan jederzeit andern, solange die Frist nicht abgelaufen ist.</p>

        </div>
      </div>

      {/* ===== BOTTOM SHEET ===== */}
      {sheetDay !== null && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setSheetDay(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg animate-in slide-in-from-bottom duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="glass-strong rounded-t-3xl px-6 pt-4 pb-8 border-t border-white/15 max-h-[85vh] overflow-y-auto">
              <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20" />

              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-bold text-white">
                  {WOCHENTAGE_LANG[dayOfWeekForDate(sheetDay)]}, {sheetDay}. {MONATE[month]}
                </h3>
                <button onClick={() => setSheetDay(null)} className="rounded-xl p-2 text-white/40 hover:text-white hover:bg-white/10 transition-glass">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-sm text-white/40 mb-6">
                Stelle die Uhrzeit ein und tippe auf den Dienst zum Bestatigen.
              </p>

              <div className="space-y-4">
                {DIENST_OPTIONEN.map((opt) => {
                  if (opt.value === "anmeldung" && !isAnmeldungTag(sheetDay)) return null;

                  const alreadySelected = dayDetails[sheetDay]?.dienste?.some((d) => d.typ === opt.value) ?? false;
                  const Icon = opt.icon;
                  const zeit = sheetZeiten[opt.value] ?? DEFAULT_ZEITEN[opt.value];
                  const coverage = teamCoverage[sheetDay]?.[opt.value] ?? [];
                  const defaultZeit = DEFAULT_ZEITEN[opt.value];
                  // Check if all coverage entries together span the full shift
                  // Handles overnight shifts (e.g. 19:00–07:00) by converting to minutes
                  const isFullyCovered = (() => {
                    if (coverage.length === 0) return false;
                    if (coverage.some((c) => c.von === defaultZeit.von && c.bis === defaultZeit.bis)) return true;
                    const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
                    const startMin = toMin(defaultZeit.von);
                    const endMin = toMin(defaultZeit.bis);
                    // Normalize: if end < start (overnight), add 24h to end
                    const normEnd = endMin <= startMin ? endMin + 1440 : endMin;
                    const totalNeeded = normEnd - startMin;
                    // Build coverage in normalized minutes
                    const ranges = coverage.map((c) => {
                      let cv = toMin(c.von);
                      let cb = toMin(c.bis);
                      if (cv < startMin) cv += 1440;
                      if (cb <= startMin) cb += 1440;
                      if (cb < cv) cb += 1440;
                      return { von: cv, bis: cb };
                    }).sort((a, b) => a.von - b.von);
                    let covered = startMin;
                    for (const r of ranges) {
                      if (r.von > covered) return false;
                      if (r.bis > covered) covered = r.bis;
                    }
                    return covered >= normEnd;
                  })();

                  return (
                    <div
                      key={opt.value}
                      className={cn(
                        "rounded-2xl overflow-hidden transition-all",
                        alreadySelected ? cn(opt.farbeBg, "ring-1") : "bg-white/[0.03]"
                      )}
                    >
                      {/* Coverage info */}
                      {coverage.length > 0 && (
                        <div className="px-4 pt-3 pb-1">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <div className="h-1 flex-1 rounded-full bg-white/5 overflow-hidden">
                              <div
                                className={cn("h-full rounded-full", isFullyCovered ? "bg-emerald-400/60" : "bg-amber-400/60")}
                                style={{ width: isFullyCovered ? "100%" : "50%" }}
                              />
                            </div>
                            <span className="text-[10px] text-white/30 shrink-0">
                              {isFullyCovered ? "Voll besetzt" : "Teilweise besetzt"}
                            </span>
                          </div>
                          {coverage.map((c, i) => (
                            <p key={i} className="text-xs text-white/40">
                              <span className="text-white/60">{c.name}</span> {c.von}–{c.bis} Uhr
                            </p>
                          ))}
                        </div>
                      )}

                      {/* Time selectors row */}
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

                      {/* Dienst button – tap to confirm */}
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
                            {alreadySelected ? "Nochmal tippen zum Abwahlen" : "Tippen zum Auswahlen"}
                          </p>
                        </div>
                        {alreadySelected && (
                          <Check className={cn("h-5 w-5 shrink-0", opt.farbe)} />
                        )}
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
