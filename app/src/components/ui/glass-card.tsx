"use client";

import { cn } from "@/lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "strong" | "subtle";
  glow?: boolean;
  hover?: boolean;
}

export function GlassCard({
  className,
  variant = "default",
  glow = false,
  hover = false,
  children,
  ...props
}: GlassCardProps) {
  const variants = {
    default: "glass",
    strong: "glass-strong",
    subtle: "glass-subtle",
  };

  return (
    <div
      className={cn(
        variants[variant],
        "rounded-2xl p-6",
        hover && "glass-hover transition-glass cursor-pointer",
        glow && "glow",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
