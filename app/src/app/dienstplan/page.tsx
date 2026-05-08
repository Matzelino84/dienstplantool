"use client";

import { useState } from "react";
import { NavBar } from "@/components/ui/nav-bar";
import { GlassCard } from "@/components/ui/glass-card";
import {
  SCHICHT_LABELS,
  SCHICHT_FARBEN,
  type SchichtTyp,
} from "@/lib/types";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Sparkles,
  Check,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Demo data
const DEMO_TEAM = [
  "Alena",
  "Lena",
  "Lea",
  "Tatjana",
  "Fabienne",
  "Lisa",
  "Jessy",
  "Johanna",
  "Pati",
  "Lilly",
  "Anna",
  "Serena",
  "Teresa",
  "Martina",
];

const SCHICHT_TYPEN: SchichtTyp[] = [
  "tagdienst",
  "bd_tag",
  "bd_nacht",
  "nachtdienst",
  "anmeldung",
];

function generateDemoData(daysInMonth: number) {
  const data: Record<number, Record<SchichtTyp, string>> = {};
  for (let day = 1; day <= daysInMonth; day++) {
    const dayData: Record<string, string> = {};
    const available = [...DEMO_TEAM].sort(() => Math.random() - 0.5);
    dayData.tagdienst = available[0];
    dayData.bd_tag = available[1];
    dayData.bd_nacht = available[2];
    dayData.nachtdienst = available[3];
    const dow = new Date(2026, 4, day).getDay();
    if (dow === 2 || dow === 5) {
      dayData.anmeldung = available[4];
    }
    data[day] = dayData as Record<SchichtTyp, string>;
  }
  return data;
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

const WOCHENTAGE_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

export default function DienstplanPage() {
  const [year] = useState(2026);
  const [month] = useState(4); // Mai
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const [planData] = useState(() => generateDemoData(daysInMonth));
  const [planStatus] = useState<"entwurf" | "generiert" | "freigegeben">(
    "generiert"
  );

  return (
    <div className="flex min-h-screen flex-col">
      <NavBar />
      <main className="flex-1 mx-auto w-full max-w-[95rem] px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              Dienstplan
            </h1>
            <p className="mt-1 text-white/50">
              {MONATE[month]} {year} &mdash;{" "}
              <span
                className={cn(
                  "inline-flex items-center gap-1",
                  planStatus === "freigegeben"
                    ? "text-emerald-400"
                    : planStatus === "generiert"
                    ? "text-amber-400"
                    : "text-white/40"
                )}
              >
                {planStatus === "freigegeben" && (
                  <Check className="h-3.5 w-3.5" />
                )}
                {planStatus === "generiert" && (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {planStatus.charAt(0).toUpperCase() +
                  planStatus.slice(1)}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 rounded-xl glass px-4 py-2.5 text-sm font-medium text-white/70 hover:text-white transition-glass glass-hover">
              <Download className="h-4 w-4" />
              PDF Export
            </button>
            <button className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-5 py-2.5 text-sm font-semibold text-white transition-glass hover:opacity-90 glow">
              <Sparkles className="h-4 w-4" />
              Plan generieren
            </button>
          </div>
        </div>

        {/* Plan Table */}
        <GlassCard className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="sticky left-0 z-10 glass-strong px-4 py-3 text-left text-xs font-medium text-white/50 w-20">
                    Tag
                  </th>
                  {SCHICHT_TYPEN.map((typ) => (
                    <th
                      key={typ}
                      className="px-4 py-3 text-left text-xs font-medium text-white/50 min-w-[130px]"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "h-2 w-2 rounded-full bg-gradient-to-r",
                            SCHICHT_FARBEN[typ]
                          )}
                        />
                        {SCHICHT_LABELS[typ]}
                      </div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/50 w-20">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dow = new Date(year, month, day).getDay();
                  const isWeekend = dow === 0 || dow === 6;
                  const rowData = planData[day];

                  return (
                    <tr
                      key={day}
                      className={cn(
                        "border-b border-white/5 transition-glass hover:bg-white/3",
                        isWeekend && "bg-white/2"
                      )}
                    >
                      <td className="sticky left-0 z-10 glass-strong px-4 py-2.5">
                        <div className="flex items-baseline gap-2">
                          <span
                            className={cn(
                              "text-sm font-semibold",
                              isWeekend
                                ? "text-white/30"
                                : "text-white/70"
                            )}
                          >
                            {WOCHENTAGE_SHORT[dow]}
                          </span>
                          <span className="text-xs text-white/40">
                            {day}.
                          </span>
                        </div>
                      </td>
                      {SCHICHT_TYPEN.map((typ) => {
                        const name = rowData?.[typ];
                        return (
                          <td key={typ} className="px-4 py-2.5">
                            {name ? (
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-lg bg-gradient-to-r px-3 py-1 text-xs font-medium text-white/90",
                                  SCHICHT_FARBEN[typ]
                                )}
                              >
                                {name}
                              </span>
                            ) : typ === "anmeldung" ? (
                              <span className="text-xs text-white/15">
                                —
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-red-400/60">
                                <AlertTriangle className="h-3 w-3" />
                                Unbesetzt
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-2.5">
                        <div className="h-2 w-2 rounded-full bg-emerald-400 mx-auto" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </main>
    </div>
  );
}
