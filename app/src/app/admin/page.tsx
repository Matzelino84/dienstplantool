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
import { getTeam, getWuensche, saveDienstplan } from "@/lib/api";
import { SCHICHT_LABELS, type SchichtTyp, type Hebamme, type Wunsch } from "@/lib/types";
import {
  Shield,
  ClipboardList,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  ChevronDown,
  X,
  UserCheck,
  UserX,
  Heart,
  TrendingUp,
  Printer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const MONATE = [
  "Januar", "Februar", "Marz", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];
const WOCHENTAGE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

export default function AdminPage() {
  const { isAdmin, isLoading } = useAuth();
  const router = useRouter();

  const now = new Date();
  const [year] = useState(now.getFullYear());
  const [month] = useState(now.getMonth() + 1 > 11 ? 0 : now.getMonth() + 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monatKey = `${year}-${String(month + 1).padStart(2, "0")}`;

  const [team, setTeam] = useState<Hebamme[]>([]);
  const [allWuensche, setAllWuensche] = useState<Wunsch[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<SolverResult | null>(null);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [selectedKonflikt, setSelectedKonflikt] = useState<SolverKonflikt | null>(null);

  useEffect(() => {
    if (!isLoading && !isAdmin) router.replace("/");
  }, [isAdmin, isLoading, router]);

  // Load team + wishes
  useEffect(() => {
    Promise.all([getTeam(), getWuensche(monatKey)])
      .then(([t, w]) => { setTeam(t); setAllWuensche(w); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [monatKey]);

  // Build member status from real data
  const memberStatus = team.map((member) => {
    const wishes = allWuensche.filter((w) => w.hebamme === member.id);
    const abgegeben = wishes.length > 0;
    let verfuegbar = 0, frei = 0, nicht = 0;
    for (const w of wishes) {
      if (w.ist_urlaub || w.frei_wunsch === "wichtig") nicht++;
      else if (w.frei_wunsch === "waere_schoen") frei++;
      else if (w.verfuegbar_fuer?.length > 0) verfuegbar++;
    }
    return { ...member, abgegeben, verfuegbar, frei, nicht };
  });

  const abgegeben = memberStatus.filter((m) => m.abgegeben).length;
  const offen = team.length - abgegeben;

  const isAnmeldungTag = (day: number) => {
    const dow = new Date(year, month, day).getDay();
    return dow === 2 || dow === 5;
  };

  const handleGenerate = () => {
    setGenerating(true);

    // Build solver input from real wishes
    const wuenscheMap: Record<string, Record<number, PersonWunsch>> = {};
    for (const member of team) {
      wuenscheMap[member.vorname] = {};
      for (let d = 1; d <= daysInMonth; d++) {
        wuenscheMap[member.vorname][d] = {
          name: member.vorname,
          status: "leer",
          dienstTypen: [],
          fairnessScore: member.fairness_score || 50,
        };
      }
    }

    for (const w of allWuensche) {
      const member = team.find((m) => m.id === w.hebamme);
      if (!member) continue;
      const d = new Date(w.datum).getDate();
      if (!wuenscheMap[member.vorname]) continue;

      let status: PersonWunsch["status"] = "leer";
      if (w.ist_urlaub || w.frei_wunsch === "wichtig") status = "nicht_verfuegbar";
      else if (w.frei_wunsch === "waere_schoen") status = "frei_wunsch";
      else if (w.verfuegbar_fuer?.length > 0) status = "verfuegbar";

      wuenscheMap[member.vorname][d] = {
        name: member.vorname,
        status,
        dienstTypen: (w.verfuegbar_fuer || []) as SchichtTyp[],
        von: w.zeit_von || undefined,
        bis: w.zeit_bis || undefined,
        fairnessScore: member.fairness_score || 50,
      };
    }

    setTimeout(() => {
      const solverResult = solveDienstplan(
        year, month,
        wuenscheMap,
        team.map((t) => t.vorname),
        isAnmeldungTag
      );
      setResult(solverResult);
      setGenerating(false);

      // Save to PocketBase
      saveDienstplan({
        monat: monatKey,
        status: "generiert",
        generiert_am: new Date().toISOString(),
        statistik: solverResult.statistik as Record<string, unknown>,
      }).catch(() => {});
    }, 1000);
  };

  const erzwungenPro = result
    ? result.zuweisungen
        .filter((z) => z.erzwungen)
        .reduce((acc, z) => { acc[z.name] = (acc[z.name] || 0) + 1; return acc; }, {} as Record<string, number>)
    : {};

  const farbenMap: Record<string, string> = {};
  for (const m of team) { farbenMap[m.vorname] = m.farbe || "#666"; }

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

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <StatCard label="Abgegeben" value={`${abgegeben}/${team.length}`} icon={ClipboardList}
                trend={offen > 0 ? `${offen} fehlen noch` : "Alle da!"} />
              <StatCard label="Fairness" value={`${Math.round(team.reduce((s, t) => s + (t.fairness_score || 50), 0) / (team.length || 1))}%`} icon={TrendingUp} />
            </div>

            {/* Team Wunschplane */}
            <GlassCard className="mb-6">
              <h2 className="text-base font-semibold text-white mb-4">Wunschplane</h2>
              <div className="space-y-1">
                {memberStatus.map((member) => (
                  <div key={member.id}>
                    <button
                      onClick={() => setExpandedMember(expandedMember === member.id ? null : member.id)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-glass hover:bg-white/5 active:scale-[0.99]"
                    >
                      <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", member.abgegeben ? "bg-emerald-400" : "bg-red-400")} />
                      <span className="text-sm font-medium text-white/80 flex-1 text-left">{member.vorname}</span>
                      {member.abgegeben ? (
                        <div className="flex items-center gap-3 text-xs text-white/40">
                          <span className="text-emerald-400/60">{member.verfuegbar}</span>
                          <span className="text-amber-400/60">{member.frei}</span>
                          <span className="text-red-400/60">{member.nicht}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-red-400/60">Fehlt</span>
                      )}
                      <ChevronDown className={cn("h-4 w-4 text-white/20 transition-transform", expandedMember === member.id && "rotate-180")} />
                    </button>
                    {expandedMember === member.id && member.abgegeben && (
                      <div className="ml-8 mr-3 mb-2 rounded-xl bg-white/3 p-3">
                        <div className="grid grid-cols-4 gap-2 text-center text-xs">
                          <div><p className="text-lg font-bold text-emerald-400">{member.verfuegbar}</p><p className="text-white/30">Verfugbar</p></div>
                          <div><p className="text-lg font-bold text-amber-400">{member.frei}</p><p className="text-white/30">Lieber frei</p></div>
                          <div><p className="text-lg font-bold text-red-400">{member.nicht}</p><p className="text-white/30">Kann nicht</p></div>
                          <div><p className="text-lg font-bold text-white/60">{member.fairness_score}%</p><p className="text-white/30">Fairness</p></div>
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
                result ? "bg-emerald-500/20 ring-1 ring-emerald-400/30" : "bg-gradient-to-r from-primary to-accent hover:opacity-90 glow"
              )}
            >
              {generating ? (
                <><div className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Plan wird berechnet...</>
              ) : result ? (
                <><CheckCircle2 className="h-5 w-5 text-emerald-400" /> Nochmal berechnen</>
              ) : (
                <><Sparkles className="h-5 w-5" /> Dienstplan generieren</>
              )}
            </button>

            {/* Result */}
            {result && (
              <>
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <GlassCard className="p-4 text-center">
                    <p className="text-2xl font-bold text-emerald-400">{result.statistik.besetzt}</p>
                    <p className="text-[11px] text-white/40">Besetzt</p>
                  </GlassCard>
                  <GlassCard className="p-4 text-center">
                    <p className="text-2xl font-bold text-white/70">{Math.round((result.statistik.wuenscheErfuellt / result.statistik.besetzt) * 100)}%</p>
                    <p className="text-[11px] text-white/40">Wunsche erfullt</p>
                  </GlassCard>
                  <GlassCard className="p-4 text-center">
                    <p className="text-2xl font-bold text-amber-400">{result.statistik.erzwungen}</p>
                    <p className="text-[11px] text-white/40">Erzwungen</p>
                  </GlassCard>
                </div>

                {result.statistik.erzwungen > 0 && (
                  <GlassCard className="mb-6">
                    <h2 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                      Erzwungene Einteilungen
                    </h2>
                    <div className="space-y-2">
                      {result.zuweisungen.filter((z) => z.erzwungen).map((z, i) => {
                        const dow = new Date(year, month, z.tag).getDay();
                        const konflikt = result.konflikte.find((k) => k.tag === z.tag && k.typ === z.typ);
                        return (
                          <button key={i} onClick={() => konflikt && setSelectedKonflikt(konflikt)}
                            className="flex w-full items-center gap-3 rounded-xl bg-amber-500/10 ring-1 ring-amber-400/15 px-4 py-3 text-left transition-glass hover:bg-amber-500/15 active:scale-[0.99]">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-sm font-bold text-amber-300">{z.tag}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white/80">{WOCHENTAGE[dow]} – {SCHICHT_LABELS[z.typ]} ({z.von}–{z.bis})</p>
                              <p className="text-xs text-amber-400/60">{z.name} wurde eingeteilt</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </GlassCard>
                )}

                {/* Verteilung */}
                <GlassCard className="mb-6">
                  <h2 className="text-base font-semibold text-white mb-3">Verteilung</h2>
                  <div className="space-y-2">
                    {team.map((member) => {
                      const count = result.zuweisungen.filter((z) => z.name === member.vorname).length;
                      const forced = erzwungenPro[member.vorname] || 0;
                      const maxCount = Math.max(...team.map((t) => result.zuweisungen.filter((z) => z.name === t.vorname).length), 1);
                      return (
                        <div key={member.id} className="flex items-center gap-3">
                          <span className="text-sm text-white/60 w-20 shrink-0">{member.vorname}</span>
                          <div className="flex-1 h-3 rounded-full bg-white/5 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary/30" style={{ width: `${(count / maxCount) * 100}%` }} />
                          </div>
                          <span className="text-sm font-medium text-white/70 w-6 text-right">{count}</span>
                          {forced > 0 && <span className="text-[10px] text-amber-400/60">({forced}x)</span>}
                        </div>
                      );
                    })}
                  </div>
                </GlassCard>

                <div className="space-y-3">
                  <a href="/dienstplan" className="w-full flex items-center justify-center gap-2 rounded-2xl glass py-4 text-base font-semibold text-white transition-glass glass-hover">
                    Plan ansehen
                  </a>
                  <button
                    onClick={async () => {
                      await saveDienstplan({ monat: monatKey, status: "freigegeben", freigegeben_am: new Date().toISOString() });
                      alert("Dienstplan freigegeben! Hebammen konnen ihn jetzt sehen.");
                    }}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500/30 to-emerald-600/30 ring-1 ring-emerald-400/30 py-4 text-base font-bold text-emerald-300 transition-glass hover:from-emerald-500/40 hover:to-emerald-600/40 active:scale-[0.98]"
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    Fur alle freigeben
                  </button>
                  <button
                    onClick={() => {
                      if (!result) return;
                      const WOCHE = ["So","Mo","Di","Mi","Do","Fr","Sa"];
                      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

                      doc.setFontSize(16);
                      doc.text(`Dienstplan ${MONATE[month]} ${year}`, 14, 15);
                      doc.setFontSize(8);
                      doc.text(`Erstellt am ${new Date().toLocaleDateString("de-DE")}`, 14, 20);

                      const days: Record<number, Record<string, {name:string;von:string;bis:string}>> = {};
                      for (const z of result.zuweisungen) {
                        if (!days[z.tag]) days[z.tag] = {};
                        days[z.tag][z.typ] = {name: z.name, von: z.von, bis: z.bis};
                      }

                      const dim = new Date(year, month + 1, 0).getDate();
                      const rows: string[][] = [];
                      for (let d = 1; d <= dim; d++) {
                        const dow = WOCHE[new Date(year, month, d).getDay()];
                        const r = days[d] || {};
                        const cell = (t: string) => {
                          if (!r[t]) return "";
                          return `${r[t].name}\n${r[t].von}–${r[t].bis}`;
                        };
                        rows.push([`${dow} ${d}.`, cell("tagdienst"), cell("bd_tag"), cell("bd_nacht"), cell("nachtdienst"), cell("anmeldung")]);
                      }

                      autoTable(doc, {
                        startY: 24,
                        head: [["Tag", "Tagdienst", "BD Tag", "BD Nacht", "Nachtdienst", "Anmeldung"]],
                        body: rows,
                        theme: "grid",
                        styles: { fontSize: 7, cellPadding: 1.5, lineWidth: 0.1 },
                        headStyles: { fillColor: [80, 80, 120], fontSize: 8, fontStyle: "bold" },
                        columnStyles: {
                          0: { cellWidth: 18, fontStyle: "bold" },
                          1: { cellWidth: 42 },
                          2: { cellWidth: 42 },
                          3: { cellWidth: 42 },
                          4: { cellWidth: 42 },
                          5: { cellWidth: 42 },
                        },
                        alternateRowStyles: { fillColor: [245, 245, 250] },
                      });

                      doc.save(`Dienstplan_${MONATE[month]}_${year}.pdf`);
                    }}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl glass py-4 text-base font-semibold text-white/70 transition-glass glass-hover active:scale-[0.98]"
                  >
                    <Printer className="h-5 w-5" />
                    PDF herunterladen
                  </button>
                </div>
              </>
            )}
          </>
        )}

        <div className="h-8" />
      </main>

      {/* Konflikt Detail Sheet */}
      {selectedKonflikt && (() => {
        const currentZ = result?.zuweisungen.find((a) => a.tag === selectedKonflikt.tag && a.typ === selectedKonflikt.typ);
        const dow = new Date(year, month, selectedKonflikt.tag).getDay();
        const swapCandidates = [
          ...selectedKonflikt.verfuegbar.map((n) => ({ name: n, status: "verfuegbar" as const })),
          ...selectedKonflikt.freiWunsch.map((n) => ({ name: n, status: "frei_wunsch" as const })),
        ];
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setSelectedKonflikt(null)}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative w-full max-w-lg animate-in slide-in-from-bottom duration-300" onClick={(e) => e.stopPropagation()}>
              <div className="glass-strong rounded-t-3xl px-6 pt-4 pb-8 border-t border-white/15 max-h-[85vh] overflow-y-auto">
                <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20" />
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-white">{WOCHENTAGE[dow]}, {selectedKonflikt.tag}. – {SCHICHT_LABELS[selectedKonflikt.typ]}</h3>
                  <button onClick={() => setSelectedKonflikt(null)} className="rounded-xl p-2 text-white/40 hover:text-white hover:bg-white/10"><X className="h-5 w-5" /></button>
                </div>
                <p className="text-sm text-amber-400/80 mb-5">{selectedKonflikt.problem}</p>

                {currentZ && (
                  <div className="mb-5 rounded-2xl bg-primary/10 ring-1 ring-primary/20 p-4">
                    <p className="text-xs text-white/40 mb-3">Aktuell eingeteilt</p>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-4 w-4 rounded-full" style={{ backgroundColor: farbenMap[currentZ.name] }} />
                      <span className="text-base font-semibold text-white flex-1">{currentZ.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <select value={currentZ.von} onChange={(e) => {
                        if (!result) return;
                        setResult({ ...result, zuweisungen: result.zuweisungen.map((z) => z.tag === currentZ.tag && z.typ === currentZ.typ ? { ...z, von: e.target.value } : z) });
                      }} className="flex-1 rounded-lg bg-white/10 border-0 px-2 py-2 text-sm text-white font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50 text-center">
                        {Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i/2)).padStart(2,"0")}:${i%2===0?"00":"30"}`).map((z) => <option key={z} value={z} className="bg-gray-900 text-white">{z}</option>)}
                      </select>
                      <span className="text-white/20 text-sm">bis</span>
                      <select value={currentZ.bis} onChange={(e) => {
                        if (!result) return;
                        setResult({ ...result, zuweisungen: result.zuweisungen.map((z) => z.tag === currentZ.tag && z.typ === currentZ.typ ? { ...z, bis: e.target.value } : z) });
                      }} className="flex-1 rounded-lg bg-white/10 border-0 px-2 py-2 text-sm text-white font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50 text-center">
                        {Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i/2)).padStart(2,"0")}:${i%2===0?"00":"30"}`).map((z) => <option key={z} value={z} className="bg-gray-900 text-white">{z}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {swapCandidates.length > 0 && (
                  <div className="mb-5">
                    <p className="text-xs text-white/40 mb-3">Stattdessen einsetzen:</p>
                    <div className="space-y-2">
                      {swapCandidates.map(({ name, status }) => {
                        const isCurrent = name === currentZ?.name;
                        return (
                          <button key={name} disabled={isCurrent} onClick={() => {
                            if (!result || !currentZ) return;
                            const updated = result.zuweisungen.map((z) => z.tag === selectedKonflikt.tag && z.typ === selectedKonflikt.typ ? { ...z, name, wunschErfuellt: status === "verfuegbar", erzwungen: status !== "verfuegbar" } : z);
                            setResult({ ...result, zuweisungen: updated, statistik: { ...result.statistik, erzwungen: updated.filter((z) => z.erzwungen).length, wuenscheErfuellt: updated.filter((z) => z.wunschErfuellt).length } });
                            setSelectedKonflikt(null);
                          }} className={cn("flex w-full items-center gap-3 rounded-xl px-4 py-3.5 transition-all active:scale-[0.98]",
                            isCurrent ? "bg-primary/15 ring-1 ring-primary/30 opacity-60" : status === "verfuegbar" ? "bg-emerald-500/10 hover:bg-emerald-500/15" : "bg-amber-500/10 hover:bg-amber-500/15"
                          )}>
                            <div className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: farbenMap[name] }} />
                            <span className={cn("text-sm font-medium flex-1 text-left", status === "verfuegbar" ? "text-emerald-300" : "text-amber-300")}>{name}</span>
                            <span className="text-[11px] text-white/30">{status === "verfuegbar" ? "Verfugbar" : "Hatte gern frei"}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selectedKonflikt.nichtVerfuegbar.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-white/40 mb-2 flex items-center gap-1.5"><UserX className="h-3.5 w-3.5 text-red-400" /> Kann nicht ({selectedKonflikt.nichtVerfuegbar.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedKonflikt.nichtVerfuegbar.map((name) => (
                        <div key={name} className="flex items-center gap-1.5 rounded-lg bg-red-500/8 px-2.5 py-1.5">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: farbenMap[name] }} />
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
