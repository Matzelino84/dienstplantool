"use client";

import { AuthGuard } from "@/components/auth-guard";
import { NavBar } from "@/components/ui/nav-bar";
import { GlassCard } from "@/components/ui/glass-card";
import { Database, Globe, Key, Bell } from "lucide-react";

export default function EinstellungenPage() {
  return (
    <AuthGuard>
    <div className="flex min-h-screen flex-col">
      <NavBar />
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Einstellungen
          </h1>
          <p className="mt-1 text-white/50">
            System- und App-Konfiguration
          </p>
        </div>

        <div className="space-y-6">
          <GlassCard>
            <div className="flex items-center gap-3 mb-4">
              <Database className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-white">
                PocketBase
              </h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Server URL</span>
                <code className="text-sm text-white/40 bg-white/5 px-3 py-1 rounded-lg">
                  http://127.0.0.1:8090
                </code>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Status</span>
                <span className="inline-flex items-center gap-1.5 text-sm text-emerald-400">
                  <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Verbunden
                </span>
              </div>
            </div>
          </GlassCard>

          <GlassCard>
            <div className="flex items-center gap-3 mb-4">
              <Key className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-white">
                Schicht-Regeln
              </h2>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-white/60">Anmeldungstage</span>
                <span className="text-white/80">Dienstag & Freitag</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Feiertag-Verschiebung</span>
                <span className="text-white/80">Fr → Do</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Mind. Anmeldungen/Person</span>
                <span className="text-white/80">1 pro Monat</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Pflicht-Slots/Tag</span>
                <span className="text-white/80">
                  Tag + Nacht + BD (Tag/Nacht)
                </span>
              </div>
            </div>
          </GlassCard>

          <GlassCard>
            <div className="flex items-center gap-3 mb-4">
              <Bell className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-white">
                Benachrichtigungen
              </h2>
            </div>
            <p className="text-sm text-white/40">
              Kommt bald: E-Mail und Push-Benachrichtigungen fur Deadlines
              und Plan-Freigaben.
            </p>
          </GlassCard>
        </div>
      </main>
    </div>
    </AuthGuard>
  );
}
