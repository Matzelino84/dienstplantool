"use client";

import { AuthGuard } from "@/components/auth-guard";
import { useAuth } from "@/lib/auth";
import { NavBar } from "@/components/ui/nav-bar";
import { GlassCard } from "@/components/ui/glass-card";
import { getTeam, createHebamme, updateHebamme } from "@/lib/api";
import type { Hebamme } from "@/lib/types";
import { UserPlus, Shield, X, Check, Trash2 } from "lucide-react";
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
  const [newPin, setNewPin] = useState("");
  const [newRolle, setNewRolle] = useState<"hebamme" | "admin">("hebamme");
  const [newFarbe, setNewFarbe] = useState(FARBEN[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
      setNewPin("");
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
