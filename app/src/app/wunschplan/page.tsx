"use client";

import { useState } from "react";
import { NavBar } from "@/components/ui/nav-bar";
import { GlassCard } from "@/components/ui/glass-card";
import {
  VERFUEGBAR_LABELS,
  WOCHENTAGE,
  type VerfuegbarFuer,
  type FreiWunsch,
} from "@/lib/types";
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Moon,
  Save,
  Sun,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type DayPreference = {
  verfuegbar: VerfuegbarFuer[];
  freiWunsch: FreiWunsch | null;
  istUrlaub: boolean;
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Monday = 0
}

const MONATE = [
  "Januar",
  "Februar",
  "Marz",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

const VERFUEGBAR_OPTIONS: { value: VerfuegbarFuer; label: string; icon?: typeof Sun }[] = [
  { value: "alle", label: "Alle Dienste" },
  { value: "tagdienst", label: "Tagdienst", icon: Sun },
  { value: "nachtdienst", label: "Nachtdienst", icon: Moon },
  { value: "bereitschaft", label: "Bereitschaft" },
  { value: "bd_tag", label: "Nur Tag-BD" },
  { value: "bd_nacht", label: "Nur Nacht-BD" },
  { value: "anmeldung", label: "Anmeldung" },
];

export default function WunschplanPage() {
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(5); // Juni = 5 (0-indexed)
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [preferences, setPreferences] = useState<
    Record<number, DayPreference>
  >({});
  const [zielDienste, setZielDienste] = useState(8);
  const [zielAnmeldungen, setZielAnmeldungen] = useState(1);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const updatePreference = (day: number, update: Partial<DayPreference>) => {
    setPreferences((prev) => {
      const existing = prev[day] ?? {
        verfuegbar: [],
        freiWunsch: null,
        istUrlaub: false,
      };
      return {
        ...prev,
        [day]: { ...existing, ...update },
      };
    });
  };

  const toggleVerfuegbar = (day: number, typ: VerfuegbarFuer) => {
    const current = preferences[day]?.verfuegbar || [];
    const updated = current.includes(typ)
      ? current.filter((v) => v !== typ)
      : [...current, typ];
    updatePreference(day, { verfuegbar: updated, freiWunsch: null, istUrlaub: false });
  };

  const setFreiWunsch = (day: number, typ: FreiWunsch | null) => {
    updatePreference(day, { freiWunsch: typ, verfuegbar: [], istUrlaub: false });
  };

  const setUrlaub = (day: number) => {
    updatePreference(day, { istUrlaub: true, verfuegbar: [], freiWunsch: null });
  };

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
    setSelectedDay(null);
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
    setSelectedDay(null);
  };

  const getDayColor = (day: number) => {
    const pref = preferences[day];
    if (!pref) return "";
    if (pref.istUrlaub) return "bg-rose-500/30 border-rose-400/40";
    if (pref.freiWunsch === "wichtig") return "bg-red-500/20 border-red-400/30";
    if (pref.freiWunsch === "waere_schoen") return "bg-amber-500/20 border-amber-400/30";
    if (pref.verfuegbar.length > 0) return "bg-emerald-500/20 border-emerald-400/30";
    return "";
  };

  const getDayLabel = (day: number) => {
    const pref = preferences[day];
    if (!pref) return null;
    if (pref.istUrlaub) return "U";
    if (pref.freiWunsch === "wichtig") return "!";
    if (pref.freiWunsch === "waere_schoen") return "~";
    if (pref.verfuegbar.length > 0) return "✓";
    return null;
  };

  const dayOfWeekForDate = (day: number) => {
    return new Date(year, month, day).getDay();
  };

  const isWeekend = (day: number) => {
    const dow = dayOfWeekForDate(day);
    return dow === 0 || dow === 6;
  };

  const isAnmeldungTag = (day: number) => {
    const dow = dayOfWeekForDate(day);
    return dow === 2 || dow === 5; // Di or Fr
  };

  return (
    <div className="flex min-h-screen flex-col">
      <NavBar />
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Wunschplan
          </h1>
          <p className="mt-1 text-white/50">
            Trage deine Verfugbarkeiten und Wunsche ein
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Calendar */}
          <GlassCard className="lg:col-span-2">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={prevMonth}
                className="rounded-xl p-2 text-white/60 hover:text-white hover:bg-white/5 transition-glass"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h2 className="text-xl font-semibold text-white">
                {MONATE[month]} {year}
              </h2>
              <button
                onClick={nextMonth}
                className="rounded-xl p-2 text-white/60 hover:text-white hover:bg-white/5 transition-glass"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
                <div
                  key={d}
                  className={cn(
                    "text-center text-xs font-medium py-2",
                    d === "Sa" || d === "So"
                      ? "text-white/30"
                      : "text-white/50"
                  )}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells */}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}

              {/* Day cells */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const weekend = isWeekend(day);
                const anmeldung = isAnmeldungTag(day);
                const color = getDayColor(day);
                const label = getDayLabel(day);
                const selected = selectedDay === day;

                return (
                  <button
                    key={day}
                    onClick={() =>
                      setSelectedDay(selected ? null : day)
                    }
                    className={cn(
                      "aspect-square rounded-xl text-sm font-medium transition-glass relative flex flex-col items-center justify-center gap-0.5",
                      weekend
                        ? "text-white/30"
                        : "text-white/80",
                      color || "hover:bg-white/5",
                      selected && "ring-2 ring-primary glow",
                      anmeldung && !color && "border border-dashed border-emerald-500/20"
                    )}
                  >
                    <span>{day}</span>
                    {label && (
                      <span className="text-[10px] leading-none">
                        {label}
                      </span>
                    )}
                    {anmeldung && (
                      <div className="absolute top-1 right-1 h-1 w-1 rounded-full bg-emerald-400/60" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-6 flex flex-wrap gap-4 text-xs text-white/40">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-emerald-500/30" />
                <span>Verfugbar</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-amber-500/30" />
                <span>Ware schon frei</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-red-500/30" />
                <span>Muss frei sein</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-rose-500/40" />
                <span>Urlaub</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span>Anmeldungstag (Di/Fr)</span>
              </div>
            </div>
          </GlassCard>

          {/* Day Detail Panel */}
          <div className="space-y-6">
            {selectedDay ? (
              <>
                <GlassCard>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">
                      {selectedDay}. {MONATE[month]}
                    </h3>
                    <span className="text-sm text-white/40">
                      {
                        WOCHENTAGE[dayOfWeekForDate(selectedDay)]
                      }
                    </span>
                  </div>

                  {/* Availability Selection */}
                  <div className="mb-6">
                    <p className="text-sm font-medium text-white/60 mb-3">
                      Ich kann arbeiten als:
                    </p>
                    <div className="space-y-2">
                      {VERFUEGBAR_OPTIONS.map((opt) => {
                        const isSelected =
                          preferences[selectedDay]?.verfuegbar?.includes(
                            opt.value
                          ) || false;
                        return (
                          <button
                            key={opt.value}
                            onClick={() =>
                              toggleVerfuegbar(selectedDay, opt.value)
                            }
                            className={cn(
                              "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm transition-glass",
                              isSelected
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : "bg-white/5 text-white/60 hover:bg-white/8"
                            )}
                          >
                            {isSelected ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <div className="h-4 w-4 rounded border border-white/20" />
                            )}
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Free Wishes */}
                  <div className="mb-4">
                    <p className="text-sm font-medium text-white/60 mb-3">
                      Oder: Freiwunsch
                    </p>
                    <div className="space-y-2">
                      <button
                        onClick={() =>
                          setFreiWunsch(
                            selectedDay,
                            preferences[selectedDay]?.freiWunsch ===
                              "wichtig"
                              ? null
                              : "wichtig"
                          )
                        }
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm transition-glass",
                          preferences[selectedDay]?.freiWunsch ===
                            "wichtig"
                            ? "bg-red-500/20 text-red-300 border border-red-500/30"
                            : "bg-white/5 text-white/60 hover:bg-white/8"
                        )}
                      >
                        <X className="h-4 w-4" />
                        Wichtig frei (Arzt, Hochzeit...)
                      </button>
                      <button
                        onClick={() =>
                          setFreiWunsch(
                            selectedDay,
                            preferences[selectedDay]?.freiWunsch ===
                              "waere_schoen"
                              ? null
                              : "waere_schoen"
                          )
                        }
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm transition-glass",
                          preferences[selectedDay]?.freiWunsch ===
                            "waere_schoen"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-white/5 text-white/60 hover:bg-white/8"
                        )}
                      >
                        <span className="text-base">~</span>
                        Ware schon frei
                      </button>
                      <button
                        onClick={() => {
                          if (preferences[selectedDay]?.istUrlaub) {
                            updatePreference(selectedDay, { istUrlaub: false });
                          } else {
                            setUrlaub(selectedDay);
                          }
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm transition-glass",
                          preferences[selectedDay]?.istUrlaub
                            ? "bg-rose-500/30 text-rose-300 border border-rose-400/40"
                            : "bg-white/5 text-white/60 hover:bg-white/8"
                        )}
                      >
                        <span className="text-base">U</span>
                        Eingetragener Urlaub
                      </button>
                    </div>
                  </div>
                </GlassCard>
              </>
            ) : (
              <GlassCard variant="subtle">
                <div className="text-center py-8">
                  <Calendar className="h-10 w-10 text-white/20 mx-auto mb-3" />
                  <p className="text-sm text-white/40">
                    Wahle einen Tag im Kalender, um deine Wunsche einzutragen
                  </p>
                </div>
              </GlassCard>
            )}

            {/* Monthly Settings */}
            <GlassCard>
              <h3 className="text-lg font-semibold text-white mb-4">
                Monats-Einstellungen
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-white/60 block mb-2">
                    Gewunschte Anzahl Dienste: {zielDienste}
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={20}
                    value={zielDienste}
                    onChange={(e) =>
                      setZielDienste(Number(e.target.value))
                    }
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-xs text-white/30 mt-1">
                    <span>1</span>
                    <span>10</span>
                    <span>20</span>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-white/60 block mb-2">
                    Anmeldungen (mind. 1): {zielAnmeldungen}
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={zielAnmeldungen}
                    onChange={(e) =>
                      setZielAnmeldungen(Number(e.target.value))
                    }
                    className="w-full accent-primary"
                  />
                </div>
              </div>
            </GlassCard>

            {/* Save Button */}
            <button className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-accent py-4 text-sm font-semibold text-white transition-glass hover:opacity-90 glow">
              <Save className="h-4 w-4" />
              Wunschplan speichern
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
