import type { SchichtTyp, HebammeSettings } from "./types";

// Per-day status of one person
export type PersonDayStatus =
  | "verfuegbar"
  | "frei_schoen"
  | "frei_wichtig"
  | "urlaub"
  | "leer";

export type PersonWunsch = {
  name: string;
  status: PersonDayStatus;
  dienste: { typ: SchichtTyp; zeit_von: string; zeit_bis: string }[]; // explicit shift preferences with times
  fairnessScore: number; // 0..100, lower = priority
  settings: HebammeSettings;
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
  erzwungen: boolean;
};

export type SolverKonflikt = {
  tag: number;
  typ: SchichtTyp;
  problem: string;
  schwere: "rot" | "gelb";
  verfuegbar: string[];
  freiSchoen: string[];
  freiWichtig: string[];
  urlaub: string[];
};

export type SolverResult = {
  zuweisungen: SlotZuweisung[];
  konflikte: SolverKonflikt[];
  statistik: {
    totalSlots: number;
    besetzt: number;
    wuenscheErfuellt: number;
    erzwungen: number;
    weVerteilung: Record<string, number>;
  };
};

const PFLICHT_SLOTS: Omit<SlotBedarf, "tag">[] = [
  { typ: "tagdienst", vonDefault: "07:00", bisDefault: "19:00" },
  { typ: "nachtdienst", vonDefault: "19:00", bisDefault: "07:00" },
  { typ: "bd_tag", vonDefault: "07:00", bisDefault: "19:00" },
  { typ: "bd_nacht", vonDefault: "19:00", bisDefault: "07:00" },
];

const isWeekend = (year: number, month: number, day: number) => {
  const d = new Date(year, month, day).getDay();
  return d === 0 || d === 6;
};

const countWeekends = (year: number, month: number, daysInMonth: number) => {
  let saSo = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month, d).getDay();
    if (dow === 6) saSo++; // count Saturdays = number of weekends
  }
  return saSo;
};

const isFestActiveTyp = (typ: SchichtTyp) =>
  typ === "tagdienst" || typ === "nachtdienst";

const isBdTyp = (typ: SchichtTyp) => typ === "bd_tag" || typ === "bd_nacht";

