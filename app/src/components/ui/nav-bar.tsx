"use client";

import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import {
  Calendar,
  ClipboardList,
  DoorOpen,
  Shield,
  Users,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, useEffect, useCallback } from "react";

const NAV_ITEMS = [
  { href: "/wunschplan", label: "Wunschplan", icon: ClipboardList, adminOnly: false, colorFrom: "rgba(139,92,246,0.45)", colorTo: "rgba(217,70,239,0.45)" },
  { href: "/dienstplan", label: "Dienstplan", icon: Calendar, adminOnly: false, colorFrom: "rgba(6,182,212,0.45)", colorTo: "rgba(59,130,246,0.45)" },
  { href: "/team", label: "Team", icon: Users, adminOnly: true, colorFrom: "rgba(16,185,129,0.45)", colorTo: "rgba(20,184,166,0.45)" },
  { href: "/admin", label: "Admin", icon: Shield, adminOnly: true, colorFrom: "rgba(245,158,11,0.45)", colorTo: "rgba(249,115,22,0.45)" },
];

export function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAdmin, logout } = useAuth();

  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);
  const activeIndex = Math.max(0, visibleItems.findIndex(
    (item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
  ));

  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);
  const hasMeasured = useRef(false);

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  const measure = useCallback(() => {
    const tab = tabRefs.current[activeIndex];
    const container = containerRef.current;
    if (tab && container) {
      const tabRect = tab.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      setIndicator({
        left: tabRect.left - containerRect.left,
        width: tabRect.width,
      });
      hasMeasured.current = true;
    }
  }, [activeIndex]);

  useEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const activeItem = visibleItems[activeIndex];
  const bgGradient = activeItem
    ? `linear-gradient(to right, ${activeItem.colorFrom}, ${activeItem.colorTo})`
    : "transparent";

  return (
    <nav className="glass-strong sticky top-0 z-50">
      <div className="mx-auto max-w-2xl px-4">
        <div className="flex items-center justify-between h-14">
          {/* User name left */}
          <div className="flex items-center gap-1.5 min-w-0 ml-[5px]">
            {user && (
              <span className="text-base font-semibold text-white truncate">
                {user.vorname}
              </span>
            )}
            {isAdmin && <Shield className="h-4 w-4 text-amber-400 shrink-0" />}
          </div>

          {/* Nav tabs center */}
          <div ref={containerRef} className="relative flex items-center rounded-2xl bg-white/[0.04] p-1">
            {/* Sliding indicator with inline gradient for smooth color transition */}
            {indicator && (
              <div
                className="absolute rounded-xl"
                style={{
                  left: `${indicator.left}px`,
                  width: `${indicator.width}px`,
                  top: "4px",
                  bottom: "4px",
                  background: bgGradient,
                  transition: hasMeasured.current
                    ? "left 700ms cubic-bezier(0.25, 0.8, 0.25, 1), width 700ms cubic-bezier(0.25, 0.8, 0.25, 1), background 700ms ease"
                    : "none",
                }}
              />
            )}
            {visibleItems.map((item, i) => {
              const isActive = i === activeIndex;
              return (
                <button
                  key={item.href}
                  ref={(el) => { tabRefs.current[i] = el; }}
                  onClick={() => router.push(item.href)}
                  className={cn(
                    "relative z-10 flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors duration-700 ease-out",
                    isActive ? "text-white" : "text-white/30"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Logout right */}
          <button
            onClick={handleLogout}
            className="flex items-center justify-center rounded-xl p-2.5 mr-[10px] text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-glass active:scale-95"
          >
            <DoorOpen className="h-5 w-5" />
          </button>
        </div>
      </div>
    </nav>
  );
}
