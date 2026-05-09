"use client";

import { AuthGuard } from "@/components/auth-guard";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { NavBar } from "@/components/ui/nav-bar";
import { GlassCard } from "@/components/ui/glass-card";
import { SCHICHT_LABELS, type SchichtTyp, type Hebamme } from "@/lib/types";
import { getTeam, getZuweisungen, getDienstplan, getFeiertage } from "@/lib/api";
import { getBayernHolidays, type HolidayMap } from "@/lib/holidays";
import {
  Eye,
  List,
  Sun,
  Moon,
  Clock,
  FileText,
  CalendarX,
  ChevronLeft,
  ChevronRight,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ShiftEntry = { name: string; von: string; bis: string; farbe: string };
type DayPlan = Record<string, ShiftEntry | undefined>;

const MONATE = [
  "Januar", "Februar", "Marz", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];
const WOCHENTAGE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const WOCHENTAGE_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

const SCHICHT_ICONS: Record<string, typeof Sun> = {
  tagdienst: Sun, tagdienst_2: Sun, nachtdienst: Moon,
  bd_tag: Clock, bd_nacht: Clock, anmeldung: FileText,
};
const SCHICHT_FARBEN_CARD: Record<string, string> = {
  tagdienst: "bg-amber-500/15 text-amber-300", tagdienst_2: "bg-amber-500/15 text-amber-300",
  nachtdienst: "bg-indigo-500/15 text-indigo-300",
  bd_tag: "bg-sky-500/15 text-sky-300", bd_nacht: "bg-blue-500/15 text-blue-300",
  anmeldung: "bg-emerald-500/15 text-emerald-300",
};
const SCHICHT_NAMEN: Record<string, string> = {
  tagdienst: "Tagdienst", tagdienst_2: "Tagdienst", nachtdienst: "Nachtdienst",
  bd_tag: "BD Tag", bd_nacht: "BD Nacht", anmeldung: "Anmeldung",
};

function kurz(z: string) {
  const [h, m] = z.split(":");
  return m === "00" ? `${parseInt(h)}` : `${parseInt(h)}:${m}`;
}

export default function DienstplanPage() {
  const { user } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monatKey = `${year}-${String(month + 1).padStart(2, "0")}`;

  const [planData, setPlanData] = useState<Record<number, DayPlan>>({});
  const [loading, setLoading] = useState(true);
  const [planStatus, setPlanStatus] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"mein" | "alle">("mein");
  const [holidayMap, setHolidayMap] = useState<HolidayMap>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getBayernHolidays(year)
      .then(async (bayern) => {
        const merged: HolidayMap = { ...bayern };
        try {
          const own = await getFeiertage(year);
          for (const f of own) {
            const key = f.datum.slice(0, 10);
            merged[key] = { name: f.name || (f.typ === "feiertag" ? "Feiertag" : "Ferien"), kind: f.typ };
          }
        } catch {}
        setHolidayMap(merged);
      })
      .catch(() => setHolidayMap({}));
  }, [year]);

  const today = now;
  const todayDay = today.getFullYear() === year && today.getMonth() === month ? today.getDate() : 1;

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };

  // Load plan from PocketBase
  useEffect(() => {
    setLoading(true);
    setPlanData({});
    setPlanStatus(null);

    Promise.all([getTeam(), getZuweisungen(monatKey), getDienstplan(monatKey)])
      .then(([team, zuweisungen, plan]) => {
        if (!plan) {
          setPlanStatus(null);
          setLoading(false);
          return;
        }

        setPlanStatus(plan.status);

        // Only show plan to hebammen if it's "freigegeben"
        if (plan.status !== "freigegeben" && user?.rolle !== "admin") {
          setLoading(false);
          return;
        }

        if (zuweisungen.length === 0) {
          setLoading(false);
          return;
        }

        const teamMap: Record<string, Hebamme> = {};
        for (const m of team) teamMap[m.id] = m;

        const data: Record<number, DayPlan> = {};
        for (const z of zuweisungen) {
          const slot = z.expand?.schicht_slot;
          const hebamme = z.expand?.hebamme;
          if (!slot || !hebamme) continue;
          const d = new Date(slot.datum).getDate();
          if (!data[d]) data[d] = {};
          const typ = slot.typ as string;
          const key = data[d][typ] ? `${typ}_2` : typ;
          const defaultVon = slot.typ === "nachtdienst" || slot.typ === "bd_nacht" ? "19:00" : slot.typ === "anmeldung" ? "09:00" : "07:00";
          const defaultBis = slot.typ === "nachtdienst" || slot.typ === "bd_nacht" ? "07:00" : slot.typ === "anmeldung" ? "14:00" : "19:00";
          data[d][key] = {
            name: hebamme.vorname,
            von: z.zeit_von || defaultVon,
            bis: z.zeit_bis || defaultBis,
            farbe: hebamme.farbe || "#666",
          };
        }
        setPlanData(data);
      })
      .catch(() => { setPlanStatus(null); })
      .finally(() => setLoading(false));
  }, [monatKey, user]);

  const hasData = Object.keys(planData).length > 0;

  const meineDienste = user
    ? Object.entries(planData)
        .filter(([, plan]) => Object.values(plan).some((e) => e?.name === user.vorname))
        .map(([day]) => Number(day))
        .sort((a, b) => a - b)
    : [];

  const scrollTarget = (() => {
    if (viewMode === "mein") {
      const next = meineDienste.find((d) => d >= todayDay);
      return next ?? meineDienste[meineDienste.length - 1] ?? todayDay;
    }
    return todayDay;
  })();

  useEffect(() => {
    if (loading || !hasData) return;
    setTimeout(() => {
      const el = document.getElementById(`day-${scrollTarget}`);
      if (el && scrollRef.current) {
        const container = scrollRef.current;
        const elTop = el.offsetTop - container.offsetTop;
        container.scrollTo({ top: Math.max(0, elTop - 20), behavior: "instant" });
      }
    }, 50);
  }, [viewMode, scrollTarget, loading, hasData]);

  // Build "meine dienste" calendar data
  const myShiftsMap: Record<number, { typ: string; icon: typeof Sun; farbe: string; von: string; bis: string }[]> = {};
  if (user) {
    for (const [dayStr, plan] of Object.entries(planData)) {
      const d = Number(dayStr);
      const shifts = Object.entries(plan)
        .filter(([, e]) => e?.name === user.vorname)
        .map(([typ, e]) => ({
          typ, icon: SCHICHT_ICONS[typ] || Sun,
          farbe: SCHICHT_FARBEN_CARD[typ] || "", von: e!.von, bis: e!.bis,
        }));
      if (shifts.length > 0) myShiftsMap[d] = shifts;
    }
  }

  const firstDow = new Date(year, month, 1).getDay();
  const firstDay = firstDow === 0 ? 6 : firstDow - 1;

  // Status message for non-published plans
  const renderEmpty = () => {
    if (planStatus === "generiert" && user?.rolle !== "admin") {
      return (
        <div className="flex-1 flex items-center justify-center px-8">
          <div className="text-center">
            <Lock className="h-12 w-12 text-amber-400/30 mx-auto mb-3" />
            <p className="text-white/50 font-medium">Plan wird noch bearbeitet</p>
            <p className="text-sm text-white/25 mt-1">Der Dienstplan fur {MONATE[month]} wurde generiert, aber noch nicht freigegeben.</p>
          </div>
        </div>
      );
    }
    return (
      <div className="flex-1 flex items-center justify-center px-8">
        <div className="text-center">
          <CalendarX className="h-12 w-12 text-white/20 mx-auto mb-3" />
          <p className="text-white/40">Kein Dienstplan fur {MONATE[month]} {year}</p>
          <p className="text-sm text-white/25 mt-1">Der Admin muss zuerst den Plan generieren und freigeben.</p>
        </div>
      </div>
    );
  };

  return (
    <AuthGuard>
    <div className="flex flex-col h-[100dvh] overflow-hidden">
      <NavBar />

      <div className="shrink-0 mx-auto w-full max-w-2xl px-4 pt-3 pb-2 sm:px-6">
        {/* Month picker */}
        <div className="flex items-center justify-between mb-2">
          <button onClick={prevMonth} className="flex items-center gap-1 py-2 text-white/30 hover:text-white/50 active:scale-95 transition-all">
            <ChevronLeft className="h-5 w-5" />
            <span className="text-sm font-medium">{MONATE[month === 0 ? 11 : month - 1]}</span>
          </button>
          <div className="text-center">
            <h2 className="text-lg font-bold text-white">{MONATE[month]}</h2>
            <p className="text-[11px] text-white/30">{year}</p>
          </div>
          <button onClick={nextMonth} className="flex items-center gap-1 py-2 text-white/30 hover:text-white/50 active:scale-95 transition-all">
            <span className="text-sm font-medium">{MONATE[month === 11 ? 0 : month + 1]}</span>
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* View Toggle */}
        {hasData && (
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode("mein")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-glass",
                viewMode === "mein" ? "glass-strong text-white glow" : "glass text-white/50"
              )}
            >
              <Eye className="h-4 w-4" />
              Meine Dienste
            </button>
            <button
              onClick={() => setViewMode("alle")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-glass",
                viewMode === "alle" ? "glass-strong text-white glow" : "glass text-white/50"
              )}
            >
              <List className="h-4 w-4" />
              Alle Tage
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        </div>
      ) : !hasData ? renderEmpty() : (
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto snap-y snap-mandatory scroll-smooth overscroll-contain"
          style={{
            maskImage: "linear-gradient(to bottom, transparent 0%, black 8%, black 75%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 8%, black 75%, transparent 100%)",
          }}
        >
          <div className="mx-auto w-full max-w-2xl px-4 sm:px-6">

          {/* === MEINE DIENSTE === */}
          {viewMode === "mein" && (() => {
            return (
              <div className="pt-4">
                <GlassCard className="p-3">
                  <div className="flex items-baseline justify-between mb-3 px-1">
                    <p className="text-base font-bold text-white">{MONATE[month]} {year}</p>
                    <p className="text-sm text-white/40"><strong className="text-white/70">{meineDienste.length}</strong> Dienste</p>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5 mb-1">
                    {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
                      <div key={d} className={cn("text-center text-[11px] font-semibold py-1", d === "Sa" || d === "So" ? "text-white/20" : "text-white/40")}>{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} className="aspect-square" />)}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const dow = new Date(year, month, day).getDay();
                      const isWeekend = dow === 0 || dow === 6;
                      const isToday = day === todayDay;
                      const isPast = day < todayDay;
                      const shifts = myShiftsMap[day];
                      const hasShift = shifts && shifts.length > 0;
                      const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                      const holiday = holidayMap[dateKey];
                      const holidayBg = holiday?.kind === "feiertag" ? "bg-white/20" : holiday?.kind === "ferien" ? "bg-slate-300/20" : "";
                      return (
                        <div key={day} title={holiday?.name} className={cn(
                          "aspect-square rounded-xl flex flex-col items-center justify-between py-1.5 px-0.5",
                          isToday && "ring-1 ring-primary/50",
                          hasShift ? "bg-primary/10" : isWeekend ? "bg-white/[0.02]" : holidayBg,
                          isPast && !hasShift && "opacity-30"
                        )}>
                          <span className={cn("text-xs font-bold leading-none", hasShift ? "text-white" : isWeekend ? "text-white/20" : "text-white/40", isToday && !hasShift ? "text-primary" : "")}>{day}</span>
                          {hasShift ? (
                            <div className="flex flex-col items-center gap-0.5">
                              {shifts.map((s, si) => { const Icon = s.icon; return <Icon key={si} className={cn("h-5 w-5", s.farbe.split(" ")[1] || "text-white/50")} />; })}
                            </div>
                          ) : <div />}
                          {hasShift ? (
                            <div className="flex flex-col items-center">
                              {shifts.map((s, si) => (
                                <span key={si} className={cn("leading-tight text-white/85 font-mono", (kurz(s.von) + kurz(s.bis)).length > 6 ? "text-[10px]" : "text-sm")}>{kurz(s.von)}–{kurz(s.bis)}</span>
                              ))}
                            </div>
                          ) : <div />}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
                    {[
                      { icon: Sun, label: "Tagdienst", farbe: "text-amber-300" },
                      { icon: Moon, label: "Nachtdienst", farbe: "text-indigo-300" },
                      { icon: Clock, label: "Bereitschaft", farbe: "text-sky-300" },
                      { icon: FileText, label: "Anmeldung", farbe: "text-emerald-300" },
                    ].map((l) => { const Icon = l.icon; return (
                      <div key={l.label} className="flex items-center gap-1 text-[10px] text-white/30"><Icon className={cn("h-3 w-3", l.farbe)} />{l.label}</div>
                    ); })}
                  </div>
                </GlassCard>
              </div>
            );
          })()}

          {/* === ALLE TAGE === */}
          {viewMode === "alle" && (
            <div className="space-y-0">
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dow = new Date(year, month, day).getDay();
                const isWeekend = dow === 0 || dow === 6;
                const plan = planData[day] || {};
                const shifts = Object.entries(plan)
                  .filter(([, e]) => e != null)
                  .map(([typ, e]) => ({ typ, entry: e as ShiftEntry }))
                  .sort((a, b) => {
                    const baseA = a.typ.replace(/_\d+$/, "");
                    const baseB = b.typ.replace(/_\d+$/, "");
                    if (baseA !== baseB) {
                      const order = ["tagdienst", "bd_tag", "bd_nacht", "nachtdienst", "anmeldung"];
                      return order.indexOf(baseA) - order.indexOf(baseB);
                    }
                    return a.entry.von.localeCompare(b.entry.von);
                  });
                const grouped: { baseTyp: string; items: { typ: string; entry: ShiftEntry }[] }[] = [];
                for (const shift of shifts) {
                  const base = shift.typ.replace(/_\d+$/, "");
                  const last = grouped[grouped.length - 1];
                  if (last && last.baseTyp === base) last.items.push(shift);
                  else grouped.push({ baseTyp: base, items: [shift] });
                }
                const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const holiday = holidayMap[dateKey];
                return (
                  <div key={day} id={`day-${day}`} className={cn("snap-start", i === 0 ? "pt-4" : "pt-3")}>
                  <GlassCard className={cn(
                    "p-4",
                    isWeekend && "opacity-80",
                    holiday?.kind === "feiertag" && "ring-1 ring-white/35 bg-white/15",
                    holiday?.kind === "ferien" && "ring-1 ring-slate-300/35 bg-slate-300/15"
                  )}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl text-base font-bold", isWeekend ? "bg-white/5 text-white/30" : "bg-white/8 text-white/70")}>{day}</div>
                      <p className={cn("text-sm font-semibold", isWeekend ? "text-white/40" : "text-white/80")}>{WOCHENTAGE_SHORT[dow]}</p>
                      {holiday && (
                        <span className={cn(
                          "ml-auto rounded-md px-2 py-0.5 text-[10px] font-medium",
                          holiday.kind === "feiertag" ? "bg-white/20 text-white" : "bg-slate-300/20 text-slate-100"
                        )}>{holiday.name}</span>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {grouped.length === 0 && <p className="text-xs text-white/20 text-center py-2">Kein Plan</p>}
                      {grouped.map((group) => (
                        <div key={group.baseTyp} className={cn("rounded-xl overflow-hidden", SCHICHT_FARBEN_CARD[group.baseTyp])}>
                          {group.items.map(({ typ, entry }, gi) => {
                            const Icon = SCHICHT_ICONS[typ] || Sun;
                            const isMe = entry.name === user?.vorname;
                            return (
                              <div key={typ} className={cn("flex items-center gap-2.5 px-3 py-2", gi > 0 && "border-t border-white/5", isMe && "bg-primary/10")}>
                                <Icon className="h-3.5 w-3.5 shrink-0 opacity-60" />
                                {gi === 0 ? <span className="text-xs opacity-50 w-16 shrink-0">{SCHICHT_NAMEN[typ] || typ}</span> : <span className="w-16 shrink-0" />}
                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                  <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: entry.farbe }} />
                                  <span className={cn("text-sm font-medium truncate", isMe && "text-white")}>
                                    {entry.name}{isMe && <span className="text-[10px] ml-1 opacity-50">(Du)</span>}
                                  </span>
                                </div>
                                <span className="text-xs font-mono opacity-50 shrink-0">{entry.von}–{entry.bis}</span>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                  </div>
                );
              })}
            </div>
          )}
          <div className="h-4" />
          </div>
        </div>
      )}
    </div>
    </AuthGuard>
  );
}