export function solveDienstplan(
  year: number,
  month: number, // 0-indexed
  wuensche: Record<string, Record<number, PersonWunsch>>,
  teamNames: string[],
  isAnmeldungTag: (day: number) => boolean,
  isFeiertag: (day: number) => boolean = () => false
): SolverResult {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const zuweisungen: SlotZuweisung[] = [];
  const konflikte: SolverKonflikt[] = [];

  const assignCount: Record<string, number> = {};
  const assignedDays: Record<string, Set<number>> = {};
  const assignedDaysAll: Record<string, Set<number>> = {}; // including BD nights
  const tdNdCount: Record<string, { td: number; nd: number }> = {};
  const bdCount: Record<string, { tag: number; nacht: number }> = {};
  const weCount: Record<string, number> = {};
  const anmeldungCount: Record<string, number> = {};

  for (const name of teamNames) {
    assignCount[name] = 0;
    assignedDays[name] = new Set();
    assignedDaysAll[name] = new Set();
    tdNdCount[name] = { td: 0, nd: 0 };
    bdCount[name] = { tag: 0, nacht: 0 };
    weCount[name] = 0;
    anmeldungCount[name] = 0;
  }

  // Build all required slots for the month
  const allSlots: SlotBedarf[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    for (const slot of PFLICHT_SLOTS) {
      allSlots.push({ tag: day, ...slot });
    }
    if (isAnmeldungTag(day) && !isFeiertag(day)) {
      allSlots.push({
        tag: day,
        typ: "anmeldung",
        vonDefault: "09:00",
        bisDefault: "14:00",
      });
    }
  }

  // Compute weekend allowance per person (default depending on number of weekends)
  const weekendCount = countWeekends(year, month, daysInMonth);
  const defaultWEMax = weekendCount >= 5 ? 3 : 2;

  // Sort: most constrained slots first
  const slotDifficulty = (slot: SlotBedarf) => {
    let count = 0;
    for (const name of teamNames) {
      const w = wuensche[name]?.[slot.tag];
      if (!w) continue;
      if (w.status === "urlaub" || w.status === "frei_wichtig") continue;
      // Hard person constraints reduce eligibility
      const s = w.settings || {};
      if (s.nur_tagdienste && (slot.typ === "nachtdienst" || slot.typ === "bd_nacht")) continue;
      if (s.nur_bds && (slot.typ === "tagdienst" || slot.typ === "nachtdienst" || slot.typ === "anmeldung")) continue;
      if (s.keine_anmeldung && slot.typ === "anmeldung") continue;
      count++;
    }
    return count;
  };
  allSlots.sort((a, b) => slotDifficulty(a) - slotDifficulty(b));

  for (const slot of allSlots) {
    const verfuegbarNames: string[] = [];
    const freiSchoenNames: string[] = [];
    const freiWichtigNames: string[] = [];
    const urlaubNames: string[] = [];

    type Cand = {
      name: string;
      priority: number;
      wunschErfuellt: boolean;
      von: string;
      bis: string;
    };
    const candidates: Cand[] = [];
    const dayIsWE = isWeekend(year, month, slot.tag);

    for (const name of teamNames) {
      const w = wuensche[name]?.[slot.tag];
      const status: PersonDayStatus = w?.status ?? "leer";
      const settings: HebammeSettings = w?.settings || {};

      // Hard constraints — never assign
      if (status === "urlaub") {
        urlaubNames.push(name);
        continue;
      }
      if (settings.nur_tagdienste && (slot.typ === "nachtdienst" || slot.typ === "bd_nacht")) continue;
      if (settings.nur_bds && (slot.typ === "tagdienst" || slot.typ === "nachtdienst" || slot.typ === "anmeldung")) continue;
      if (settings.keine_anmeldung && slot.typ === "anmeldung") continue;

      // Avoid double-booking same day on a "core" shift
      if (assignedDays[name]?.has(slot.tag)) continue;

      let priority = 0;
      let wunschErfuellt = false;
      let von = slot.vonDefault;
      let bis = slot.bisDefault;

      if (status === "verfuegbar") {
        verfuegbarNames.push(name);
        const dienste = w!.dienste;
        const matchingDienst = dienste.find((d) => d.typ === slot.typ);
        if (matchingDienst) {
          priority = 0;
          wunschErfuellt = true;
          von = matchingDienst.zeit_von || slot.vonDefault;
          bis = matchingDienst.zeit_bis || slot.bisDefault;
        } else if (dienste.length === 0) {
          priority = 50; // available, no specific preference
          wunschErfuellt = true;
        } else {
          priority = 200; // available but prefers different shift type
        }
      } else if (status === "frei_schoen") {
        freiSchoenNames.push(name);
        priority = 400;
      } else if (status === "frei_wichtig") {
        freiWichtigNames.push(name);
        priority = 800; // strong penalty – avoid unless absolutely necessary
        continue; // don't even consider unless we hit the last-resort branch
      } else {
        // leer
        priority = 300;
      }

      // Person prefers night shifts
      if (settings.lieber_nachtdienste) {
        if (slot.typ === "nachtdienst") priority -= 20;
        else if (slot.typ === "tagdienst") priority += 10;
      }

      // Fairness bonus
      priority += (100 - (w?.fairnessScore ?? 50)) * -0.5;

      // Balance: more assignments = lower priority
      priority += (assignCount[name] || 0) * 10;

      // TD/ND balance: prefer the underrepresented side
      if (isFestActiveTyp(slot.typ)) {
        const stat = tdNdCount[name];
        const diff = slot.typ === "tagdienst" ? stat.td - stat.nd : stat.nd - stat.td;
        priority += diff * 8; // pushing person whose count for this side is already higher
      }

      // BD balance
      if (isBdTyp(slot.typ)) {
        const stat = bdCount[name];
        const diff = slot.typ === "bd_tag" ? stat.tag - stat.nacht : stat.nacht - stat.tag;
        priority += diff * 5;
      }

      // Anmeldung target: minimum 1, soft cap based on ziel (currently we only have global ziel so use 2)
      if (slot.typ === "anmeldung") {
        priority += anmeldungCount[name] * 12;
      }

      // Weekend fairness
      if (dayIsWE) {
        const max = settings.max_we_dienste && settings.max_we_dienste > 0 ? settings.max_we_dienste : defaultWEMax;
        if (weCount[name] >= max) priority += 600;
        priority += weCount[name] * 15;
      }

      // 24h-BD bonus: if person prefers 24h BD AND already has same-day BD of complementary type, boost
      if (settings.bd_24h && isBdTyp(slot.typ)) {
        const compl: SchichtTyp = slot.typ === "bd_tag" ? "bd_nacht" : "bd_tag";
        const hasCompl = zuweisungen.some(
          (z) => z.tag === slot.tag && z.typ === compl && z.name === name
        );
        if (hasCompl) priority -= 80;
      }

      candidates.push({ name, priority, wunschErfuellt, von, bis });
    }

    // Last resort: include freiWichtig people (skipping those already excluded)
    if (candidates.length === 0) {
      for (const name of freiWichtigNames) {
        if (assignedDays[name]?.has(slot.tag)) continue;
        const w = wuensche[name]?.[slot.tag];
        const settings = w?.settings || {};
        if (settings.nur_tagdienste && (slot.typ === "nachtdienst" || slot.typ === "bd_nacht")) continue;
        if (settings.nur_bds && (slot.typ === "tagdienst" || slot.typ === "nachtdienst" || slot.typ === "anmeldung")) continue;
        if (settings.keine_anmeldung && slot.typ === "anmeldung") continue;
        candidates.push({
          name,
          priority: 1000 + assignCount[name] * 10,
          wunschErfuellt: false,
          von: slot.vonDefault,
          bis: slot.bisDefault,
        });
      }
    }

    // Absolute last resort: anyone not on hard-no
    if (candidates.length === 0) {
      const fallback = teamNames
        .filter((name) => !assignedDays[name]?.has(slot.tag))
        .map((name) => ({
          name,
          priority: 2000 + (assignCount[name] || 0) * 10,
          wunschErfuellt: false,
          von: slot.vonDefault,
          bis: slot.bisDefault,
        }))
        .sort((a, b) => a.priority - b.priority);
      if (fallback.length > 0) candidates.push(fallback[0]);
    }

    candidates.sort((a, b) => a.priority - b.priority);
    const chosen = candidates[0];
    if (!chosen) continue; // truly no one — leave slot unassigned

    if (!chosen.wunschErfuellt) {
      konflikte.push({
        tag: slot.tag,
        typ: slot.typ,
        problem:
          verfuegbarNames.length === 0
            ? `Niemand wollte diese Schicht – ${chosen.name} eingeteilt`
            : `${chosen.name} hatte lieber frei, wurde aber benötigt`,
        schwere: verfuegbarNames.length === 0 ? "rot" : "gelb",
        verfuegbar: verfuegbarNames,
        freiSchoen: freiSchoenNames,
        freiWichtig: freiWichtigNames,
        urlaub: urlaubNames,
      });
    }

    zuweisungen.push({
      tag: slot.tag,
      typ: slot.typ,
      von: chosen.von,
      bis: chosen.bis,
      name: chosen.name,
      wunschErfuellt: chosen.wunschErfuellt,
      erzwungen: !chosen.wunschErfuellt,
    });

    assignCount[chosen.name] = (assignCount[chosen.name] || 0) + 1;
    assignedDays[chosen.name]?.add(slot.tag);
    assignedDaysAll[chosen.name]?.add(slot.tag);
    if (slot.typ === "tagdienst") tdNdCount[chosen.name].td++;
    if (slot.typ === "nachtdienst") tdNdCount[chosen.name].nd++;
    if (slot.typ === "bd_tag") bdCount[chosen.name].tag++;
    if (slot.typ === "bd_nacht") bdCount[chosen.name].nacht++;
    if (slot.typ === "anmeldung") anmeldungCount[chosen.name]++;
    if (dayIsWE) weCount[chosen.name]++;
  }

  return {
    zuweisungen,
    konflikte,
    statistik: {
      totalSlots: allSlots.length,
      besetzt: zuweisungen.length,
      wuenscheErfuellt: zuweisungen.filter((z) => z.wunschErfuellt).length,
      erzwungen: zuweisungen.filter((z) => z.erzwungen).length,
      weVerteilung: weCount,
    },
  };
}
