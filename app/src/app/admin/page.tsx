"use client";

import { AuthGuard } from "@/components/auth-guard";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { NavBar } from "@/components/ui/nav-bar";
import { GlassCard } from "@/components/ui/glass-card";
import { StatCard } from "@/components/ui/stat-card";
import {
  solveDienstplan,
  type PersonWunsch,
  type SolverResult,
  type SolverKonflikt,
} from "@/lib/solver";
import { SCHICHT_LABELS, type SchichtTyp } from "@/lib/types";
import {
  Shield,
  ClipboardList,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  ChevronDown,
  X,
  Sun,
  Moon,
  Clock,
  FileText,
  UserCheck,
  UserX,
  Heart,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TEAM = [
  { name: "Alena", fairness: 45 },
  { name: "Lena", fairness: 60 },
  { name: "Lea", fairness: 55 },
  { name: "Tatjana", fairness: 40 },
  { name: "Fabienne", fairness: 70 },
  { name: "Lisa", fairness: 35 },
  { name: "Jessy", fairness: 50 },
  { name: "Johanna", fairness: 65 },
  { name: "Pati", fairness: 42 },
  { name: "Lilly", fairness: 58 },
  { name: "Anna", fairness: 48 },
  { name: "Serena", fairness: 72 },
  { name: "Teresa", fairness: 55 },
  { name: "Martina", fairness: 38 },
];

const DEMO_FARBEN: Record<string, string> = {
  Alena: "#f59e0b", Lena: "#3b82f6", Lea: "#8b5cf6", Tatjana: "#ec4899",
  Fabienne: "#10b981", Lisa: "#f97316", Jessy: "#06b6d4", Johanna: "#84cc16",
  Pati: "#e11d48", Lilly: "#7c3aed", Anna: "#14b8a6", Serena: "#f43f5e",
  Teresa: "#0ea5e9", Martina: "#a855f7",
};

type MemberStatus = {
  name: string;
  abgegeben: boolean;
  dienste: number;
  verfuegbar: number;
  frei: number;
  nicht: number;
  fairness: number;
};

const SCHICHT_ICONS: Record<string, typeof Sun> = {
  tagdienst: Sun, nachtdienst: Moon, bd_tag: Clock, bd_nacht: Clock, anmeldung: FileText,
};

// Generate demo wish data
function generateDemoWuensche(year: number, month: number, daysInMonth: number) {
  const wuensche: Record<string, Record<number, PersonWunsch>> = {};
  const memberStatus: MemberStatus[] = [];

  for (const member of TEAM) {
    const days: Record<number, PersonWunsch> = {};
    let verfCount = 0, freiCount = 0, nichtCount = 0;
    const seed = member.name.charCodeAt(0) * 3 + member.name.charCodeAt(1);
    // Lisa and Lilly haven't submitted
    const abgegeben = member.name !== "Lisa" && member.name !== "Lilly";

    for (let d = 1; d <= daysInMonth; d++) {
      const daySeed = (seed + d * 7) % 100;
      let status: PersonWunsch["status"] = "leer";

      if (abgegeben) {
        if (daySeed < 45) { status = "verfuegbar"; verfCount++; }
        else if (daySeed < 60) { status = "frei_wunsch"; freiCount++; }
        else if (daySeed < 80) { status = "nicht_verfuegbar"; nichtCount++; }
      }

      const dienstTypen: SchichtTyp[] = [];
      if (status === "verfuegbar") {
        if (daySeed % 3 === 0) dienstTypen.push("tagdienst");
        if (daySeed % 4 === 0) dienstTypen.push("nachtdienst");
        if (daySeed % 5 === 0) dienstTypen.push("bd_tag");
      }

      days[d] = {
        name: member.name,
        status,
        dienstTypen,
        fairnessScore: member.fairness,
      };
    }
    wuensche[member.name] = days;
    memberStatus.push({
      name: member.name,
      abgegeben,
      dienste: abgegeben ? Math.floor(verfCount * 0.6) + 3 : 0,
      verfuegbar: verfCount,
      frei: freiCount,
      nicht: nichtCount,
      fairness: member.fairness,
    });
  }

  return { wuensche, memberStatus };
}

const MONATE = [
  "Januar", "Februar", "Marz", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

const WOCHENTAGE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

export default function AdminPage() {
  const { isAdmin, isLoading } = useAuth();
  const router = useRouter();

  const [year] = useState(2026);
  const [month] = useState(5); // Juni
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const [demoData] = useState(() => generateDemoWuensche(year, month, daysInMonth));
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<SolverResult | null>(null);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [selectedKonflikt, setSelectedKonflikt] = useState<SolverKonflikt | null>(null);

  useEffect(() => {
    if (!isLoading && !isAdmin) router.replace("/");
  }, [isAdmin, isLoading, router]);

  const isAnmeldungTag = (day: number) => {
    const dow = new Date(year, month, day).getDay();
    return dow === 2 || dow === 5;
  };

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => {
      const solverResult = solveDienstplan(
        year, month,
        demoData.wuensche,
        TEAM.map((t) => t.name),
        isAnmeldungTag
      );
      setResult(solverResult);
      setGenerating(false);
    }, 1500);
  };

  const abgegeben = demoData.memberStatus.filter((m) => m.abgegeben).length;
  const offen = demoData.memberStatus.length - abgegeben;

  // Count forced assignments per person (for result view)
  const erzwungenPro = result
    ? result.zuweisungen
        .filter((z) => z.erzwungen)
        .reduce((acc, z) => {
          acc[z.name] = (acc[z.name] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
    : {};

  if (!isAdmin) return null;

  return (
    <AuthGuard>
    <div className="flex min-h-screen flex-col">
      <NavBar />
      <main className="flex-1 mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="h-6 w-6 text-amber-400" />
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Admin</h1>
            <p className="text-sm text-white/50">{MONATE[month]} {year}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <StatCard
            label="Abgegeben"
            value={`${abgegeben}/${TEAM.length}`}
            icon={ClipboardList}
            trend={offen > 0 ? `${offen} fehlen noch` : "Alle da!"}
          />
          <StatCard
            label="Fairness"
            value={`${Math.round(TEAM.reduce((s, t) => s + t.fairness, 0) / TEAM.length)}%`}
            icon={TrendingUp}
          />
        </div>

        {/* Team Wunschplane */}
        <GlassCard className="mb-6">
          <h2 className="text-base font-semibold text-white mb-4">Wunschplane</h2>
          <div className="space-y-1">
            {demoData.memberStatus.map((member) => (
              <div key={member.name}>
                <button
                  onClick={() => setExpandedMember(expandedMember === member.name ? null : member.name)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-glass hover:bg-white/5 active:scale-[0.99]"
                >
                  <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", member.abgegeben ? "bg-emerald-400" : "bg-red-400")} />
                  <span className="text-sm font-medium text-white/80 flex-1 text-left">{member.name}</span>
                  {member.abgegeben ? (
                    <div className="flex items-center gap-3 text-xs text-white/40">
                      <span className="text-emerald-400/60">{member.verfuegbar}</span>
                      <span className="text-amber-400/60">{member.frei}</span>
                      <span className="text-red-400/60">{member.nicht}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-red-400/60">Fehlt</span>
                  )}
                  <ChevronDown className={cn("h-4 w-4 text-white/20 transition-transform", expandedMember === member.name && "rotate-180")} />
                </button>
                {expandedMember === member.name && member.abgegeben && (
                  <div className="ml-8 mr-3 mb-2 rounded-xl bg-white/3 p-3">
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      <div><p className="text-lg font-bold text-emerald-400">{member.verfuegbar}</p><p className="text-white/30">Verfugbar</p></div>
                      <div><p className="text-lg font-bold text-amber-400">{member.frei}</p><p className="text-white/30">Lieber frei</p></div>
                      <div><p className="text-lg font-bold text-red-400">{member.nicht}</p><p className="text-white/30">Kann nicht</p></div>
                      <div><p className="text-lg font-bold text-white/60">{member.fairness}%</p><p className="text-white/30">Fairness</p></div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={generating}
          className={cn(
            "w-full flex items-center justify-center gap-3 rounded-2xl py-5 text-lg font-bold text-white transition-glass active:scale-[0.98] mb-6",
            result
              ? "bg-emerald-500/20 ring-1 ring-emerald-400/30"
              : "bg-gradient-to-r from-primary to-accent hover:opacity-90 glow"
          )}
        >
          {generating ? (
            <><div className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Plan wird berechnet...</>
          ) : result ? (
            <><CheckCircle2 className="h-5 w-5 text-emerald-400" /> Plan generiert – nochmal berechnen?</>
          ) : (
            <><Sparkles className="h-5 w-5" /> Dienstplan generieren</>
          )}
        </button>

        {/* === RESULT === */}
        {result && (
          <>
            {/* Result Stats */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <GlassCard className="p-4 text-center">
                <p className="text-2xl font-bold text-emerald-400">{result.statistik.besetzt}</p>
                <p className="text-[11px] text-white/40">Besetzt</p>
              </GlassCard>
              <GlassCard className="p-4 text-center">
                <p className="text-2xl font-bold text-white/70">
                  {Math.round((result.statistik.wuenscheErfuellt / result.statistik.besetzt) * 100)}%
                </p>
                <p className="text-[11px] text-white/40">Wunsche erfullt</p>
              </GlassCard>
              <GlassCard className="p-4 text-center">
                <p className="text-2xl font-bold text-amber-400">{result.statistik.erzwungen}</p>
                <p className="text-[11px] text-white/40">Erzwungen</p>
              </GlassCard>
            </div>

            {/* Erzwungene Zuweisungen */}
            {result.statistik.erzwungen > 0 && (
              <GlassCard className="mb-6">
                <h2 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  Erzwungene Einteilungen
                </h2>
                <p className="text-xs text-white/40 mb-4">
                  Diese Personen wurden nach Fairness eingeteilt, obwohl sie lieber frei hatten oder nichts eingetragen haben.
                </p>
                <div className="space-y-2">
                  {result.zuweisungen
                    .filter((z) => z.erzwungen)
                    .map((z, i) => {
                      const dow = new Date(year, month, z.tag).getDay();
                      // Find conflict for this slot
                      const konflikt = result.konflikte.find(
                        (k) => k.tag === z.tag && k.typ === z.typ
                      );
                      return (
                        <button
                          key={i}
                          onClick={() => konflikt && setSelectedKonflikt(konflikt)}
                          className="flex w-full items-center gap-3 rounded-xl bg-amber-500/10 ring-1 ring-amber-400/15 px-4 py-3 text-left transition-glass hover:bg-amber-500/15 active:scale-[0.99]"
                        >
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-sm font-bold text-amber-300">
                            {z.tag}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white/80">
                              {WOCHENTAGE[dow]} – {SCHICHT_LABELS[z.typ]} ({z.von}–{z.bis})
                            </p>
                            <p className="text-xs text-amber-400/60">
                              {z.name} wurde eingeteilt
                            </p>
                          </div>
                          <ChevronDown className="h-4 w-4 text-white/20 -rotate-90" />
                        </button>
                      );
                    })}
                </div>
              </GlassCard>
            )}

            {/* Assignment count per person */}
            <GlassCard className="mb-6">
              <h2 className="text-base font-semibold text-white mb-3">Verteilung</h2>
              <div className="space-y-2">
                {TEAM.map((member) => {
                  const count = result.zuweisungen.filter((z) => z.name === member.name).length;
                  const forced = erzwungenPro[member.name] || 0;
                  const maxCount = Math.max(...TEAM.map((t) => result.zuweisungen.filter((z) => z.name === t.name).length));
                  return (
                    <div key={member.name} className="flex items-center gap-3">
                      <span className="text-sm text-white/60 w-20 shrink-0">{member.name}</span>
                      <div className="flex-1 h-3 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary/30"
                          style={{ width: `${(count / maxCount) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-white/70 w-6 text-right">{count}</span>
                      {forced > 0 && (
                        <span className="text-[10px] text-amber-400/60">({forced}x)</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </GlassCard>

            <a
              href="/dienstplan"
              className="w-full flex items-center justify-center gap-2 rounded-2xl glass py-4 text-base font-semibold text-white transition-glass glass-hover"
            >
              Plan ansehen
            </a>
          </>
        )}

        <div className="h-8" />
      </main>

      {/* === KONFLIKT DETAIL SHEET === */}
      {selectedKonflikt && (() => {
        const currentZ = result?.zuweisungen.find(
          (a) => a.tag === selectedKonflikt.tag && a.typ === selectedKonflikt.typ
        );
        const dow = new Date(year, month, selectedKonflikt.tag).getDay();
        // All people who could potentially take this slot (not "nicht_verfuegbar")
        const swapCandidates = [
          ...selectedKonflikt.verfuegbar.map((n) => ({ name: n, status: "verfuegbar" as const })),
          ...selectedKonflikt.freiWunsch.map((n) => ({ name: n, status: "frei_wunsch" as const })),
        ];

        return (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center"
            onClick={() => setSelectedKonflikt(null)}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div
              className="relative w-full max-w-lg animate-in slide-in-from-bottom duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="glass-strong rounded-t-3xl px-6 pt-4 pb-8 border-t border-white/15 max-h-[85vh] overflow-y-auto">
                <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20" />

                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-white">
                    {WOCHENTAGE[dow]}, {selectedKonflikt.tag}. – {SCHICHT_LABELS[selectedKonflikt.typ]}
                  </h3>
                  <button onClick={() => setSelectedKonflikt(null)} className="rounded-xl p-2 text-white/40 hover:text-white hover:bg-white/10">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <p className="text-sm text-amber-400/80 mb-5">{selectedKonflikt.problem}</p>

                {/* Current assignment with time edit */}
                {currentZ && (
                  <div className="mb-5 rounded-2xl bg-primary/10 ring-1 ring-primary/20 p-4">
                    <p className="text-xs text-white/40 mb-3">Aktuell eingeteilt</p>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-4 w-4 rounded-full" style={{ backgroundColor: DEMO_FARBEN[currentZ.name] }} />
                      <span className="text-base font-semibold text-white flex-1">{currentZ.name}</span>
                      {currentZ.erzwungen && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">Erzwungen</span>
                      )}
                    </div>
                    {/* Time adjust */}
                    <div className="flex items-center gap-2">
                      <select
                        value={currentZ.von}
                        onChange={(e) => {
                          if (!result) return;
                          const updated = result.zuweisungen.map((z) =>
                            z.tag === currentZ.tag && z.typ === currentZ.typ
                              ? { ...z, von: e.target.value }
                              : z
                          );
                          setResult({ ...result, zuweisungen: updated });
                        }}
                        className="flex-1 rounded-lg bg-white/10 border-0 px-2 py-2 text-sm text-white font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50 text-center"
                      >
                        {Array.from({ length: 48 }, (_, i) => {
                          const h = String(Math.floor(i / 2)).padStart(2, "0");
                          const m = i % 2 === 0 ? "00" : "30";
                          return `${h}:${m}`;
                        }).map((z) => (
                          <option key={z} value={z} className="bg-gray-900 text-white">{z}</option>
                        ))}
                      </select>
                      <span className="text-white/20 text-sm">bis</span>
                      <select
                        value={currentZ.bis}
                        onChange={(e) => {
                          if (!result) return;
                          const updated = result.zuweisungen.map((z) =>
                            z.tag === currentZ.tag && z.typ === currentZ.typ
                              ? { ...z, bis: e.target.value }
                              : z
                          );
                          setResult({ ...result, zuweisungen: updated });
                        }}
                        className="flex-1 rounded-lg bg-white/10 border-0 px-2 py-2 text-sm text-white font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50 text-center"
                      >
                        {Array.from({ length: 48 }, (_, i) => {
                          const h = String(Math.floor(i / 2)).padStart(2, "0");
                          const m = i % 2 === 0 ? "00" : "30";
                          return `${h}:${m}`;
                        }).map((z) => (
                          <option key={z} value={z} className="bg-gray-900 text-white">{z}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Swap candidates */}
                {swapCandidates.length > 0 && (
                  <div className="mb-5">
                    <p className="text-xs text-white/40 mb-3">Stattdessen einsetzen – tippe auf eine Person:</p>
                    <div className="space-y-2">
                      {swapCandidates.map(({ name, status }) => {
                        const isCurrent = name === currentZ?.name;
                        return (
                          <button
                            key={name}
                            disabled={isCurrent}
                            onClick={() => {
                              if (!result || !currentZ) return;
                              const updated = result.zuweisungen.map((z) =>
                                z.tag === selectedKonflikt.tag && z.typ === selectedKonflikt.typ
                                  ? { ...z, name, wunschErfuellt: status === "verfuegbar", erzwungen: status !== "verfuegbar" }
                                  : z
                              );
                              const newErzwungen = updated.filter((z) => z.erzwungen).length;
                              const newWunsch = updated.filter((z) => z.wunschErfuellt).length;
                              setResult({
                                ...result,
                                zuweisungen: updated,
                                statistik: {
                                  ...result.statistik,
                                  erzwungen: newErzwungen,
                                  wuenscheErfuellt: newWunsch,
                                },
                              });
                              setSelectedKonflikt(null);
                            }}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-xl px-4 py-3.5 transition-all active:scale-[0.98]",
                              isCurrent
                                ? "bg-primary/15 ring-1 ring-primary/30 opacity-60"
                                : status === "verfuegbar"
                                ? "bg-emerald-500/10 hover:bg-emerald-500/15"
                                : "bg-amber-500/10 hover:bg-amber-500/15"
                            )}
                          >
                            <div className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: DEMO_FARBEN[name] }} />
                            <span className={cn(
                              "text-sm font-medium flex-1 text-left",
                              status === "verfuegbar" ? "text-emerald-300" : "text-amber-300"
                            )}>
                              {name}
                              {isCurrent && <span className="text-[10px] ml-1.5 opacity-50">(aktuell)</span>}
                            </span>
                            <span className="text-[11px] text-white/30">
                              {status === "verfuegbar" ? "Verfugbar" : "Hatte gern frei"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Nicht verfugbar list */}
                {selectedKonflikt.nichtVerfuegbar.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-white/40 mb-2 flex items-center gap-1.5">
                      <UserX className="h-3.5 w-3.5 text-red-400" /> Kann nicht ({selectedKonflikt.nichtVerfuegbar.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedKonflikt.nichtVerfuegbar.map((name) => (
                        <div key={name} className="flex items-center gap-1.5 rounded-lg bg-red-500/8 px-2.5 py-1.5">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: DEMO_FARBEN[name] }} />
                          <span className="text-xs text-red-300/60">{name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
    </AuthGuard>
  );
}
