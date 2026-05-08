"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  className,
}: StatCardProps) {
  return (
    <div className={cn("glass rounded-2xl p-5 transition-glass glass-hover", className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-white/50 font-medium">{label}</p>
          <p className="mt-1 text-3xl font-bold text-white tracking-tight">
            {value}
          </p>
          {trend && (
            <p className="mt-1 text-xs text-emerald-400/80">{trend}</p>
          )}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5">
          <Icon className="h-5 w-5 text-white/40" />
        </div>
      </div>
    </div>
  );
}
