"use client";

import { AuthGuard } from "@/components/auth-guard";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { NavBar } from "@/components/ui/nav-bar";
import { GlassCard } from "@/components/ui/glass-card";
import { StatCard } from "@/components/ui/stat-card";
import {
  solveDienstplan,
  type PersonWunsch,
  type SolverResult,
  type SolverKonflikt,
} from "@/lib/solver";
import {
  getTeam,
  getWuensche,
  saveDienstplan,
  saveZuweisungenMitSlots,
  getDienstplan,
  getFeiertage,
} from "@/lib/api";
import {
  SCHICHT_LABELS,
  type SchichtTyp,
  type Hebamme,
  type Wunsch,
  type Feiertag,
} from "@/lib/types";
import {
  Shield,
  ClipboardList,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  UserX,
  TrendingUp,
  Printer,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const MONATE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];
const WOCHENTAGE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

function getInitialMonth() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export default function AdminPage() {
  const { isAdmin, isLoading } = useAuth();
  const router = useRouter();

  const init = getInitialMonth();
  const [year, setYear] = useState(init.year);
  const [month, setMonth] = useState(init.month);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monatKey = `${year}-${String(month + 1).padStart(2, "0")}`;

  const [team, setTeam] = useState<Hebamme[]>([]);
  const [allWuensche, setAllWuensche] = useState<Wunsch[]>([]);
  const [feiertage, setFeiertage] = useState<Feiertag[]>([]);
  const [planStatus, setPlanStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [result, setResult] = useState<SolverResult | null>(null);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [selectedKonflikt, setSelectedKonflikt] = useState<SolverKonflikt | null>(null);
  const [drillMember, setDrillMember] = useState<Hebamme | null>(null);

  useEffect(() => {
    if (!isLoading && !isAdmin) router.replace("/");
  }, [isAdmin, isLoading, router]);

  useEffect(() => {
    setLoading(true);
    setResult(null);
    Promise.all([
      getTeam(),
      getWuensche(monatKey),
      getFeiertage(year),
      getDienstplan(monatKey),
    ])
      .then(([t, w, f, p]) => {
        setTeam(t);
        setAllWuensche(w);
        setFeiertage(f);
        setPlanStatus(p?.status ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [monatKey, year]);

  const feiertageSet = useMemo(() => {
    const set = new Set<string>();
    for (const f of feiertage) {
      if (f.typ === "feiertag" && f.datum.startsWith(monatKey)) {
        set.add(f.datum.slice(0, 10));
      }
    }
    return set;
  }, [feiertage, monatKey]);

  const memberStatus = team.map((member) => {
    const wishes = allWuensche.filter((w) => w.hebamme === member.id);
    const abgegeben = wishes.length > 0;
    let verfuegbar = 0, frei = 0, nicht = 0;
    for (const w of wishes) {
      if (w.ist_urlaub || w.frei_wunsch === "wichtig") nicht++;
      else if (w.frei_wunsch === "waere_schoen") frei++;
      else if ((w.dienste_json && w.dienste_json.length > 0) || (w.verfuegbar_fuer && w.verfuegbar_fuer.length > 0)) verfuegbar++;
    }
    return { ...member, abgegeben, verfuegbar, frei, nicht };
  });

  const abgegeben = memberStatus.filter((m) => m.abgegeben).length;
  const offen = team.length - abgegeben;

  const isAnmeldungTag = (day: number) => {
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (feiertageSet.has(dateKey)) return false;
    const dow = new Date(year, month, day).getDay();
    return dow === 2 || dow === 5;
  };

  const isFeiertag = (day: number) => {
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return feiertageSet.has(dateKey);
  };

  const handleGenerate = () => {
    setGenerating(true);

    const wuenscheMap: Record<string, Record<number, PersonWunsch>> = {};
    for (const member of team) {
      wuenscheMap[member.vorname] = {};
      for (let d = 1; d <= daysInMonth; d++) {
        wuenscheMap[member.vorname][d] = {
          name: member.vorname,
          status: "leer",
          dienste: [],
          fairnessScore: member.fairness_score || 50,
          settings: member.settings || {},
        };
      }
    }

    for (const w of allWuensche) {
      const member = team.find((m) => m.id === w.hebamme);
      if (!member) continue;
      const d = new Date(w.datum).getDate();
      if (!wuenscheMap[member.vorname]) continue;

      let status: PersonWunsch["status"] = "leer";
      if (w.ist_urlaub) status = "urlaub";
      else if (w.frei_wunsch === "wichtig") status = "frei_wichtig";
      else if (w.frei_wunsch === "waere_schoen") status = "frei_schoen";
      else if ((w.dienste_json && w.dienste_json.length > 0) || (w.verfuegbar_fuer && w.verfuegbar_fuer.length > 0)) status = "verfuegbar";

      const dienste = w.dienste_json && w.dienste_json.length > 0
        ? w.dienste_json
        : (w.verfuegbar_fuer || [])
            .filter((t) => t !== "alle")
            .map((t) => ({
              typ: t as SchichtTyp,
              zeit_von: w.zeit_von || "",
              zeit_bis: w.zeit_bis || "",
            }));

      wuenscheMap[member.vorname][d] = {
        name: member.vorname,
        status,
        dienste: dienste.map((dn) => ({ typ: dn.typ, zeit_von: dn.zeit_von, zeit_bis: dn.zeit_bis })),
        fairnessScore: member.fairness_score || 50,
        settings: member.settings || {},
      };
    }

    setTimeout(() => {
      const solverResult = solveDienstplan(
        year, month,
        wuenscheMap,
        team.map((t) => t.vorname),
        isAnmeldungTag,
        isFeiertag
      );
      setResult(solverResult);
      setGenerating(false);

      saveDienstplan({
        monat: monatKey,
        status: "generiert",
        generiert_am: new Date().toISOString(),
        statistik: solverResult.statistik as Record<string, unknown>,
      }).catch(() => {});
    }, 600);
  };

  const handlePersistAndRelease = async (releaseToAll: boolean) => {
    if (!result) return;
    setSavingPlan(true);
    try {
      const namensMap: Record<string, string> = {};
      for (const m of team) namensMap[m.vorname] = m.id;

      const eintraege = result.zuweisungen.map((z) => ({
        datum: `${year}-${String(month + 1).padStart(2, "0")}-${String(z.tag).padStart(2, "0")} 00:00:00.000Z`,
        typ: z.typ,
        hebammeId: namensMap[z.name] || "",
        zeit_von: z.von,
        zeit_bis: z.bis,
        wunsch_erfuellt: z.wunschErfuellt,
        manuell_geaendert: false,
        ist_feiertag: isFeiertag(z.tag),
      })).filter((e) => e.hebammeId);

      await saveZuweisungenMitSlots(monatKey, eintraege);
      await saveDienstplan({
        monat: monatKey,
        status: releaseToAll ? "freigegeben" : "generiert",
        generiert_am: new Date().toISOString(),
        ...(releaseToAll ? { freigegeben_am: new Date().toISOString() } : {}),
        statistik: result.statistik as Record<string, unknown>,
      });
      setPlanStatus(releaseToAll ? "freigegeben" : "generiert");
      if (releaseToAll) alert("Dienstplan freigegeben! Hebammen können ihn jetzt sehen.");
      else alert("Dienstplan gespeichert (Entwurf).");
    } finally {
      setSavingPlan(false);
    }
  };

  const erzwungenPro = result
    ? result.zuweisungen
        .filter((z) => z.erzwungen)
        .reduce((acc, z) => { acc[z.name] = (acc[z.name] || 0) + 1; return acc; }, {} as Record<string, number>)
    : {};

  const farbenMap: Record<string, string> = {};
  for (const m of team) { farbenMap[m.vorname] = m.farbe || "#666"; }

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };

  if (!isAdmin) return null;

  return (
    <AuthGuard>
    <div className="flex min-h-screen flex-col">
      <NavBar />
      <main className="flex-1 mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-amber-400" />
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Admin</h1>
              <p className="text-sm text-white/50">{MONATE[month]} {year}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="rounded-lg p-2 text-white/50 hover:text-white hover:bg-white/5"><ChevronLeft className="h-5 w-5" /></button>
            <button onClick={nextMonth} className="rounded-lg p-2 text-white/50 hover:text-white hover:bg-white/5"><ChevronRight className="h-5 w-5" /></button>
          </div>
        </div>

        {planStatus && (
          <div className={cn(
            "mb-4 rounded-xl px-4 py-2.5 text-sm flex items-center gap-2",
            planStatus === "freigegeben" ? "bg-emerald-500/15 ring-1 ring-emerald-400/30 text-emerald-300"
              : planStatus === "generiert" ? "bg-amber-500/15 ring-1 ring-amber-400/30 text-amber-300"
              : "bg-white/5 text-white/40"
          )}>
            <div className={cn(
              "h-2 w-2 rounded-full",
              planStatus === "freigegeben" ? "bg-emerald-400" : planStatus === "generiert" ? "bg-amber-400" : "bg-white/30"
            )} />
            Plan-Status: {planStatus === "freigegeben" ? "Freigegeben" : planStatus === "generiert" ? "Entwurf (nur Admin sichtbar)" : planStatus}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <StatCard label="Abgegeben" value={`${abgegeben}/${team.length}`} icon={ClipboardList}
                trend={offen > 0 ? `${offen} fehlen noch` : "Alle da!"} />
              <StatCard label="Fairness" value={`${Math.round(team.reduce((s, t) => s + (t.fairness_score || 50), 0) / (team.length || 1))}%`} icon={TrendingUp} />
            </div>

            <GlassCard className="mb-6">
              <h2 className="text-base font-semibold text-white mb-4">Wunschpläne</h2>
              <div className="space-y-1">
                {memberStatus.map((member) => (
                  <div key={member.id}>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setExpandedMember(expandedMember === member.id ? null : member.id)}
                        className="flex flex-1 items-center gap-3 rounded-xl px-3 py-2.5 transition-glass hover:bg-white/5 active:scale-[0.99]"
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
                      {member.abgegeben && (
                        <button
                          onClick={() => setDrillMember(member)}
                          className="rounded-lg p-2 text-white/30 hover:text-white hover:bg-white/5"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {expandedMember === member.id && member.abgegeben && (
                      <div className="ml-8 mr-3 mb-2 rounded-xl bg-white/3 p-3">
                        <div className="grid grid-cols-4 gap-2 text-center text-xs">
                          <div><p className="text-lg font-bold text-emerald-400">{member.verfuegbar}</p><p className="text-white/30">Verfügbar</p></div>
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

            {result && (
              <>
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <GlassCard className="p-4 text-center">
                    <p className="text-2xl font-bold text-emerald-400">{result.statistik.besetzt}</p>
                    <p className="text-[11px] text-white/40">Besetzt</p>
                  </GlassCard>
                  <GlassCard className="p-4 text-center">
                    <p className="text-2xl font-bold text-white/70">{result.statistik.besetzt > 0 ? Math.round((result.statistik.wuenscheErfuellt / result.statistik.besetzt) * 100) : 0}%</p>
                    <p className="text-[11px] text-white/40">Wünsche erfüllt</p>
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
                            className={cn(
                              "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-glass active:scale-[0.99]",
                              konflikt?.schwere === "rot"
                                ? "bg-red-500/10 ring-1 ring-red-400/15 hover:bg-red-500/15"
                                : "bg-amber-500/10 ring-1 ring-amber-400/15 hover:bg-amber-500/15"
                            )}
                          >
                            <div className={cn(
                              "flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold",
                              konflikt?.schwere === "rot" ? "bg-red-500/15 text-red-300" : "bg-amber-500/15 text-amber-300"
                            )}>{z.tag}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white/80">{WOCHENTAGE[dow]} – {SCHICHT_LABELS[z.typ]} ({z.von}–{z.bis})</p>
                              <p className={cn("text-xs", konflikt?.schwere === "rot" ? "text-red-400/60" : "text-amber-400/60")}>{z.name} wurde eingeteilt</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </GlassCard>
                )}

                <GlassCard className="mb-6">
                  <h2 className="text-base font-semibold text-white mb-3">Verteilung</h2>
                  <div className="space-y-2">
                    {team.map((member) => {
                      const count = result.zuweisungen.filter((z) => z.name === member.vorname).length;
                      const forced = erzwungenPro[member.vorname] || 0;
                      const we = result.statistik.weVerteilung[member.vorname] || 0;
                      const maxCount = Math.max(...team.map((t) => result.zuweisungen.filter((z) => z.name === t.vorname).length), 1);
                      return (
                        <div key={member.id} className="flex items-center gap-3">
                          <span className="text-sm text-white/60 w-20 shrink-0">{member.vorname}</span>
                          <div className="flex-1 h-3 rounded-full bg-white/5 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary/30" style={{ width: `${(count / maxCount) * 100}%` }} />
                          </div>
                          <span className="text-sm font-medium text-white/70 w-6 text-right">{count}</span>
                          <span className="text-[10px] text-white/30 w-10 text-right">WE: {we}</span>
                          {forced > 0 && <span className="text-[10px] text-amber-400/60 w-8 text-right">({forced}x)</span>}
                        </div>
                      );
                    })}
                  </div>
                </GlassCard>

                <div className="space-y-3 mb-8">
                  <a href="/dienstplan" className="w-full flex items-center justify-center gap-2 rounded-2xl glass py-4 text-base font-semibold text-white transition-glass glass-hover">
                    Plan ansehen
                  </a>
                  <button
                    onClick={() => handlePersistAndRelease(false)}
                    disabled={savingPlan}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl bg-white/8 ring-1 ring-white/15 py-4 text-base font-semibold text-white/80 transition-glass hover:bg-white/12 active:scale-[0.98]"
                  >
                    Als Entwurf speichern
                  </button>
                  <button
                    onClick={() => handlePersistAndRelease(true)}
                    disabled={savingPlan}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500/30 to-emerald-600/30 ring-1 ring-emerald-400/30 py-4 text-base font-bold text-emerald-300 transition-glass hover:from-emerald-500/40 hover:to-emerald-600/40 active:scale-[0.98]"
                  >
                    {savingPlan ? (
                      <><div className="h-5 w-5 rounded-full border-2 border-emerald-300/40 border-t-emerald-300 animate-spin" /> Wird gespeichert...</>
                    ) : (
                      <><CheckCircle2 className="h-5 w-5" /> Speichern & für alle freigeben</>
                    )}
                  </button>
                  <button
                    onClick={() => exportPDF(result, year, month)}
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

      {selectedKonflikt && (() => {
        const currentZ = result?.zuweisungen.find((a) => a.tag === selectedKonflikt.tag && a.typ === selectedKonflikt.typ);
        const dow = new Date(year, month, selectedKonflikt.tag).getDay();
        const swapCandidates = [
          ...selectedKonflikt.verfuegbar.map((n) => ({ name: n, status: "verfuegbar" as const })),
          ...selectedKonflikt.freiSchoen.map((n) => ({ name: n, status: "frei_schoen" as const })),
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
                            <span className="text-[11px] text-white/30">{status === "verfuegbar" ? "Verfügbar" : "Hätte gern frei"}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {(selectedKonflikt.urlaub.length > 0 || selectedKonflikt.freiWichtig.length > 0) && (
                  <div className="mb-3">
                    <p className="text-xs text-white/40 mb-2 flex items-center gap-1.5"><UserX className="h-3.5 w-3.5 text-red-400" /> Kann/will nicht ({selectedKonflikt.urlaub.length + selectedKonflikt.freiWichtig.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {[...selectedKonflikt.urlaub, ...selectedKonflikt.freiWichtig].map((name) => (
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

      {drillMember && (
        <DrillSheet
          member={drillMember}
          wuensche={allWuensche.filter((w) => w.hebamme === drillMember.id)}
          year={year}
          month={month}
          onClose={() => setDrillMember(null)}
        />
      )}
    </div>
    </AuthGuard>
  );
}

function DrillSheet({
  member,
  wuensche,
  year,
  month,
  onClose,
}: {
  member: Hebamme;
  wuensche: Wunsch[];
  year: number;
  month: number;
  onClose: () => void;
}) {
  const daysInM = new Date(year, month + 1, 0).getDate();
  const wuenscheByDay: Record<number, Wunsch> = {};
  for (const w of wuensche) {
    wuenscheByDay[new Date(w.datum).getDate()] = w;
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg animate-in slide-in-from-bottom duration-300" onClick={(e) => e.stopPropagation()}>
        <div className="glass-strong rounded-t-3xl px-6 pt-4 pb-8 border-t border-white/15 max-h-[88vh] overflow-y-auto">
          <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20" />
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ backgroundColor: (member.farbe || "#666") + "30" }}>{member.vorname[0]}</div>
              <div>
                <h3 className="text-lg font-bold text-white">{member.vorname}</h3>
                <p className="text-xs text-white/40">Wunschplan im Detail</p>
              </div>
            </div>
            <button onClick={onClose} className="rounded-xl p-2 text-white/40 hover:text-white hover:bg-white/10"><X className="h-5 w-5" /></button>
          </div>
          <div className="space-y-1">
            {Array.from({ length: daysInM }).map((_, i) => {
              const d = i + 1;
              const w = wuenscheByDay[d];
              const dow = new Date(year, month, d).getDay();
              const dowLabel = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][dow];

              let label = "—";
              let cls = "text-white/25";
              if (w) {
                if (w.ist_urlaub) { label = "Urlaub"; cls = "text-blue-300"; }
                else if (w.frei_wunsch === "wichtig") { label = "Wichtig frei"; cls = "text-orange-300"; }
                else if (w.frei_wunsch === "waere_schoen") { label = "Schön frei"; cls = "text-amber-300"; }
                else {
                  const dn = w.dienste_json && w.dienste_json.length > 0 ? w.dienste_json : null;
                  if (dn) {
                    label = dn.map((x) => `${SCHICHT_LABELS[x.typ]} ${x.zeit_von}–${x.zeit_bis}`).join(", ");
                  } else if (w.verfuegbar_fuer && w.verfuegbar_fuer.length > 0) {
                    label = w.verfuegbar_fuer.join(", ");
                  } else {
                    label = "Verfügbar";
                  }
                  cls = "text-emerald-300";
                }
              }

              return (
                <div key={d} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2">
                  <span className="text-xs text-white/40 font-mono w-12 shrink-0">{dowLabel} {d}.</span>
                  <span className={cn("text-sm flex-1 truncate", cls)}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function exportPDF(result: SolverResult, year: number, month: number) {
  const WOCHE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFontSize(16);
  doc.text(`Dienstplan ${MONATE[month]} ${year}`, 14, 15);
  doc.setFontSize(8);
  doc.text(`Erstellt am ${new Date().toLocaleDateString("de-DE")}`, 14, 20);

  const days: Record<number, Record<string, { name: string; von: string; bis: string }>> = {};
  for (const z of result.zuweisungen) {
    if (!days[z.tag]) days[z.tag] = {};
    days[z.tag][z.typ] = { name: z.name, von: z.von, bis: z.bis };
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
}
