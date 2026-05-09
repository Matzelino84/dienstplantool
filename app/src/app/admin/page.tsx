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
  updateZuweisung,
  deleteZuweisung,
  createZuweisung,
  getDienstplan,
  getZuweisungen,
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
  Trash2,
  Sun,
  Moon,
  Clock,
  FileText,
  type LucideIcon,
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
  const [zuweisungIdMap, setZuweisungIdMap] = useState<Record<string, string>>({});
  const [slotIdMap, setSlotIdMap] = useState<Record<string, string>>({});
  const [editPersistError, setEditPersistError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAdmin) router.replace("/");
  }, [isAdmin, isLoading, router]);

  useEffect(() => {
    setLoading(true);
    setResult(null);
    setZuweisungIdMap({});
    setSlotIdMap({});
    Promise.all([
      getTeam(),
      getWuensche(monatKey),
      getFeiertage(year),
      getDienstplan(monatKey),
      getZuweisungen(monatKey),
    ])
      .then(([t, w, f, p, zList]) => {
        setTeam(t);
        setAllWuensche(w);
        setFeiertage(f);
        setPlanStatus(p?.status ?? null);

        if (zList.length > 0) {
          const idToName: Record<string, string> = {};
          for (const m of t) idToName[m.id] = m.vorname;

          const zuweisungen = zList
            .map((rec) => {
              const slot = rec.expand?.schicht_slot;
              if (!slot) return null;
              const tag = new Date(slot.datum).getDate();
              const name = idToName[rec.hebamme] || "?";
              const fallbackVon = slot.typ === "nachtdienst" || slot.typ === "bd_nacht" ? "19:00" : slot.typ === "anmeldung" ? "09:00" : "07:00";
              const fallbackBis = slot.typ === "nachtdienst" || slot.typ === "bd_nacht" ? "07:00" : slot.typ === "anmeldung" ? "14:00" : "19:00";
              return {
                tag,
                typ: slot.typ as SchichtTyp,
                von: rec.zeit_von || fallbackVon,
                bis: rec.zeit_bis || fallbackBis,
                name,
                wunschErfuellt: rec.wunsch_erfuellt,
                erzwungen: !rec.wunsch_erfuellt,
              };
            })
            .filter((z): z is NonNullable<typeof z> => z !== null);

          // Reconstruct zuweisung + slot id maps
          const idMap: Record<string, string> = {};
          const sMap: Record<string, string> = {};
          for (const rec of zList) {
            const slot = rec.expand?.schicht_slot;
            if (!slot) continue;
            const tag = new Date(slot.datum).getDate();
            idMap[`${tag}|${slot.typ}`] = rec.id;
            sMap[`${tag}|${slot.typ}`] = slot.id;
          }
          setZuweisungIdMap(idMap);
          setSlotIdMap(sMap);

          // Reconstruct konflikte from wishes
          const konflikte: SolverKonflikt[] = zuweisungen
            .filter((z) => z.erzwungen)
            .map((z) => buildKonfliktFromWuensche(z, w, t, monatKey));

          // WE distribution
          const weVerteilung: Record<string, number> = {};
          for (const z of zuweisungen) {
            const dow = new Date(year, month, z.tag).getDay();
            if (dow === 0 || dow === 6) {
              weVerteilung[z.name] = (weVerteilung[z.name] || 0) + 1;
            }
          }

          const dbStat = (p?.statistik || {}) as Partial<SolverResult["statistik"]>;
          const anmeldungVerteilung: Record<string, number> = {};
          for (const z of zuweisungen) {
            if (z.typ === "anmeldung") anmeldungVerteilung[z.name] = (anmeldungVerteilung[z.name] || 0) + 1;
          }
          const statistik: SolverResult["statistik"] = {
            totalSlots: dbStat.totalSlots ?? zuweisungen.length,
            besetzt: zuweisungen.length,
            wuenscheErfuellt: zuweisungen.filter((z) => z.wunschErfuellt).length,
            erzwungen: zuweisungen.filter((z) => z.erzwungen).length,
            weVerteilung: dbStat.weVerteilung ?? weVerteilung,
            anmeldungVerteilung: dbStat.anmeldungVerteilung ?? anmeldungVerteilung,
            zielVerfehlt: dbStat.zielVerfehlt ?? [],
          };

          setResult({ zuweisungen, konflikte, statistik });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [monatKey, year, month]);

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

  const persistEdit = async (
    tag: number,
    typ: SchichtTyp,
    payload: Parameters<typeof updateZuweisung>[1]
  ) => {
    const id = zuweisungIdMap[`${tag}|${typ}`];
    if (!id) return; // plan not yet persisted – local state only
    try {
      await updateZuweisung(id, { ...payload, manuell_geaendert: true });
      setEditPersistError(null);
    } catch (err) {
      console.error("persistEdit failed", err);
      setEditPersistError("Änderung konnte nicht gespeichert werden");
      setTimeout(() => setEditPersistError(null), 4000);
    }
  };

  const recomputeStatistik = (zuweisungen: SolverResult["zuweisungen"]): SolverResult["statistik"] => {
    const we: Record<string, number> = {};
    const an: Record<string, number> = {};
    for (const z of zuweisungen) {
      const dow = new Date(year, month, z.tag).getDay();
      if (dow === 0 || dow === 6) we[z.name] = (we[z.name] || 0) + 1;
      if (z.typ === "anmeldung") an[z.name] = (an[z.name] || 0) + 1;
    }
    return {
      totalSlots: result?.statistik.totalSlots ?? zuweisungen.length,
      besetzt: zuweisungen.length,
      wuenscheErfuellt: zuweisungen.filter((z) => z.wunschErfuellt).length,
      erzwungen: zuweisungen.filter((z) => z.erzwungen).length,
      weVerteilung: we,
      anmeldungVerteilung: an,
      zielVerfehlt: result?.statistik.zielVerfehlt ?? [],
    };
  };

  const swapPerson = async (tag: number, typ: SchichtTyp, newName: string) => {
    if (!result) return;
    const newHebammeId = team.find((m) => m.vorname === newName)?.id;
    if (!newHebammeId) return;

    const existing = result.zuweisungen.find((z) => z.tag === tag && z.typ === typ);
    const wunschErfuellt = checkWunschErfuellt(newName, tag, typ);
    const fallbackVon = typ === "nachtdienst" || typ === "bd_nacht" ? "19:00" : typ === "anmeldung" ? "09:00" : "07:00";
    const fallbackBis = typ === "nachtdienst" || typ === "bd_nacht" ? "07:00" : typ === "anmeldung" ? "14:00" : "19:00";

    let updated;
    if (existing) {
      updated = result.zuweisungen.map((z) => z.tag === tag && z.typ === typ ? { ...z, name: newName, wunschErfuellt, erzwungen: !wunschErfuellt } : z);
    } else {
      updated = [...result.zuweisungen, { tag, typ, name: newName, von: fallbackVon, bis: fallbackBis, wunschErfuellt, erzwungen: !wunschErfuellt }];
    }
    setResult({ ...result, zuweisungen: updated, statistik: recomputeStatistik(updated) });

    // persist
    const key = `${tag}|${typ}`;
    const slotId = slotIdMap[key];
    if (!slotId) return; // local-only mode
    try {
      const existingId = zuweisungIdMap[key];
      if (existingId) {
        await updateZuweisung(existingId, {
          hebammeId: newHebammeId,
          wunsch_erfuellt: wunschErfuellt,
          manuell_geaendert: true,
        });
      } else {
        const { id } = await createZuweisung({
          monat: monatKey,
          schichtSlotId: slotId,
          hebammeId: newHebammeId,
          zeit_von: existing?.von || fallbackVon,
          zeit_bis: existing?.bis || fallbackBis,
          wunsch_erfuellt: wunschErfuellt,
          manuell_geaendert: true,
        });
        setZuweisungIdMap((prev) => ({ ...prev, [key]: id }));
      }
      setEditPersistError(null);
    } catch (err) {
      console.error("swapPerson persist failed", err);
      setEditPersistError("Tausch konnte nicht gespeichert werden");
      setTimeout(() => setEditPersistError(null), 4000);
    }
  };

  const clearSlot = async (tag: number, typ: SchichtTyp) => {
    if (!result) return;
    const updated = result.zuweisungen.filter((z) => !(z.tag === tag && z.typ === typ));
    setResult({ ...result, zuweisungen: updated, statistik: recomputeStatistik(updated) });

    const key = `${tag}|${typ}`;
    const id = zuweisungIdMap[key];
    if (!id) return; // not persisted
    try {
      await deleteZuweisung(id);
      setZuweisungIdMap((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setEditPersistError(null);
    } catch (err) {
      console.error("clearSlot persist failed", err);
      setEditPersistError("Slot konnte nicht geleert werden");
      setTimeout(() => setEditPersistError(null), 4000);
    }
  };

  const checkWunschErfuellt = (name: string, tag: number, typ: SchichtTyp): boolean => {
    const member = team.find((m) => m.vorname === name);
    if (!member) return false;
    const dateStr = `${monatKey}-${String(tag).padStart(2, "0")}`;
    const w = allWuensche.find((x) => x.hebamme === member.id && x.datum.startsWith(dateStr));
    if (!w) return false;
    if (w.ist_urlaub || w.frei_wunsch === "wichtig" || w.frei_wunsch === "waere_schoen") return false;
    if (w.dienste_json && w.dienste_json.length > 0) {
      return w.dienste_json.some((d) => d.typ === typ);
    }
    if (w.verfuegbar_fuer && w.verfuegbar_fuer.length > 0) {
      return w.verfuegbar_fuer.includes(typ) || w.verfuegbar_fuer.includes("alle");
    }
    return false;
  };

  const expectedSlotTypes = (day: number): SchichtTyp[] => {
    const arr: SchichtTyp[] = ["tagdienst", "nachtdienst", "bd_tag", "bd_nacht"];
    if (isAnmeldungTag(day)) arr.push("anmeldung");
    return arr;
  };

  const handleGenerate = () => {
    setGenerating(true);
    setZuweisungIdMap({}); // re-generated plan invalidates persisted IDs
    setSlotIdMap({});

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

    // Build ziele map per person (from any of their wishes for this month)
    const ziele: Record<string, { dienste_min: number; dienste_max: number; anmeldungen: number }> = {};
    for (const member of team) {
      const w = allWuensche.find((x) => x.hebamme === member.id);
      const max = w?.ziel_dienste_max ?? w?.ziel_dienste ?? 0;
      const min = w?.ziel_dienste_min ?? Math.max(0, max - 2);
      ziele[member.vorname] = {
        dienste_min: min,
        dienste_max: max,
        anmeldungen: w?.ziel_anmeldungen ?? 0,
      };
    }

    setTimeout(() => {
      const solverResult = solveDienstplan(
        year, month,
        wuenscheMap,
        team.map((t) => t.vorname),
        isAnmeldungTag,
        isFeiertag,
        ziele
      );
      setResult(solverResult);
      setGenerating(false);

      saveDienstplan({
        monat: monatKey,
        status: "generiert",
        generiert_am: new Date().toISOString(),
        statistik: solverResult.statistik as Record<string, unknown>,
      }).catch(() => {});
      setPlanStatus("generiert");
    }, 600);
  };

  const isUnsavedDraft = result !== null && Object.keys(zuweisungIdMap).length === 0;

  const handlePersistAndRelease = async (releaseToAll: boolean) => {
    if (!result) return;
    setSavingPlan(true);
    try {
      const namensMap: Record<string, string> = {};
      for (const m of team) namensMap[m.vorname] = m.id;

      const eintraege = result.zuweisungen.map((z) => ({
        tag: z.tag,
        typ: z.typ,
        hebammeId: namensMap[z.name] || "",
        zeit_von: z.von,
        zeit_bis: z.bis,
        wunsch_erfuellt: z.wunschErfuellt,
        manuell_geaendert: false,
      })).filter((e) => e.hebammeId);

      // Build expected slots: every day gets the standard 4 plus anmeldung where applicable.
      const expectedSlots: { tag: number; typ: SchichtTyp; ist_feiertag?: boolean }[] = [];
      for (let day = 1; day <= daysInMonth; day++) {
        for (const typ of expectedSlotTypes(day)) {
          expectedSlots.push({ tag: day, typ, ist_feiertag: isFeiertag(day) });
        }
      }

      const { slotIdMap: sMap, zuweisungIdMap: zMap } = await saveZuweisungenMitSlots(monatKey, expectedSlots, eintraege);
      setSlotIdMap(sMap);
      setZuweisungIdMap(zMap);
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

        {(planStatus || isUnsavedDraft) && (
          <div className={cn(
            "mb-4 rounded-xl px-4 py-2.5 text-sm flex items-center gap-2",
            isUnsavedDraft ? "bg-orange-500/15 ring-1 ring-orange-400/30 text-orange-300"
              : planStatus === "freigegeben" ? "bg-emerald-500/15 ring-1 ring-emerald-400/30 text-emerald-300"
              : planStatus === "generiert" ? "bg-amber-500/15 ring-1 ring-amber-400/30 text-amber-300"
              : "bg-white/5 text-white/40"
          )}>
            <div className={cn(
              "h-2 w-2 rounded-full",
              isUnsavedDraft ? "bg-orange-400 animate-pulse"
                : planStatus === "freigegeben" ? "bg-emerald-400"
                : planStatus === "generiert" ? "bg-amber-400" : "bg-white/30"
            )} />
            {isUnsavedDraft
              ? "Lokaler Entwurf – noch nicht gespeichert"
              : planStatus === "freigegeben" ? "Plan-Status: Freigegeben"
              : planStatus === "generiert" ? "Plan-Status: Entwurf (nur Admin sichtbar)"
              : `Plan-Status: ${planStatus}`}
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
                      const an = result.statistik.anmeldungVerteilung?.[member.vorname] || 0;
                      const maxCount = Math.max(...team.map((t) => result.zuweisungen.filter((z) => z.name === t.vorname).length), 1);
                      return (
                        <div key={member.id} className="flex items-center gap-3">
                          <span className="text-sm text-white/60 w-20 shrink-0">{member.vorname}</span>
                          <div className="flex-1 h-3 rounded-full bg-white/5 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary/30" style={{ width: `${(count / maxCount) * 100}%` }} />
                          </div>
                          <span className="text-sm font-medium text-white/70 w-6 text-right">{count}</span>
                          <span className="text-[10px] text-white/30 w-10 text-right">WE:{we}</span>
                          <span className="text-[10px] text-white/30 w-10 text-right">An:{an}</span>
                          {forced > 0 && <span className="text-[10px] text-amber-400/60 w-7 text-right">{forced}x</span>}
                        </div>
                      );
                    })}
                  </div>
                  {result.statistik.zielVerfehlt && result.statistik.zielVerfehlt.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-white/5 space-y-1">
                      <p className="text-xs text-amber-400/80 mb-1">Ziele verfehlt:</p>
                      {result.statistik.zielVerfehlt.map((v, i) => (
                        <p key={i} className="text-xs text-white/50">
                          <span className="text-white/70">{v.name}</span> – {v.typ === "dienste" ? "Dienste" : "Anmeldungen"}: <span className="text-amber-300">{v.ist}</span> von <span className="text-white/40">{v.ziel}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </GlassCard>

                <GlassCard className="mb-6">
                  <h2 className="text-base font-semibold text-white mb-3">Plan bearbeiten</h2>
                  <p className="text-xs text-white/40 mb-3">
                    Person wechseln per Dropdown · 🗑 entfernt die Zuweisung (Slot bleibt leer).
                    {Object.keys(slotIdMap).length === 0 && " Änderungen sind lokal bis zum nächsten Speichern."}
                  </p>
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                      const types = expectedSlotTypes(day);
                      const dow = WOCHENTAGE[new Date(year, month, day).getDay()];
                      const isWE = [0, 6].includes(new Date(year, month, day).getDay());
                      return (
                        <div key={day} className={cn("rounded-xl p-3", isWE ? "bg-white/[0.02]" : "bg-white/[0.04]")}>
                          <p className={cn("text-xs font-semibold mb-2", isWE ? "text-white/40" : "text-white/65")}>
                            {dow} {day}.{isFeiertag(day) && <span className="ml-2 text-amber-400/70">Feiertag</span>}
                          </p>
                          <div className="space-y-1.5">
                            {types.map((typ) => {
                              const z = result.zuweisungen.find((x) => x.tag === day && x.typ === typ);
                              return (
                                <SlotEditor
                                  key={typ}
                                  tag={day}
                                  typ={typ}
                                  zuweisung={z}
                                  team={team}
                                  farbenMap={farbenMap}
                                  onSwap={swapPerson}
                                  onClear={clearSlot}
                                  onTimeEdit={(field, val) => {
                                    if (!result || !z) return;
                                    setResult({
                                      ...result,
                                      zuweisungen: result.zuweisungen.map((x) =>
                                        x.tag === day && x.typ === typ ? { ...x, [field === "von" ? "von" : "bis"]: val } : x
                                      ),
                                    });
                                    persistEdit(day, typ, field === "von" ? { zeit_von: val } : { zeit_bis: val });
                                  }}
                                />
                              );
                            })}
                          </div>
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

      {editPersistError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] rounded-xl bg-red-500/20 ring-1 ring-red-400/40 px-4 py-2 text-sm text-red-200 backdrop-blur-md">
          {editPersistError}
        </div>
      )}

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
                <p className="text-sm text-amber-400/80 mb-2">{selectedKonflikt.problem}</p>
                <p className="text-xs text-white/40 mb-5">
                  {Object.keys(zuweisungIdMap).length > 0
                    ? "Änderungen werden direkt gespeichert."
                    : "Plan ist noch nicht gespeichert – Änderungen erst nach „Speichern & freigeben“ persistent."}
                </p>

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
                        const v = e.target.value;
                        setResult({ ...result, zuweisungen: result.zuweisungen.map((z) => z.tag === currentZ.tag && z.typ === currentZ.typ ? { ...z, von: v } : z) });
                        persistEdit(currentZ.tag, currentZ.typ, { zeit_von: v });
                      }} className="flex-1 rounded-lg bg-white/10 border-0 px-2 py-2 text-sm text-white font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50 text-center">
                        {Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i/2)).padStart(2,"0")}:${i%2===0?"00":"30"}`).map((z) => <option key={z} value={z} className="bg-gray-900 text-white">{z}</option>)}
                      </select>
                      <span className="text-white/20 text-sm">bis</span>
                      <select value={currentZ.bis} onChange={(e) => {
                        if (!result) return;
                        const v = e.target.value;
                        setResult({ ...result, zuweisungen: result.zuweisungen.map((z) => z.tag === currentZ.tag && z.typ === currentZ.typ ? { ...z, bis: v } : z) });
                        persistEdit(currentZ.tag, currentZ.typ, { zeit_bis: v });
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
                            const wunschErfuellt = status === "verfuegbar";
                            const updated = result.zuweisungen.map((z) => z.tag === selectedKonflikt.tag && z.typ === selectedKonflikt.typ ? { ...z, name, wunschErfuellt, erzwungen: !wunschErfuellt } : z);
                            setResult({ ...result, zuweisungen: updated, statistik: { ...result.statistik, erzwungen: updated.filter((z) => z.erzwungen).length, wuenscheErfuellt: updated.filter((z) => z.wunschErfuellt).length } });
                            const newHebammeId = team.find((m) => m.vorname === name)?.id;
                            if (newHebammeId) {
                              persistEdit(selectedKonflikt.tag, selectedKonflikt.typ, {
                                hebammeId: newHebammeId,
                                wunsch_erfuellt: wunschErfuellt,
                              });
                            }
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

const SLOT_ICONS: Record<SchichtTyp, LucideIcon> = {
  tagdienst: Sun,
  nachtdienst: Moon,
  bd_tag: Clock,
  bd_nacht: Clock,
  anmeldung: FileText,
};

const SLOT_FARBEN: Record<SchichtTyp, string> = {
  tagdienst: "text-amber-300",
  nachtdienst: "text-indigo-300",
  bd_tag: "text-sky-300",
  bd_nacht: "text-blue-300",
  anmeldung: "text-emerald-300",
};

const ZEIT_OPTIONEN_ALL = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 === 0 ? "00" : "30"}`);

function SlotEditor({
  tag,
  typ,
  zuweisung,
  team,
  farbenMap,
  onSwap,
  onClear,
  onTimeEdit,
}: {
  tag: number;
  typ: SchichtTyp;
  zuweisung: SolverResult["zuweisungen"][number] | undefined;
  team: Hebamme[];
  farbenMap: Record<string, string>;
  onSwap: (tag: number, typ: SchichtTyp, name: string) => void;
  onClear: (tag: number, typ: SchichtTyp) => void;
  onTimeEdit: (field: "von" | "bis", val: string) => void;
}) {
  const Icon = SLOT_ICONS[typ];
  const isEmpty = !zuweisung;
  const fallbackVon = typ === "nachtdienst" || typ === "bd_nacht" ? "19:00" : typ === "anmeldung" ? "09:00" : "07:00";
  const fallbackBis = typ === "nachtdienst" || typ === "bd_nacht" ? "07:00" : typ === "anmeldung" ? "14:00" : "19:00";

  return (
    <div className={cn(
      "flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5",
      isEmpty ? "bg-red-500/8 ring-1 ring-red-400/20" : zuweisung.erzwungen ? "bg-amber-500/8" : "bg-white/[0.02]"
    )}>
      <Icon className={cn("h-3.5 w-3.5 shrink-0", SLOT_FARBEN[typ])} />
      <span className="text-[11px] text-white/40 w-16 shrink-0">{SCHICHT_LABELS[typ]}</span>

      {/* Person dropdown */}
      <div className="flex items-center gap-1.5 min-w-0">
        {!isEmpty && (
          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: farbenMap[zuweisung.name] || "#666" }} />
        )}
        <select
          value={zuweisung?.name || ""}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "") onClear(tag, typ);
            else onSwap(tag, typ, v);
          }}
          className={cn(
            "rounded-md bg-white/10 px-2 py-1 text-xs font-medium text-white border-0 focus:outline-none focus:ring-2 focus:ring-primary/50 max-w-[120px]",
            isEmpty && "text-red-300/80"
          )}
        >
          <option value="" className="bg-gray-900 text-red-300">— Leer —</option>
          {team.map((m) => (
            <option key={m.id} value={m.vorname} className="bg-gray-900 text-white">
              {m.vorname}
            </option>
          ))}
        </select>
      </div>

      {/* Time */}
      <div className="flex items-center gap-1 ml-auto">
        <select
          value={zuweisung?.von || fallbackVon}
          disabled={isEmpty}
          onChange={(e) => onTimeEdit("von", e.target.value)}
          className="rounded-md bg-white/10 px-1.5 py-1 text-[11px] font-mono text-white border-0 disabled:opacity-30 focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          {ZEIT_OPTIONEN_ALL.map((z) => <option key={z} value={z} className="bg-gray-900">{z}</option>)}
        </select>
        <span className="text-white/20 text-[10px]">–</span>
        <select
          value={zuweisung?.bis || fallbackBis}
          disabled={isEmpty}
          onChange={(e) => onTimeEdit("bis", e.target.value)}
          className="rounded-md bg-white/10 px-1.5 py-1 text-[11px] font-mono text-white border-0 disabled:opacity-30 focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          {ZEIT_OPTIONEN_ALL.map((z) => <option key={z} value={z} className="bg-gray-900">{z}</option>)}
        </select>

        {!isEmpty && (
          <button
            onClick={() => onClear(tag, typ)}
            className="rounded-md p-1 text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-glass"
            title="Slot leeren"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function buildKonfliktFromWuensche(
  z: SolverResult["zuweisungen"][number],
  wuensche: Wunsch[],
  team: Hebamme[],
  monatKey: string
): SolverKonflikt {
  const dateStr = `${monatKey}-${String(z.tag).padStart(2, "0")}`;
  const wuenscheForDay = wuensche.filter((w) => w.datum.startsWith(dateStr));
  const verfuegbar: string[] = [];
  const freiSchoen: string[] = [];
  const freiWichtig: string[] = [];
  const urlaub: string[] = [];
  for (const w of wuenscheForDay) {
    const m = team.find((x) => x.id === w.hebamme);
    if (!m || m.vorname === z.name) continue;
    if (w.ist_urlaub) urlaub.push(m.vorname);
    else if (w.frei_wunsch === "wichtig") freiWichtig.push(m.vorname);
    else if (w.frei_wunsch === "waere_schoen") freiSchoen.push(m.vorname);
    else if ((w.dienste_json && w.dienste_json.length > 0) || (w.verfuegbar_fuer && w.verfuegbar_fuer.length > 0)) {
      verfuegbar.push(m.vorname);
    }
  }
  return {
    tag: z.tag,
    typ: z.typ,
    problem: verfuegbar.length === 0
      ? `Niemand wollte diese Schicht – ${z.name} eingeteilt`
      : `${z.name} hatte lieber frei, wurde aber benötigt`,
    schwere: verfuegbar.length === 0 ? "rot" : "gelb",
    verfuegbar,
    freiSchoen,
    freiWichtig,
    urlaub,
  };
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
