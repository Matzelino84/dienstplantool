"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { Calendar, AlertCircle, ChevronDown, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import pb from "@/lib/pocketbase";
import type { Hebamme } from "@/lib/types";

export default function LoginPage() {
  const { login, user } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<"name" | "pin">("name");
  const [selectedName, setSelectedName] = useState("");
  const [pin, setPin] = useState(["", "", "", ""]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [team, setTeam] = useState<Pick<Hebamme, "id" | "vorname" | "farbe">[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Redirect if already logged in
  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);

  // Load team names
  useEffect(() => {
    pb.collection("hebammen")
      .getFullList({ fields: "id,vorname,farbe", sort: "vorname", filter: "aktiv=true" })
      .then((records) =>
        setTeam(records as unknown as Pick<Hebamme, "id" | "vorname" | "farbe">[])
      )
      .catch(() => {});
  }, []);

  const handleNameSelect = (name: string) => {
    setSelectedName(name);
    setPickerOpen(false);
    setStep("pin");
    setPin(["", "", "", ""]);
    setError("");
    // Focus first pin input after render
    setTimeout(() => pinRefs.current[0]?.focus(), 250);
  };

  const handlePinInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const digit = value.slice(-1);
    const newPin = [...pin];
    newPin[index] = digit;
    setPin(newPin);
    setError("");

    if (digit && index < 3) {
      pinRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 4 digits entered
    if (digit && index === 3) {
      const fullPin = newPin.join("");
      if (fullPin.length === 4) {
        submitLogin(fullPin);
      }
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      pinRefs.current[index - 1]?.focus();
    }
  };

  const submitLogin = async (fullPin: string) => {
    setIsLoading(true);
    setError("");
    try {
      await login(selectedName, fullPin);
      router.replace("/");
    } catch {
      setError("PIN falsch");
      setPin(["", "", "", ""]);
      pinRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-mesh">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-accent mb-4">
            <Calendar className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gradient">Dienstplan</h1>
          <p className="text-sm text-white/40 mt-1">Hebammen-Schichtplanung</p>
        </div>

        {step === "name" ? (
          /* ===== NAME SELECTION ===== */
          <div>
            <p className="text-center text-lg text-white/70 mb-6">
              Wer bist du?
            </p>
            <button
              onClick={() => setPickerOpen(true)}
              className="w-full glass glass-hover transition-glass rounded-2xl px-5 py-5 flex items-center gap-4 active:scale-[0.99] ring-1 ring-white/10"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                <Calendar className="h-5 w-5 text-white/50" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-xs text-white/40 mb-0.5">Person</p>
                <p className="text-lg font-semibold text-white/90">Auswählen…</p>
              </div>
              <ChevronDown className="h-5 w-5 text-white/40 shrink-0" />
            </button>
            <p className="text-center text-xs text-white/30 mt-4">
              Tippe oben, um deinen Namen aus der Liste zu wählen
            </p>
          </div>
        ) : (
          /* ===== PIN ENTRY ===== */
          <div>
            <button
              onClick={() => { setStep("name"); setError(""); }}
              className="text-sm text-white/40 hover:text-white/60 mb-6 transition-colors"
            >
              &larr; Andere Person wahlen
            </button>

            <div className="glass-strong rounded-3xl p-8">
              <p className="text-center text-lg font-semibold text-white mb-2">
                Hallo {selectedName}!
              </p>
              <p className="text-center text-sm text-white/40 mb-8">
                Gib deine 4-stellige PIN ein
              </p>

              {/* PIN Inputs */}
              <div className="flex justify-center gap-4 mb-6">
                {pin.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { pinRefs.current[i] = el; }}
                    type="tel"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handlePinInput(i, e.target.value)}
                    onKeyDown={(e) => handlePinKeyDown(i, e)}
                    className={cn(
                      "h-16 w-14 rounded-2xl bg-white/5 border-2 text-center text-2xl font-bold text-white caret-transparent focus:outline-none transition-all",
                      digit
                        ? "border-primary/50 bg-primary/10"
                        : "border-white/10 focus:border-primary/30",
                      error && "border-red-400/50 bg-red-500/10"
                    )}
                    autoComplete="off"
                  />
                ))}
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center justify-center gap-2 text-sm text-red-400 mb-4">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              {/* Loading */}
              {isLoading && (
                <p className="text-center text-sm text-white/40 animate-pulse">
                  Wird gepruft...
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Person-Picker Bottom-Sheet */}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          onClick={() => setPickerOpen(false)}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="glass-strong rounded-t-3xl px-5 pt-4 pb-6 border-t border-white/15 max-h-[85vh] overflow-y-auto">
              <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/25" />
              <div className="flex items-center justify-between mb-5 px-1">
                <h3 className="text-xl font-bold text-white">Wer bist du?</h3>
                <button
                  onClick={() => setPickerOpen(false)}
                  className="rounded-xl p-2 text-white/50 hover:text-white hover:bg-white/10 active:scale-95"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              {team.length === 0 ? (
                <p className="text-center text-sm text-white/40 py-10">Lade Team…</p>
              ) : (
                <div className="space-y-2">
                  {team.map((member) => {
                    const isCurrent = member.vorname === selectedName;
                    return (
                      <button
                        key={member.id}
                        onClick={() => handleNameSelect(member.vorname)}
                        className={cn(
                          "w-full flex items-center gap-4 rounded-2xl px-4 py-4 transition-glass active:scale-[0.99] ring-1",
                          isCurrent
                            ? "bg-primary/20 ring-primary/40"
                            : "bg-white/[0.04] ring-white/10 hover:bg-white/10"
                        )}
                      >
                        <div
                          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white font-bold text-2xl"
                          style={{ backgroundColor: (member.farbe || "#666") + "40" }}
                        >
                          {member.vorname[0]}
                        </div>
                        <span className="flex-1 text-left text-xl font-semibold text-white truncate">
                          {member.vorname}
                        </span>
                        {isCurrent && <Check className="h-5 w-5 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
