"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { Calendar, AlertCircle } from "lucide-react";
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
    setStep("pin");
    setPin(["", "", "", ""]);
    setError("");
    // Focus first pin input after render
    setTimeout(() => pinRefs.current[0]?.focus(), 100);
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
            <p className="text-center text-base text-white/60 mb-6">
              Wer bist du?
            </p>
            <div className="grid grid-cols-2 gap-3">
              {team.map((member) => (
                <button
                  key={member.id}
                  onClick={() => handleNameSelect(member.vorname)}
                  className="glass glass-hover transition-glass rounded-2xl px-4 py-4 flex items-center gap-3 active:scale-95"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white font-bold text-lg"
                    style={{ backgroundColor: (member.farbe || "#666") + "30" }}
                  >
                    {member.vorname[0]}
                  </div>
                  <span className="text-sm font-medium text-white/80 truncate">
                    {member.vorname}
                  </span>
                </button>
              ))}
            </div>
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
    </div>
  );
}
