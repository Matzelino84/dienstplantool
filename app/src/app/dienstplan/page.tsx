"use client";

import { AuthGuard } from "@/components/auth-guard";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { NavBar } from "@/components/ui/nav-bar";
import { GlassCard } from "@/components/ui/glass-card";
import {
  SCHICHT_LABELS,
  type SchichtTyp,
} from "@/lib/types";
import {
  Eye,
  List,
  Sun,
  Moon,
  Clock,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

const DEMO_TEAM = [
  "Alena", "Lena", "Lea", "Tatjana", "Fabienne", "Lisa", "Jessy",
  "Johanna", "Pati", "Lilly", "Anna", "Serena", "Teresa", "Martina",
];

const DEMO_FARBEN: Record<string, string> = {
  Alena: "#f59e0b", Lena: "#3b82f6", Lea: "#8b5cf6", Tatjana: "#ec4899",
  Fabienne: "#10b981", Lisa: "#f97316", Jessy: "#06b6d4", Johanna: "#84cc16",
  Pati: "#e11d48", Lilly: "#7c3aed", Anna: "#14b8a6", Serena: "#f43f5e",
  Teresa: "#0ea5e9", Martina: "#a855f7",
};

type ShiftEntry = { name: string; von: string; bis: string };
type DayPlan = Record<string, ShiftEntry | undefined>;

function generateDemoData(year: number, month: number, daysInMonth: number) {
  const data: Record<number, DayPlan> = {};
  for (let day = 1; day <= daysInMonth; day++) {
    const seed = day * 13 + 7;
    const shuffled = [...DEMO_TEAM].sort((a, b) => {
      const sa = (a.charCodeAt(0) * day + seed) % 100;
      const sb = (b.charCodeAt(0) * day + seed) % 100;
      return sa - sb;
    });
    const dow = new Date(year, month, day).getDay();

    // Some days have split shifts for realism
    const hasSplit = seed % 4 === 0;
    const plan: DayPlan = {
      tagdienst: hasSplit
        ? { name: shuffled[0], von: "07:00", bis: "13:00" }
        : { name: shuffled[0], von: "07:00", bis: "19:00" },
      nachtdienst: { name: shuffled[3], von: "19:00", bis: "07:00" },
      bd_tag: { name: shuffled[1], von: "07:00", bis: "19:00" },
      bd_nacht: { name: shuffled[2], von: "19:00", bis: "07:00" },
    };

    // Second person for split tagdienst
    if (hasSplit) {
      plan.tagdienst_2 = { name: shuffled[5], von: "13:00", bis: "19:00" };
    }

    if (dow === 2 || dow === 5) {
      plan.anmeldung = { name: shuffled[4], von: "09:00", bis: "14:00" };
    }
    data[day] = plan;
  }
  return data;
}

const MONATE = [
  "Januar", "Februar", "Marz", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

const WOCHENTAGE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const WOCHENTAGE_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

const SCHICHT_ICONS: Record<string, typeof Sun> = {
  tagdienst: Sun, tagdienst_2: Sun,
  nachtdienst: Moon,
  bd_tag: Clock, bd_nacht: Clock,
  anmeldung: FileText,
};

const SCHICHT_FARBEN_CARD: Record<string, string> = {
  tagdienst: "bg-amber-500/15 text-amber-300",
  tagdienst_2: "bg-amber-500/15 text-amber-300",
  nachtdienst: "bg-indigo-500/15 text-indigo-300",
  bd_tag: "bg-sky-500/15 text-sky-300",
  bd_nacht: "bg-blue-500/15 text-blue-300",
  anmeldung: "bg-emerald-500/15 text-emerald-300",
};

const SCHICHT_NAMEN: Record<string, string> = {
  tagdienst: "Tagdienst",
  tagdienst_2: "Tagdienst",
  nachtdienst: "Nachtdienst",
  bd_tag: "BD Tag",
  bd_nacht: "BD Nacht",
  anmeldung: "Anmeldung",
};

export default function DienstplanPage() {
  const { user } = useAuth();
  const [year] = useState(2026);
  const [month] = useState(4);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const [planData] = useState(() => generateDemoData(year, month, daysInMonth));
  const [viewMode, setViewMode] = useState<"mein" | "alle">("mein");
  const scrollRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  const todayDay =
    today.getFullYear() === year && today.getMonth() === month
      ? today.getDate()
      : 1;

  const meineDienste = user
    ? Object.entries(planData)
        .filter(([, plan]) =>
          Object.values(plan).some((e) => e?.name === user.vorname)
        )
        .map(([day]) => Number(day))
        .sort((a, b) => a - b)
    : [];

  // Find the right day to scroll to
  const scrollTarget = (() => {
    if (viewMode === "mein") {
      const next = meineDienste.find((d) => d >= todayDay);
      return next ?? meineDienste[meineDienste.length - 1] ?? todayDay;
    }
    return todayDay;
  })();

  // Scroll so target day is visible with previous day peeking above
  useEffect(() => {
    setTimeout(() => {
      const el = document.getElementById(`day-${scrollTarget}`);
      if (el && scrollRef.current) {
        const container = scrollRef.current;
        const elTop = el.offsetTop - container.offsetTop;
        container.scrollTo({ top: Math.max(0, elTop - 20), behavior: "instant" });
      }
    }, 50);
  }, [viewMode, scrollTarget]);

  return (
    <AuthGuard>
    <div className="flex flex-col h-[100dvh] overflow-hidden">
      <NavBar />

      {/* Sticky header area */}
      <div className="shrink-0 mx-auto w-full max-w-2xl px-4 pt-3 pb-2 sm:px-6">
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
      </div>

      {/* Scrollable reel area with Star Wars fade */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto snap-y snap-mandatory scroll-smooth overscroll-contain"
        style={{
          maskImage: "linear-gradient(to bottom, transparent 0%, black 8%, black 75%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 8%, black 75%, transparent 100%)",
        }}
      >
        <div className="mx-auto w-full max-w-2xl px-4 sm:px-6">

        {/* === MEINE DIENSTE – Monatskalender === */}
        {viewMode === "mein" && (() => {
          const firstDow = new Date(year, month, 1).getDay();
          const firstDay = firstDow === 0 ? 6 : firstDow - 1; // Mo=0

          // Build lookup: day -> my shifts
          const myShiftsMap: Record<number, { typ: string; icon: typeof Sun; farbe: string; von: string; bis: string }[]> = {};
          for (const day of meineDienste) {
            const plan = planData[day];
            myShiftsMap[day] = Object.entries(plan)
              .filter(([, e]) => e?.name === user?.vorname)
              .map(([typ, e]) => ({
                typ,
                icon: SCHICHT_ICONS[typ] || Sun,
                farbe: SCHICHT_FARBEN_CARD[typ] || "",
                von: (e as ShiftEntry).von,
                bis: (e as ShiftEntry).bis,
              }));
          }

          // Short time format: "07:00" → "7" / "19:30" → "19:30"
          const kurz = (z: string) => { const [h, m] = z.split(":"); return m === "00" ? `${parseInt(h)}` : `${parseInt(h)}:${m}`; };

          return (
            <div className="pt-4">
              <GlassCard className="p-3">
                <div className="flex items-baseline justify-between mb-3 px-1">
                  <p className="text-base font-bold text-white">{MONATE[month]} {year}</p>
                  <p className="text-sm text-white/40"><strong className="text-white/70">{meineDienste.length}</strong> Dienste</p>
                </div>

                {/* Weekday headers */}
                <div className="grid grid-cols-7 gap-1.5 mb-1">
                  {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
                    <div key={d} className={cn("text-center text-[11px] font-semibold py-1", d === "Sa" || d === "So" ? "text-white/20" : "text-white/40")}>
                      {d}
                    </div>
                  ))}
                </div>

                {/* Calendar grid – taller cells for shift info */}
                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`e-${i}`} className="aspect-square" />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dow = new Date(year, month, day).getDay();
                    const isWeekend = dow === 0 || dow === 6;
                    const isToday = day === todayDay;
                    const isPast = day < todayDay;
                    const shifts = myShiftsMap[day];
                    const hasShift = shifts && shifts.length > 0;

                    return (
                      <div
                        key={day}
                        className={cn(
                          "aspect-square rounded-xl flex flex-col items-center justify-between py-1.5 px-0.5",
                          isToday && "ring-1 ring-primary/50",
                          hasShift ? "bg-primary/10" : isWeekend ? "bg-white/[0.02]" : "",
                          isPast && !hasShift && "opacity-30"
                        )}
                      >
                        <span className={cn(
                          "text-xs font-bold leading-none",
                          hasShift ? "text-white" : isWeekend ? "text-white/20" : "text-white/40",
                          isToday && !hasShift ? "text-primary" : ""
                        )}>
                          {day}
                        </span>
                        {hasShift ? (
                          <div className="flex flex-col items-center gap-0.5">
                            {shifts.map((s, si) => {
                              const Icon = s.icon;
                              return (
                                <Icon key={si} className={cn("h-5 w-5", s.farbe.split(" ")[1] || "text-white/50")} />
                              );
                            })}
                          </div>
                        ) : <div />}
                        {hasShift ? (
                          <div className="flex flex-col items-center">
                            {shifts.map((s, si) => (
                              <span key={si} className={cn(
                                "leading-tight text-white/85 font-mono",
                                (kurz(s.von) + kurz(s.bis)).length > 6 ? "text-[10px]" : "text-sm"
                              )}>
                                {kurz(s.von)}–{kurz(s.bis)}
                              </span>
                            ))}
                          </div>
                        ) : <div />}
                      </div>
                    );
                  })}
                </div>
                {/* Legend */}
                <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
                  {[
                    { icon: Sun, label: "Tagdienst", farbe: "text-amber-300" },
                    { icon: Moon, label: "Nachtdienst", farbe: "text-indigo-300" },
                    { icon: Clock, label: "Bereitschaft", farbe: "text-sky-300" },
                    { icon: FileText, label: "Anmeldung", farbe: "text-emerald-300" },
                  ].map((l) => {
                    const Icon = l.icon;
                    return (
                      <div key={l.label} className="flex items-center gap-1 text-[10px] text-white/30">
                        <Icon className={cn("h-3 w-3", l.farbe)} />
                        {l.label}
                      </div>
                    );
                  })}
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
              const plan = planData[day];
              const shifts = Object.entries(plan)
                .filter(([, e]) => e != null)
                .map(([typ, e]) => ({ typ, entry: e as ShiftEntry }))
                // Sort by base type then by start time
                .sort((a, b) => {
                  const baseA = a.typ.replace(/_\d+$/, "");
                  const baseB = b.typ.replace(/_\d+$/, "");
                  if (baseA !== baseB) {
                    const order = ["tagdienst", "bd_tag", "bd_nacht", "nachtdienst", "anmeldung"];
                    return order.indexOf(baseA) - order.indexOf(baseB);
                  }
                  return a.entry.von.localeCompare(b.entry.von);
                });

              // Group consecutive shifts of same base type
              const grouped: { baseTyp: string; items: { typ: string; entry: ShiftEntry }[] }[] = [];
              for (const shift of shifts) {
                const base = shift.typ.replace(/_\d+$/, "");
                const last = grouped[grouped.length - 1];
                if (last && last.baseTyp === base) {
                  last.items.push(shift);
                } else {
                  grouped.push({ baseTyp: base, items: [shift] });
                }
              }

              return (
                <div key={day} id={`day-${day}`} className={cn("snap-start", i === 0 ? "pt-4" : "pt-3")}>
                <GlassCard className={cn("p-4", isWeekend && "opacity-80")}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-xl text-base font-bold",
                      isWeekend ? "bg-white/5 text-white/30" : "bg-white/8 text-white/70"
                    )}>
                      {day}
                    </div>
                    <p className={cn("text-sm font-semibold", isWeekend ? "text-white/40" : "text-white/80")}>
                      {WOCHENTAGE_SHORT[dow]}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    {grouped.map((group) => (
                      <div key={group.baseTyp} className={cn("rounded-xl overflow-hidden", SCHICHT_FARBEN_CARD[group.baseTyp])}>
                        {group.items.map(({ typ, entry }, gi) => {
                          const Icon = SCHICHT_ICONS[typ] || Sun;
                          const isMe = entry.name === user?.vorname;
                          return (
                            <div
                              key={typ}
                              className={cn(
                                "flex items-center gap-2.5 px-3 py-2",
                                gi > 0 && "border-t border-white/5",
                                isMe && "bg-primary/10"
                              )}
                            >
                              <Icon className="h-3.5 w-3.5 shrink-0 opacity-60" />
                              {gi === 0 && (
                                <span className="text-xs opacity-50 w-16 shrink-0">{SCHICHT_NAMEN[typ]}</span>
                              )}
                              {gi > 0 && <span className="w-16 shrink-0" />}
                              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                <div
                                  className="h-2 w-2 rounded-full shrink-0"
                                  style={{ backgroundColor: DEMO_FARBEN[entry.name] || "#666" }}
                                />
                                <span className={cn("text-sm font-medium truncate", isMe && "text-white")}>
                                  {entry.name}
                                  {isMe && <span className="text-[10px] ml-1 opacity-50">(Du)</span>}
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

        {/* Bottom padding for last snap item */}
        <div className="h-4" />

        </div>
      </div>
    </div>
    </AuthGuard>
  );
}
