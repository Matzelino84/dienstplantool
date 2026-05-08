"use client";

import { NavBar } from "@/components/ui/nav-bar";
import { GlassCard } from "@/components/ui/glass-card";
import { UserPlus, Mail, Shield, User } from "lucide-react";
import { cn } from "@/lib/utils";

const DEMO_TEAM = [
  { name: "Alena", rolle: "admin", farbe: "#f59e0b", dienste: 8, score: 92 },
  { name: "Lena", rolle: "hebamme", farbe: "#3b82f6", dienste: 9, score: 85 },
  { name: "Lea", rolle: "hebamme", farbe: "#8b5cf6", dienste: 7, score: 90 },
  { name: "Tatjana", rolle: "hebamme", farbe: "#ec4899", dienste: 8, score: 88 },
  { name: "Fabienne", rolle: "hebamme", farbe: "#10b981", dienste: 10, score: 78 },
  { name: "Lisa", rolle: "hebamme", farbe: "#f97316", dienste: 7, score: 94 },
  { name: "Jessy", rolle: "hebamme", farbe: "#06b6d4", dienste: 9, score: 82 },
  { name: "Johanna", rolle: "hebamme", farbe: "#84cc16", dienste: 8, score: 87 },
  { name: "Pati", rolle: "hebamme", farbe: "#e11d48", dienste: 8, score: 89 },
  { name: "Lilly", rolle: "hebamme", farbe: "#7c3aed", dienste: 7, score: 93 },
  { name: "Anna", rolle: "hebamme", farbe: "#14b8a6", dienste: 9, score: 81 },
  { name: "Serena", rolle: "hebamme", farbe: "#f43f5e", dienste: 6, score: 96 },
  { name: "Teresa", rolle: "hebamme", farbe: "#0ea5e9", dienste: 8, score: 86 },
  { name: "Martina", rolle: "hebamme", farbe: "#a855f7", dienste: 7, score: 91 },
];

export default function TeamPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <NavBar />
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              Team
            </h1>
            <p className="mt-1 text-white/50">
              {DEMO_TEAM.length} Hebammen im Team
            </p>
          </div>
          <button className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-4 py-2.5 text-sm font-semibold text-white transition-glass hover:opacity-90 glow">
            <UserPlus className="h-4 w-4" />
            Einladen
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DEMO_TEAM.map((member) => (
            <GlassCard
              key={member.name}
              hover
              className="flex items-start gap-4"
            >
              {/* Avatar */}
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white font-bold text-lg"
                style={{ backgroundColor: member.farbe + "30" }}
              >
                {member.name[0]}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white truncate">
                    {member.name}
                  </h3>
                  {member.rolle === "admin" && (
                    <Shield className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  )}
                </div>
                <p className="text-xs text-white/40 capitalize">
                  {member.rolle}
                </p>

                {/* Stats */}
                <div className="mt-3 flex items-center gap-4">
                  <div className="text-xs">
                    <span className="text-white/40">Dienste: </span>
                    <span className="text-white/70 font-medium">
                      {member.dienste}
                    </span>
                  </div>
                  <div className="text-xs">
                    <span className="text-white/40">Fairness: </span>
                    <span
                      className={cn(
                        "font-medium",
                        member.score >= 90
                          ? "text-emerald-400"
                          : member.score >= 80
                          ? "text-amber-400"
                          : "text-red-400"
                      )}
                    >
                      {member.score}%
                    </span>
                  </div>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </main>
    </div>
  );
}
