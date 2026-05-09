"use client";

import { AuthGuard } from "@/components/auth-guard";
import { NavBar } from "@/components/ui/nav-bar";
import { GlassCard } from "@/components/ui/glass-card";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import {
  updateHebammeSettings,
  getFeiertage,
  createFeiertag,
  deleteFeiertag,
} from "@/lib/api";
import type { HebammeSettings, Feiertag } from "@/lib/types";
import {
  Settings as SettingsIcon,
  CalendarHeart,
  Sun,
  Moon,
  Clock,
  FileText,
  Lock,
  Heart,
  Plus,
  Trash2,
  Calendar,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

const WOCHENTAGE = [
  { idx: 1, label: "Mo" },
  { idx: 2, label: "Di" },
  { idx: 3, label: "Mi" },
  { idx: 4, label: "Do" },
  { idx: 5, label: "Fr" },
  { idx: 6, label: "Sa" },
  { idx: 0, label: "So" },
];

export default function EinstellungenPage() {
  const { user, isAdmin, refreshUser } = useAuth();
  const [settings, setSettings] = useState<HebammeSettings>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [feiertage, setFeiertage] = useState<Feiertag[]>([]);
  const [showAddFeiertag, setShowAddFeiertag] = useState(false);
  const [newFeiertagDatum, setNewFeiertagDatum] = useState("");
  const [newFeiertagName, setNewFeiertagName] = useState("");
  const [newFeiertagTyp, setNewFeiertagTyp] = useState<"feiertag" | "ferien">("feiertag");

  useEffect(() => {
    if (user?.settings) setSettings(user.settings);
  }, [user]);

  useEffect(() => {
    getFeiertage(new Date().getFullYear()).then(setFeiertage).catch(() => {});
  }, []);

  const toggleWeekday = (key: "fix_blocked_weekdays" | "fix_frei_weekdays", idx: number) => {
    const arr = settings[key] || [];
    const next = arr.includes(idx) ? arr.filter((d) => d !== idx) : [...arr, idx];
    setSettings({ ...settings, [key]: next });
  };

  const updateBool = (key: keyof HebammeSettings, value: boolean) => {
    setSettings({ ...settings, [key]: value });
  };

  const updateNum = (key: keyof HebammeSettings, value: number) => {
    setSettings({ ...settings, [key]: value });
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updateHebammeSettings(user.id, settings);
      await refreshUser();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const handleAddFeiertag = async () => {
    if (!newFeiertagDatum) return;
    try {
      await createFeiertag({
        datum: `${newFeiertagDatum} 00:00:00.000Z`,
        name: newFeiertagName,
        typ: newFeiertagTyp,
      });
      setNewFeiertagDatum("");
      setNewFeiertagName("");
      setShowAddFeiertag(false);
      const list = await getFeiertage(new Date().getFullYear());
      setFeiertage(list);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteFeiertag = async (id: string) => {
    await deleteFeiertag(id);
    setFeiertage(feiertage.filter((f) => f.id !== id));
  };

  return (
    <AuthGuard>
      <div className="flex min-h-screen flex-col">
        <NavBar />
        <main className="flex-1 mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
          <div className="flex items-center gap-3 mb-6">
            <SettingsIcon className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Einstellungen</h1>
              <p className="text-sm text-white/50">Persönliche Vorgaben für deinen Wunschplan</p>
            </div>
          </div>

          <GlassCard className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Lock className="h-4 w-4 text-red-400" />
              <h2 className="text-base font-semibold text-white">Wochentage immer geblockt</h2>
            </div>
            <p className="text-xs text-white/40 mb-4">
              Diese Wochentage sind im Wunschplan automatisch als <strong>Urlaub / fix-frei</strong> markiert (z.B. Kurstage).
            </p>
            <div className="flex flex-wrap gap-2">
              {WOCHENTAGE.map((d) => {
                const active = settings.fix_blocked_weekdays?.includes(d.idx) ?? false;
                return (
                  <button
                    key={d.idx}
                    onClick={() => toggleWeekday("fix_blocked_weekdays", d.idx)}
                    className={cn(
                      "h-11 w-12 rounded-xl text-sm font-semibold transition-all active:scale-95",
                      active ? "bg-red-500/25 ring-1 ring-red-400/40 text-red-200" : "bg-white/5 text-white/50"
                    )}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </GlassCard>

          <GlassCard className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Heart className="h-4 w-4 text-amber-400" />
              <h2 className="text-base font-semibold text-white">Wochentage „lieber frei&quot;</h2>
            </div>
            <p className="text-xs text-white/40 mb-4">
              Wird im Wunschplan automatisch als <strong>Freiwunsch wäre schön</strong> vorausgewählt – kann pro Tag überschrieben werden.
            </p>
            <div className="flex flex-wrap gap-2">
              {WOCHENTAGE.map((d) => {
                const active = settings.fix_frei_weekdays?.includes(d.idx) ?? false;
                return (
                  <button
                    key={d.idx}
                    onClick={() => toggleWeekday("fix_frei_weekdays", d.idx)}
                    className={cn(
                      "h-11 w-12 rounded-xl text-sm font-semibold transition-all active:scale-95",
                      active ? "bg-amber-500/25 ring-1 ring-amber-400/40 text-amber-200" : "bg-white/5 text-white/50"
                    )}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </GlassCard>

          <GlassCard className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <CalendarHeart className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold text-white">Persönliche Vorlieben</h2>
            </div>
            <div className="space-y-3">
              <ToggleRow
                icon={<Moon className="h-4 w-4 text-indigo-300" />}
                label="Lieber mehr Nachtdienste"
                desc="Bevorzugt Nacht- statt Tagdienste"
                value={!!settings.lieber_nachtdienste}
                onChange={(v) => updateBool("lieber_nachtdienste", v)}
              />
              <ToggleRow
                icon={<Clock className="h-4 w-4 text-sky-300" />}
                label="Gerne ganze Bereitschaft (24 h)"
                desc="Wenn möglich BD Tag + BD Nacht zusammen"
                value={!!settings.bd_24h}
                onChange={(v) => updateBool("bd_24h", v)}
              />
            </div>
          </GlassCard>

          <GlassCard className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <SettingsIcon className="h-4 w-4 text-white/60" />
              <h2 className="text-base font-semibold text-white">Sondereinteilungen</h2>
            </div>
            <p className="text-xs text-white/40 mb-4">
              Werden vom Solver als harte Regeln behandelt – nutze nur, wenn nötig.
            </p>
            <div className="space-y-3">
              <ToggleRow
                icon={<Sun className="h-4 w-4 text-amber-300" />}
                label="Nur Tagdienste"
                desc="Z.B. bei Schwangerschaft – keine Nacht- oder Nacht-BDs"
                value={!!settings.nur_tagdienste}
                onChange={(v) => updateBool("nur_tagdienste", v)}
              />
              <ToggleRow
                icon={<Clock className="h-4 w-4 text-blue-300" />}
                label="Nur BDs"
                desc="Einarbeitung – keine echten TD/ND/Anmeldung"
                value={!!settings.nur_bds}
                onChange={(v) => updateBool("nur_bds", v)}
              />
              <ToggleRow
                icon={<FileText className="h-4 w-4 text-emerald-300" />}
                label="Keine Anmeldung"
                desc="Wird bei Geburtsanmeldungen nicht eingeteilt"
                value={!!settings.keine_anmeldung}
                onChange={(v) => updateBool("keine_anmeldung", v)}
              />
              <div className="rounded-xl bg-white/[0.03] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white/85">Maximale Wochenend-Dienste</p>
                    <p className="text-xs text-white/40">0 = automatisch (2 bzw. 3 bei 5-WE-Monaten)</p>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={6}
                    value={settings.max_we_dienste ?? 0}
                    onChange={(e) => updateNum("max_we_dienste", Math.max(0, Number(e.target.value) || 0))}
                    className="w-16 h-10 rounded-lg bg-white/10 text-center text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
            </div>
          </GlassCard>

          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              "w-full flex items-center justify-center gap-3 rounded-2xl py-4 text-base font-bold text-white transition-all active:scale-[0.98] mb-8",
              saved ? "bg-emerald-500/20 ring-1 ring-emerald-400/30" : "bg-gradient-to-r from-primary to-accent hover:opacity-90 glow"
            )}
          >
            {saving ? (
              <><div className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Wird gespeichert...</>
            ) : saved ? (
              <><Check className="h-5 w-5 text-emerald-400" /> Gespeichert</>
            ) : (
              <>Einstellungen speichern</>
            )}
          </button>

          {isAdmin && (
            <GlassCard className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-amber-400" />
                  <h2 className="text-base font-semibold text-white">Feiertage & Ferien {new Date().getFullYear()}</h2>
                </div>
                <button
                  onClick={() => setShowAddFeiertag(true)}
                  className="flex items-center gap-1 rounded-lg bg-primary/20 hover:bg-primary/30 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  <Plus className="h-3.5 w-3.5" /> Neu
                </button>
              </div>
              <p className="text-xs text-white/40 mb-3">
                Feiertage werden im Solver berücksichtigt: keine Anmeldungen, Slot wird als Feiertag markiert.
              </p>
              {feiertage.length === 0 ? (
                <p className="text-sm text-white/30 text-center py-4">Noch keine Einträge</p>
              ) : (
                <div className="space-y-1">
                  {feiertage.map((f) => (
                    <div key={f.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2">
                      <div className={cn(
                        "h-2 w-2 rounded-full shrink-0",
                        f.typ === "feiertag" ? "bg-amber-400" : "bg-emerald-400"
                      )} />
                      <span className="text-xs text-white/40 font-mono w-24 shrink-0">{f.datum.slice(0, 10)}</span>
                      <span className="text-sm text-white/80 flex-1 truncate">{f.name || (f.typ === "feiertag" ? "Feiertag" : "Ferien")}</span>
                      <button
                        onClick={() => handleDeleteFeiertag(f.id)}
                        className="rounded-lg p-1.5 text-white/30 hover:text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          )}

          <p className="text-center text-xs text-white/25">
            Server: <code className="bg-white/5 rounded px-1.5 py-0.5">
              {process.env.NEXT_PUBLIC_POCKETBASE_URL || (typeof window !== "undefined" ? `${window.location.origin}/dienstplan-pb` : "lokal")}
            </code>
          </p>
        </main>

        {showAddFeiertag && (
          <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowAddFeiertag(false)}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative w-full max-w-lg animate-in slide-in-from-bottom duration-300" onClick={(e) => e.stopPropagation()}>
              <div className="glass-strong rounded-t-3xl px-6 pt-4 pb-8 border-t border-white/15">
                <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20" />
                <h3 className="text-lg font-bold text-white mb-4">Neuer Feiertag / Ferientag</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-white/50 block mb-1.5">Datum</label>
                    <input
                      type="date"
                      value={newFeiertagDatum}
                      onChange={(e) => setNewFeiertagDatum(e.target.value)}
                      className="w-full rounded-xl bg-white/10 px-4 py-3 text-base text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-white/50 block mb-1.5">Name</label>
                    <input
                      type="text"
                      value={newFeiertagName}
                      onChange={(e) => setNewFeiertagName(e.target.value)}
                      placeholder="z.B. Pfingstmontag"
                      className="w-full rounded-xl bg-white/10 px-4 py-3 text-base text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-white/50 block mb-1.5">Typ</label>
                    <div className="flex gap-2">
                      {(["feiertag", "ferien"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setNewFeiertagTyp(t)}
                          className={cn(
                            "flex-1 rounded-xl py-3 text-sm font-medium transition-all",
                            newFeiertagTyp === t ? "bg-primary/20 text-white ring-1 ring-primary/30" : "bg-white/5 text-white/40"
                          )}
                        >
                          {t === "feiertag" ? "Feiertag" : "Ferien"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={handleAddFeiertag}
                    className="w-full rounded-2xl bg-gradient-to-r from-primary to-accent py-3 text-base font-bold text-white"
                  >
                    Speichern
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

function ToggleRow({
  icon,
  label,
  desc,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={cn(
        "w-full flex items-center gap-3 rounded-xl px-4 py-3 transition-all active:scale-[0.99]",
        value ? "bg-primary/15 ring-1 ring-primary/25" : "bg-white/[0.03] hover:bg-white/[0.05]"
      )}
    >
      <div className="h-9 w-9 shrink-0 rounded-lg bg-white/5 flex items-center justify-center">{icon}</div>
      <div className="flex-1 text-left min-w-0">
        <p className="text-sm font-medium text-white/85">{label}</p>
        <p className="text-xs text-white/40 truncate">{desc}</p>
      </div>
      <div
        className={cn(
          "h-6 w-10 rounded-full p-0.5 transition-colors shrink-0",
          value ? "bg-primary" : "bg-white/15"
        )}
      >
        <div
          className={cn(
            "h-5 w-5 rounded-full bg-white transition-transform",
            value && "translate-x-4"
          )}
        />
      </div>
    </button>
  );
}
