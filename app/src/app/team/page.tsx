"use client";

import { AuthGuard } from "@/components/auth-guard";
import { useAuth } from "@/lib/auth";
import { NavBar } from "@/components/ui/nav-bar";
import { GlassCard } from "@/components/ui/glass-card";
import { getTeam, createHebamme, updateHebamme, getWuensche, adminResetPin } from "@/lib/api";
import type { Hebamme, Wunsch } from "@/lib/types";
import { SCHICHT_LABELS, WOCHENTAGE } from "@/lib/types";
import { UserPlus, Shield, X, Check, Trash2, KeyRound, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

const FARBEN = [
  "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899", "#10b981",
  "#f97316", "#06b6d4", "#84cc16", "#e11d48", "#7c3aed",
  "#14b8a6", "#f43f5e", "#0ea5e9", "#a855f7",
];

export default function TeamPage() {
  const { isAdmin } = useAuth();
  const [team, setTeam] = useState<Hebamme[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPin, setNewPin] = useState("1234");
  const [newRolle, setNewRolle] = useState<"hebamme" | "admin">("hebamme");
  const [newFarbe, setNewFarbe] = useState(FARBEN[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [drillMember, setDrillMember] = useState<Hebamme | null>(null);

  const loadTeam = () => {
    getTeam().then(setTeam).catch(() => {});
  };

  useEffect(() => { loadTeam(); }, []);

  const handleCreate = async () => {
    if (!newName.trim() || newPin.length < 4) {
      setError(newPin.length < 4 ? "PIN muss 4 Stellen haben" : "Name eingeben");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createHebamme({
        vorname: newName.trim(),
        nachname: "",
        rolle: newRolle,
        farbe: newFarbe,
        pin: newPin,
      });
      setShowAdd(false);
      setNewName("");
      setNewPin("1234");
      setNewRolle("hebamme");
      loadTeam();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Fehler beim Anlegen";
      setError(msg.includes("UNIQUE") ? "Name existiert bereits" : msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    await updateHebamme(id, { aktiv: false });
    loadTeam();
  };

  return (
    <AuthGuard>
    <div className="flex min-h-screen flex-col">
      <NavBar />
      <main className="flex-1 mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Team</h1>
            <p className="mt-1 text-white/50">{team.length} Hebammen</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-4 py-2.5 text-sm font-semibold text-white transition-glass hover:opacity-90 glow active:scale-95"
            >
              <UserPlus className="h-4 w-4" />
              Neu
            </button>
          )}
        </div>

        <div className="space-y-3">
          {team.map((member) => (
            <GlassCard key={member.id} className="flex items-center gap-4 p-4">
              <button
                onClick={() => isAdmin && setDrillMember(member)}
                disabled={!isAdmin}
                className="flex flex-1 items-center gap-4 min-w-0 text-left active:scale-[0.99] transition-glass disabled:cursor-default"
              >
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white font-bold text-lg"
                  style={{ backgroundColor: (member.farbe || "#666") + "30" }}
                >
                  {member.vorname[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white truncate">{member.vorname}</h3>
                    {member.rolle === "admin" && <Shield className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
                  </div>
                  <p className="text-xs text-white/40 capitalize">{member.rolle}</p>
                </div>
                <div className="text-right text-xs">
                  <p className="text-white/40">Fairness</p>
                  <p className={cn(
                    "font-medium",
                    member.fairness_score >= 60 ? "text-emerald-400" :
                    member.fairness_score >= 40 ? "text-amber-400" : "text-red-400"
                  )}>
                    {member.fairness_score}%
                  </p>
                </div>
                {isAdmin && <ChevronRight className="h-4 w-4 text-white/25 shrink-0" />}
              </button>
              {isAdmin && member.rolle !== "admin" && (
                <button
                  onClick={() => handleDeactivate(member.id)}
                  className="rounded-lg p-2 text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-glass"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </GlassCard>
          ))}
        </div>
      </main>

      {drillMember && (
        <MemberDetailSheet
          member={drillMember}
          onClose={() => setDrillMember(null)}
          onPinReset={loadTeam}
        />
      )}

      {/* Add Person Sheet */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowAdd(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg animate-in slide-in-from-bottom duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="glass-strong rounded-t-3xl px-6 pt-4 pb-8 border-t border-white/15">
              <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20" />
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Neue Person</h3>
                <button onClick={() => setShowAdd(false)} className="rounded-xl p-2 text-white/40 hover:text-white hover:bg-white/10">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-5">
                {/* Name */}
                <div>
                  <label className="text-sm text-white/50 block mb-1.5">Vorname</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="z.B. Sabine"
                    className="w-full rounded-xl bg-white/10 border-0 px-4 py-3 text-base text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>

                {/* PIN */}
                <div>
                  <label className="text-sm text-white/50 block mb-1.5">PIN (4 Stellen)</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={4}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="1234"
                    className="w-full rounded-xl bg-white/10 border-0 px-4 py-3 text-base text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-primary/50 tracking-[0.3em] text-center font-mono"
                  />
                  <p className="text-[11px] text-white/30 mt-1.5">Standard 1234 – die Person ändert sie selbst im Profil.</p>
                </div>

                {/* Rolle */}
                <div>
                  <label className="text-sm text-white/50 block mb-1.5">Rolle</label>
                  <div className="flex gap-2">
                    {(["hebamme", "admin"] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => setNewRolle(r)}
                        className={cn(
                          "flex-1 rounded-xl py-3 text-sm font-medium transition-all",
                          newRolle === r ? "bg-primary/20 text-white ring-1 ring-primary/30" : "bg-white/5 text-white/40"
                        )}
                      >
                        {r === "admin" ? "Admin" : "Hebamme"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Farbe */}
                <div>
                  <label className="text-sm text-white/50 block mb-1.5">Farbe</label>
                  <div className="flex flex-wrap gap-2">
                    {FARBEN.map((f) => (
                      <button
                        key={f}
                        onClick={() => setNewFarbe(f)}
                        className={cn(
                          "h-9 w-9 rounded-xl transition-all active:scale-90",
                          newFarbe === f ? "ring-2 ring-white scale-110" : "ring-1 ring-white/10"
                        )}
                        style={{ backgroundColor: f }}
                      />
                    ))}
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <p className="text-sm text-red-400 text-center">{error}</p>
                )}

                {/* Save */}
                <button
                  onClick={handleCreate}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-accent py-4 text-base font-bold text-white transition-glass hover:opacity-90 active:scale-[0.98]"
                >
                  {saving ? (
                    <div className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  ) : (
                    <><Check className="h-5 w-5" /> Person anlegen</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </AuthGuard>
  );
}

function MemberDetailSheet({
  member,
  onClose,
  onPinReset,
}: {
  member: Hebamme;
  onClose: () => void;
  onPinReset: () => void;
}) {
  const [wuensche, setWuensche] = useState<Wunsch[]>([]);
  const [loading, setLoading] = useState(true);
  const [pinInput, setPinInput] = useState("");
  const [pinSaving, setPinSaving] = useState(false);
  const [pinMsg, setPinMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    const now = new Date();
    const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const nxtD = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nxt = `${nxtD.getFullYear()}-${String(nxtD.getMonth() + 1).padStart(2, "0")}`;
    setLoading(true);
    Promise.all([getWuensche(cur, member.id), getWuensche(nxt, member.id)])
      .then(([a, b]) => setWuensche([...a, ...b]))
      .catch(() => setWuensche([]))
      .finally(() => setLoading(false));
  }, [member.id]);

  const handleResetPin = async () => {
    if (pinInput.length !== 4) {
      setPinMsg({ kind: "err", text: "PIN muss 4 Stellen haben" });
      return;
    }
    setPinSaving(true);
    setPinMsg(null);
    try {
      await adminResetPin(member.id, pinInput);
      setPinMsg({ kind: "ok", text: `PIN auf ${pinInput} gesetzt` });
      setPinInput("");
      onPinReset();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fehler beim Speichern";
      setPinMsg({ kind: "err", text: msg });
    } finally {
      setPinSaving(false);
    }
  };

  const s = member.settings || {};
  const hardChips = [
    s.nur_tagdienste && "Nur Tag",
    s.nur_bds && "Nur BD",
    s.keine_anmeldung && "Keine Anmeldung",
  ].filter(Boolean) as string[];
  const softChips = [
    s.lieber_nachtdienste && "Bevorzugt Nacht",
    s.bd_24h && "24h-BD",
  ].filter(Boolean) as string[];
  const blockedWd = (s.fix_blocked_weekdays || []).map((i) => WOCHENTAGE[i]).join(", ");
  const freiWd = (s.fix_frei_weekdays || []).map((i) => WOCHENTAGE[i]).join(", ");

  // Group wuensche by month, then list every relevant day chronologically
  const wuenscheByDay: Record<string, Wunsch> = {};
  for (const w of wuensche) wuenscheByDay[w.datum.slice(0, 10)] = w;
  const sortedDates = Object.keys(wuenscheByDay).sort();

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg animate-in slide-in-from-bottom duration-300" onClick={(e) => e.stopPropagation()}>
        <div className="glass-strong rounded-t-3xl px-6 pt-4 pb-8 border-t border-white/15 max-h-[88vh] overflow-y-auto">
          <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20" />
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className="h-12 w-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg"
                style={{ backgroundColor: (member.farbe || "#666") + "30" }}
              >
                {member.vorname[0]}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white">{member.vorname}</h3>
                  {member.rolle === "admin" && <Shield className="h-3.5 w-3.5 text-amber-400" />}
                </div>
                <p className="text-xs text-white/40 capitalize">{member.rolle} · Fairness {member.fairness_score}%</p>
              </div>
            </div>
            <button onClick={onClose} className="rounded-xl p-2 text-white/40 hover:text-white hover:bg-white/10">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Settings-Übersicht */}
          <section className="mb-5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-2">Einstellungen</h4>
            {(hardChips.length === 0 && softChips.length === 0 && !blockedWd && !freiWd && !s.max_we_dienste) ? (
              <p className="text-xs text-white/30">Keine speziellen Einstellungen.</p>
            ) : (
              <div className="space-y-2">
                {(hardChips.length > 0 || softChips.length > 0) && (
                  <div className="flex flex-wrap gap-1.5">
                    {hardChips.map((c) => (
                      <span key={c} className="rounded-full bg-red-500/15 ring-1 ring-red-400/25 px-2.5 py-1 text-[11px] font-medium text-red-300">{c}</span>
                    ))}
                    {softChips.map((c) => (
                      <span key={c} className="rounded-full bg-sky-500/15 ring-1 ring-sky-400/25 px-2.5 py-1 text-[11px] font-medium text-sky-300">{c}</span>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  {s.max_we_dienste !== undefined && s.max_we_dienste > 0 && (
                    <>
                      <div className="text-white/40">Max WE-Dienste</div>
                      <div className="text-white/80 font-medium tabular-nums">{s.max_we_dienste}</div>
                    </>
                  )}
                  {blockedWd && (
                    <>
                      <div className="text-white/40">Kann nie</div>
                      <div className="text-red-300/80">{blockedWd}</div>
                    </>
                  )}
                  {freiWd && (
                    <>
                      <div className="text-white/40">Frei-Pattern</div>
                      <div className="text-amber-300/80">{freiWd}</div>
                    </>
                  )}
                  {s.fix_blocked_dates && s.fix_blocked_dates.length > 0 && (
                    <>
                      <div className="text-white/40">Sperr-Tage</div>
                      <div className="text-red-300/80">{s.fix_blocked_dates.length} Tage</div>
                    </>
                  )}
                  {s.fix_frei_dates && s.fix_frei_dates.length > 0 && (
                    <>
                      <div className="text-white/40">Frei-Tage</div>
                      <div className="text-amber-300/80">{s.fix_frei_dates.length} Tage</div>
                    </>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Wünsche */}
          <section className="mb-5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-2">Wünsche (aktueller + nächster Monat)</h4>
            {loading ? (
              <div className="flex justify-center py-4">
                <div className="h-5 w-5 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
              </div>
            ) : sortedDates.length === 0 ? (
              <p className="text-xs text-white/30">Keine Wünsche eingetragen.</p>
            ) : (
              <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                {sortedDates.map((dateStr) => {
                  const w = wuenscheByDay[dateStr];
                  const d = new Date(dateStr);
                  const dow = WOCHENTAGE[d.getDay()];
                  const dayLabel = `${dow} ${d.getDate()}.${d.getMonth() + 1}.`;
                  let label = "—";
                  let cls = "text-white/30";
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
                  return (
                    <div key={dateStr} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2">
                      <span className="text-xs text-white/40 font-mono w-16 shrink-0">{dayLabel}</span>
                      <span className={cn("text-sm flex-1 truncate", cls)}>{label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* PIN-Reset */}
          <section className="mb-1">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-2 flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5" /> PIN zurücksetzen
            </h4>
            <p className="text-[11px] text-white/40 mb-3">
              Überschreibt den aktuellen PIN sofort. Die Person kann ihn danach selbst im Profil ändern.
            </p>
            <div className="flex gap-2">
              <input
                type="tel"
                inputMode="numeric"
                maxLength={4}
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4));
                  setPinMsg(null);
                }}
                placeholder="Neue 4-stellige PIN"
                className="flex-1 rounded-xl bg-white/10 border-0 px-4 py-3 text-base text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-primary/50 tracking-[0.3em] text-center font-mono"
              />
              <button
                onClick={handleResetPin}
                disabled={pinSaving || pinInput.length !== 4}
                className="rounded-xl bg-gradient-to-r from-primary to-accent px-4 py-3 text-sm font-semibold text-white transition-glass hover:opacity-90 active:scale-95 disabled:opacity-40"
              >
                {pinSaving ? (
                  <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  "Setzen"
                )}
              </button>
            </div>
            {pinMsg && (
              <p className={cn("text-xs mt-2", pinMsg.kind === "ok" ? "text-emerald-300" : "text-red-400")}>
                {pinMsg.text}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
