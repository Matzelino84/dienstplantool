"use client";

import { cn } from "@/lib/utils";
import {
  Calendar,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/wunschplan", label: "Wunschplan", icon: ClipboardList },
  { href: "/dienstplan", label: "Dienstplan", icon: Calendar },
  { href: "/team", label: "Team", icon: Users },
  { href: "/einstellungen", label: "Einstellungen", icon: Settings },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="glass-strong sticky top-0 z-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-semibold text-gradient hidden sm:block">
              Dienstplan
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-glass",
                    isActive
                      ? "glass-strong text-white glow"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* User / Logout */}
          <button className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-glass">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:block">Abmelden</span>
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="flex md:hidden items-center justify-around py-2 border-t border-white/10">
        {NAV_ITEMS.slice(0, 4).map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1 rounded-xl text-xs transition-glass",
                isActive ? "text-white" : "text-white/40"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
