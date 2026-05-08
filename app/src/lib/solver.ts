import type { SchichtTyp } from "./types";

// What a person submitted for a day
export type PersonDayStatus = "verfuegbar" | "frei_wunsch" | "nicht_verfuegbar" | "leer";

export type PersonWunsch = {
  name: string;
  status: PersonDayStatus;
  dienstTypen: SchichtTyp[]; // preferred shift types (empty = any)
  von?: string;
  bis?: string;
  fairnessScore: number; // lower = got fewer wishes fulfilled = higher priority
};

export type SlotBedarf = {
  tag: number;
  typ: SchichtTyp;
  vonDefault: string;
  bisDefault: string;
};

export type SlotZuweisung = {
  tag: number;
  typ: SchichtTyp;
  von: string;
  bis: string;
  name: string;
  wunschErfuellt: boolean;
  erzwungen: boolean; // true = person didn't want this but was assigned by fairness
};

export type SolverKonflikt = {
  tag: number;
  typ: SchichtTyp;
  problem: string;
  schwere: "rot" | "gelb";
  verfuegbar: string[];
  freiWunsch: string[];
  nichtVerfuegbar: string[];
};

export type SolverResult = {
  zuweisungen: SlotZuweisung[];
  konflikte: SolverKonflikt[];
  statistik: {
    totalSlots: number;
    besetzt: number;
    wuenscheErfuellt: number;
    erzwungen: number;
  };
};

const PFLICHT_SLOTS: Omit<SlotBedarf, "tag">[] = [
  { typ: "tagdienst", vonDefault: "07:00", bisDefault: "19:00" },
  { typ: "nachtdienst", vonDefault: "19:00", bisDefault: "07:00" },
  { typ: "bd_tag", vonDefault: "07:00", bisDefault: "19:00" },
  { typ: "bd_nacht", vonDefault: "19:00", bisDefault: "07:00" },
];

/**
 * Generates the full Dienstplan based on everyone's wishes.
 *
 * Rules (in priority order):
 * 1. NEVER assign someone who is "nicht_verfuegbar" on that day
 * 2. Prefer people who marked "verfuegbar" and want that shift type
 * 3. If not enough: use "verfuegbar" people without shift preference
 * 4. If still not enough: use "frei_wunsch" people (would prefer free)
 * 5. If still not enough: use "leer" people (didn't submit anything)
 * 6. Fairness: among equal candidates, pick whoever has the lowest fairness score
 * 7. Balance: don't overload one person - track how many shifts assigned this month
 * 8. ALL slots MUST be filled
 */
