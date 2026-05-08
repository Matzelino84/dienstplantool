"use client";

import {
  Calendar,
  CheckCircle2,
  Clock,
  Heart,
  TrendingUp,
  Users,
} from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { NavBar } from "@/components/ui/nav-bar";
import { StatCard } from "@/components/ui/stat-card";

export default function Dashboard() {
  return (
    <div className="flex min-h-screen flex-col">
      <NavBar />
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Guten Tag
          </h1>
          <p className="mt-1 text-white/50">
            Dienstplan-Ubersicht fur Mai 2026
          </p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
          <StatCard
            label="Team"
            value={14}
            icon={Users}
            trend="Alle aktiv"
          />
          <StatCard
            label="Offene Slots"
            value={0}
            icon={CheckCircle2}
            trend="100% besetzt"
          />
          <StatCard
            label="Wunsche erfullt"
            value="87%"
            icon={Heart}
          />
          <StatCard
            label="Anmeldungen"
            value={9}
            icon={Calendar}
            trend="Di & Fr"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Current Month Plan Preview */}
          <GlassCard className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">
                Aktueller Dienstplan
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                Freigegeben
              </span>
            </div>

            {/* Mini Calendar Grid */}
            <div className="space-y-2">
              {/* Header */}
              <div className="grid grid-cols-8 gap-2 text-xs text-white/40 font-medium">
                <div className="px-2">Tag</div>
                <div className="px-2">Datum</div>
                <div className="px-2 text-center">Tagdienst</div>
                <div className="px-2 text-center">BD Tag</div>
                <div className="px-2 text-center">BD Nacht</div>
                <div className="px-2 text-center">Nachtdienst</div>
                <div className="px-2 text-center">Anmeldung</div>
                <div className="px-2 text-center">Status</div>
              </div>

              {/* Example Rows */}
              {[
                {
                  tag: "Fr",
                  datum: "01.",
                  slots: ["Alena", "Lilly", "Tatjana", "Lisa", "—"],
                },
                {
                  tag: "Sa",
                  datum: "02.",
                  slots: ["Pati", "Fabienne", "—", "Fabienne", ""],
                },
                {
                  tag: "So",
                  datum: "03.",
                  slots: ["Lilly", "Anna", "—", "Fabienne", ""],
                },
                {
                  tag: "Mo",
                  datum: "04.",
                  slots: ["Lena", "Lea", "Lilly", "Alena", ""],
                },
                {
                  tag: "Di",
                  datum: "05.",
                  slots: ["Lea", "Tatjana", "Anna", "Lena", "Johanna"],
                },
              ].map((row, i) => (
                <div
                  key={i}
                  className="grid grid-cols-8 gap-2 glass-subtle rounded-xl py-2 px-1 items-center glass-hover transition-glass"
                >
                  <div className="px-2 text-sm font-medium text-white/70">
                    {row.tag}
                  </div>
                  <div className="px-2 text-sm text-white/50">{row.datum}</div>
                  {row.slots.map((name, j) => (
                    <div key={j} className="text-center">
                      {name && name !== "—" ? (
                        <span className="inline-block rounded-lg bg-white/8 px-2 py-0.5 text-xs font-medium text-white/80">
                          {name}
                        </span>
                      ) : name === "—" ? (
                        <span className="text-xs text-white/20">—</span>
                      ) : null}
                    </div>
                  ))}
                  <div className="text-center">
                    <div className="h-2 w-2 rounded-full bg-emerald-400 mx-auto" />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-center">
              <a
                href="/dienstplan"
                className="text-sm text-white/40 hover:text-white/70 transition-colors"
              >
                Vollstandigen Plan anzeigen &rarr;
              </a>
            </div>
          </GlassCard>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <GlassCard>
              <h2 className="text-lg font-semibold text-white mb-4">
                Schnellaktionen
              </h2>
              <div className="space-y-3">
                <a
                  href="/wunschplan"
                  className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-primary/20 to-accent/20 p-3 transition-glass hover:from-primary/30 hover:to-accent/30"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/20">
                    <Heart className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      Wunschplan eintragen
                    </p>
                    <p className="text-xs text-white/40">
                      Verfugbarkeiten fur Juni 2026
                    </p>
                  </div>
                </a>

                <a
                  href="/dienstplan"
                  className="flex items-center gap-3 rounded-xl bg-white/5 p-3 transition-glass hover:bg-white/8"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
                    <TrendingUp className="h-4 w-4 text-white/60" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      Plan generieren
                    </p>
                    <p className="text-xs text-white/40">
                      Optimalen Plan berechnen
                    </p>
                  </div>
                </a>
              </div>
            </GlassCard>

            {/* Timeline */}
            <GlassCard>
              <h2 className="text-lg font-semibold text-white mb-4">
                Zeitplan
              </h2>
              <div className="space-y-4">
                {[
                  {
                    date: "01.–15. Mai",
                    label: "Wunsche eintragen",
                    status: "done",
                  },
                  {
                    date: "16. Mai",
                    label: "Plan generieren",
                    status: "done",
                  },
                  {
                    date: "17.–20. Mai",
                    label: "Admin-Review",
                    status: "active",
                  },
                  {
                    date: "21. Mai",
                    label: "Freigabe",
                    status: "pending",
                  },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {item.status === "done" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : item.status === "active" ? (
                        <Clock className="h-4 w-4 text-primary" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border border-white/20" />
                      )}
                    </div>
                    <div>
                      <p
                        className={`text-sm font-medium ${
                          item.status === "active"
                            ? "text-white"
                            : "text-white/60"
                        }`}
                      >
                        {item.label}
                      </p>
                      <p className="text-xs text-white/30">{item.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        </div>
      </main>
    </div>
  );
}
