"use client";

import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import {
  Calendar,
  ClipboardList,
  DoorOpen,
  Menu,
  Settings,
  Shield,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, useEffect, useCallback } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly: boolean;
  colorFrom: string;
  colorTo: string;
};

const PRIMARY_ITEMS: NavItem[] = [
  { href: "/wunschplan", label: "Wunschplan", icon: ClipboardList, adminOnly: false, colorFrom: "rgba(139,92,246,0.45)", colorTo: "rgba(217,70,239,0.45)" },
  { href: "/dienstplan", label: "Plan", icon: Calendar, adminOnly: false, colorFrom: "rgba(6,182,212,0.45)", colorTo: "rgba(59,130,246,0.45)" },
];

const SECONDARY_ITEMS: NavItem[] = [
  { href: "/einstellungen", label: "Profil", icon: Settings, adminOnly: false, colorFrom: "rgba(168,85,247,0.45)", colorTo: "rgba(217,70,239,0.45)" },
  { href: "/team", label: "Team", icon: Users, adminOnly: true, colorFrom: "rgba(16,185,129,0.45)", colorTo: "rgba(20,184,166,0.45)" },
  { href: "/admin", label: "Admin", icon: Shield, adminOnly: true, colorFrom: "rgba(245,158,11,0.45)", colorTo: "rgba(249,115,22,0.45)" },
];

function isItemActive(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(href));
}

function TabContainer({
  items,
  pathname,
  onPick,
}: {
  items: NavItem[];
  pathname: string;
  onPick: (href: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);
  const hasMeasured = useRef(false);

  const activeIndex = Math.max(0, items.findIndex((item) => isItemActive(pathname, item.href)));
  const isOnTab = items.some((item) => isItemActive(pathname, item.href));

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

  const activeItem = items[activeIndex];
  const bgGradient = activeItem && isOnTab
    ? `linear-gradient(to right, ${activeItem.colorFrom}, ${activeItem.colorTo})`
    : "transparent";

  return (
    <div ref={containerRef} className="relative flex items-center rounded-2xl bg-white/[0.04] p-1">
      {indicator && isOnTab && (
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
      {items.map((item, i) => {
        const isActive = isOnTab && i === activeIndex;
        return (
          <button
            key={item.href}
            ref={(el) => { tabRefs.current[i] = el; }}
            onClick={() => onPick(item.href)}
            className={cn(
              "relative z-10 flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors duration-700 ease-out sm:px-3.5",
              isActive ? "text-white" : "text-white/30"
            )}
          >
            <item.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAdmin, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const visibleSecondary = SECONDARY_ITEMS.filter((item) => !item.adminOnly || isAdmin);
  const allDesktopItems = [...PRIMARY_ITEMS, ...visibleSecondary];

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    router.replace("/login");
  };

  const handlePick = (href: string) => {
    setMenuOpen(false);
    router.push(href);
  };

  // Lock body scroll while menu is open
  useEffect(() => {
    if (menuOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [menuOpen]);

  return (
    <>
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

            {/* Mobile: only primary tabs + burger */}
            <div className="flex items-center gap-2 sm:hidden">
              <TabContainer items={PRIMARY_ITEMS} pathname={pathname} onPick={handlePick} />
              <button
                onClick={() => setMenuOpen(true)}
                className="flex items-center justify-center rounded-xl p-2.5 mr-[5px] text-white/60 hover:text-white hover:bg-white/8 transition-glass active:scale-95"
                aria-label="Menü"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>

            {/* Desktop / Tablet: full tabs + dedicated logout */}
            <div className="hidden sm:flex items-center gap-2">
              <TabContainer items={allDesktopItems} pathname={pathname} onPick={handlePick} />
              <button
                onClick={handleLogout}
                className="flex items-center justify-center rounded-xl p-2.5 mr-[10px] text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-glass active:scale-95"
                aria-label="Abmelden"
              >
                <DoorOpen className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile burger drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60] sm:hidden" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="absolute right-0 top-0 h-full w-72 max-w-[85vw] glass-strong border-l border-white/15 animate-in slide-in-from-right duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                {user && <span className="text-base font-semibold text-white truncate">{user.vorname}</span>}
                {isAdmin && <Shield className="h-4 w-4 text-amber-400" />}
              </div>
              <button
                onClick={() => setMenuOpen(false)}
                className="rounded-xl p-2 text-white/40 hover:text-white hover:bg-white/10"
                aria-label="Schließen"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col p-3 gap-1">
              {visibleSecondary.map((item) => {
                const active = isItemActive(pathname, item.href);
                return (
                  <button
                    key={item.href}
                    onClick={() => handlePick(item.href)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-3 text-base font-medium transition-all active:scale-[0.98]",
                      active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-lg"
                      style={{
                        background: active
                          ? `linear-gradient(to bottom right, ${item.colorFrom}, ${item.colorTo})`
                          : "rgba(255,255,255,0.05)",
                      }}
                    >
                      <item.icon className="h-4 w-4" />
                    </div>
                    {item.label}
                  </button>
                );
              })}

              <div className="my-2 border-t border-white/10" />

              <button
                onClick={handleLogout}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-base font-medium text-white/70 hover:bg-red-500/10 hover:text-red-300 transition-all active:scale-[0.98]"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5">
                  <DoorOpen className="h-4 w-4" />
                </div>
                Abmelden
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