export function solveDienstplan(
  year: number,
  month: number, // 0-indexed
  wuensche: Record<string, Record<number, PersonWunsch>>, // name -> day -> wish
  teamNames: string[],
  isAnmeldungTag: (day: number) => boolean
): SolverResult {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const zuweisungen: SlotZuweisung[] = [];
  const konflikte: SolverKonflikt[] = [];

  // Track assignments per person this month
  const assignCount: Record<string, number> = {};
  // Track which days each person is already assigned
  const assignedDays: Record<string, Set<number>> = {};
  for (const name of teamNames) {
    assignCount[name] = 0;
    assignedDays[name] = new Set();
  }

  // Build all required slots
  const allSlots: SlotBedarf[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    for (const slot of PFLICHT_SLOTS) {
      allSlots.push({ tag: day, ...slot });
    }
    if (isAnmeldungTag(day)) {
      allSlots.push({ tag: day, typ: "anmeldung", vonDefault: "09:00", bisDefault: "14:00" });
    }
  }

  // Sort slots by difficulty (fewest available people first)
  const slotDifficulty = (slot: SlotBedarf) => {
    let count = 0;
    for (const name of teamNames) {
      const w = wuensche[name]?.[slot.tag];
      if (!w || w.status === "nicht_verfuegbar") continue;
      count++;
    }
    return count;
  };
  allSlots.sort((a, b) => slotDifficulty(a) - slotDifficulty(b));

  // Assign each slot
  for (const slot of allSlots) {
    const candidates: {
      name: string;
      priority: number; // lower = better candidate
      wunschErfuellt: boolean;
    }[] = [];

    const verfuegbarNames: string[] = [];
    const freiWunschNames: string[] = [];
    const nichtVerfuegbarNames: string[] = [];

    for (const name of teamNames) {
      const w = wuensche[name]?.[slot.tag];
      const status = w?.status ?? "leer";
      const fairness = w?.fairnessScore ?? 50;

      if (status === "nicht_verfuegbar") {
        nichtVerfuegbarNames.push(name);
        continue;
      }

      // Skip if already assigned to a shift on this day
      if (assignedDays[name]?.has(slot.tag)) continue;

      // Calculate priority (lower = gets picked first)
      let priority = 0;

      if (status === "verfuegbar") {
        verfuegbarNames.push(name);
        const wantsThisType =
          w!.dienstTypen.length === 0 || w!.dienstTypen.includes(slot.typ);
        if (wantsThisType) {
          priority = 0; // Best: available and wants this type
        } else {
          priority = 100; // Available but prefers different type
        }
      } else if (status === "frei_wunsch") {
        freiWunschNames.push(name);
        priority = 200; // Would prefer free
      } else {
        // "leer" - didn't submit
        priority = 300;
      }

      // Fairness bonus: lower score = deserves more consideration
      priority += (100 - fairness) * -0.5;

      // Balance: more assignments = lower priority
      priority += (assignCount[name] || 0) * 10;

      candidates.push({
        name,
        priority,
        wunschErfuellt: status === "verfuegbar",
      });
    }

    // Sort by priority (lowest first)
    candidates.sort((a, b) => a.priority - b.priority);

    // If nobody is available, we MUST still assign someone.
    // Pick from "nicht_verfuegbar" people – whoever has fewest assignments + lowest fairness
    if (candidates.length === 0) {
      const lastResort = nichtVerfuegbarNames
        .filter((name) => !assignedDays[name]?.has(slot.tag))
        .map((name) => ({
          name,
          priority: (assignCount[name] || 0) * 10 + (100 - (wuensche[name]?.[slot.tag]?.fairnessScore ?? 50)) * -0.5,
          wunschErfuellt: false,
        }))
        .sort((a, b) => a.priority - b.priority);

      if (lastResort.length > 0) {
        candidates.push(lastResort[0]);
      } else {
        // Absolute last resort: someone already working that day
        const anyone = teamNames
          .map((name) => ({
            name,
            priority: (assignCount[name] || 0) * 10,
            wunschErfuellt: false,
          }))
          .sort((a, b) => a.priority - b.priority);
        if (anyone.length > 0) {
          candidates.push(anyone[0]);
        }
      }
    }

    const chosen = candidates[0];

    // Track conflict info
    if (!chosen.wunschErfuellt) {
      const severity = verfuegbarNames.length === 0 ? "gelb" : "gelb";
      konflikte.push({
        tag: slot.tag,
        typ: slot.typ,
        problem:
          verfuegbarNames.length === 0
            ? `Kein Wunsch-Match – ${chosen.name} wurde nach Fairness eingeteilt`
            : `${chosen.name} hatte lieber frei, wurde aber benotigt`,
        schwere: severity,
        verfuegbar: verfuegbarNames,
        freiWunsch: freiWunschNames,
        nichtVerfuegbar: nichtVerfuegbarNames,
      });
    }

    zuweisungen.push({
      tag: slot.tag,
      typ: slot.typ,
      von: slot.vonDefault,
      bis: slot.bisDefault,
      name: chosen.name,
      wunschErfuellt: chosen.wunschErfuellt,
      erzwungen: !chosen.wunschErfuellt,
    });

    assignCount[chosen.name] = (assignCount[chosen.name] || 0) + 1;
    assignedDays[chosen.name]?.add(slot.tag);
  }

  return {
    zuweisungen,
    konflikte: konflikte.filter((k) => k.schwere === "rot" || !zuweisungen.find(
      (z) => z.tag === k.tag && z.typ === k.typ && z.wunschErfuellt
    )),
    statistik: {
      totalSlots: allSlots.length,
      besetzt: zuweisungen.length,
      wuenscheErfuellt: zuweisungen.filter((z) => z.wunschErfuellt).length,
      erzwungen: zuweisungen.filter((z) => z.erzwungen).length,
    },
  };
}
