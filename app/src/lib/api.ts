import pb from "./pocketbase";
import type { Hebamme, Wunsch, Zuweisung, SchichtSlot, Dienstplan } from "./types";

// ===== HEBAMMEN =====

export async function getTeam(): Promise<Hebamme[]> {
  const records = await pb.collection("hebammen").getFullList({
    sort: "vorname",
    filter: "aktiv=true",
  });
  return records as unknown as Hebamme[];
}

export async function createHebamme(data: {
  vorname: string;
  nachname: string;
  rolle: "admin" | "hebamme";
  farbe: string;
  pin: string;
}): Promise<Hebamme> {
  const record = await pb.collection("hebammen").create({
    vorname: data.vorname,
    nachname: data.nachname,
    rolle: data.rolle,
    farbe: data.farbe,
    fairness_score: 50,
    aktiv: true,
    email: `${data.vorname.toLowerCase().replace(/\s/g, "")}@dienstplan.app`,
    password: data.pin,
    passwordConfirm: data.pin,
  });
  return record as unknown as Hebamme;
}

export async function updateHebamme(
  id: string,
  data: Partial<{ vorname: string; nachname: string; rolle: string; farbe: string; aktiv: boolean; fairness_score: number }>
): Promise<void> {
  await pb.collection("hebammen").update(id, data);
}

export async function deleteHebamme(id: string): Promise<void> {
  await pb.collection("hebammen").update(id, { aktiv: false });
}

// ===== WUENSCHE =====

export async function getWuensche(monat: string, hebammeId?: string): Promise<Wunsch[]> {
  let filter = `monat="${monat}"`;
  if (hebammeId) {
    filter += ` && hebamme="${hebammeId}"`;
  }
  const records = await pb.collection("wuensche").getFullList({
    filter,
    sort: "datum",
  });
  return records as unknown as Wunsch[];
}

export async function saveWunsch(data: {
  hebamme: string;
  datum: string;
  monat: string;
  verfuegbar_fuer: string[];
  frei_wunsch: string | null;
  ist_urlaub: boolean;
  ziel_dienste: number;
  ziel_anmeldungen: number;
  zeit_von?: string;
  zeit_bis?: string;
}): Promise<Wunsch> {
  // Check if a wish already exists for this person + date
  try {
    const existing = await pb.collection("wuensche").getFirstListItem(
      `hebamme="${data.hebamme}" && datum="${data.datum}"`
    );
    // Update existing
    const record = await pb.collection("wuensche").update(existing.id, data);
    return record as unknown as Wunsch;
  } catch {
    // Create new
    const record = await pb.collection("wuensche").create(data);
    return record as unknown as Wunsch;
  }
}

export async function deleteWunsch(hebammeId: string, datum: string): Promise<void> {
  try {
    const existing = await pb.collection("wuensche").getFirstListItem(
      `hebamme="${hebammeId}" && datum="${datum}"`
    );
    await pb.collection("wuensche").delete(existing.id);
  } catch {
    // doesn't exist, nothing to delete
  }
}

export async function saveWuenscheBulk(
  hebammeId: string,
  monat: string,
  wuensche: {
    datum: string;
    verfuegbar_fuer: string[];
    frei_wunsch: string | null;
    ist_urlaub: boolean;
    zeit_von?: string;
    zeit_bis?: string;
  }[],
  zielDienste: number,
  zielAnmeldungen: number
): Promise<void> {
  // Delete all existing wishes for this person + month
  const existing = await getWuensche(monat, hebammeId);
  for (const w of existing) {
    await pb.collection("wuensche").delete(w.id);
  }

  // Create new ones
  for (const w of wuensche) {
    await pb.collection("wuensche").create({
      hebamme: hebammeId,
      datum: w.datum,
      monat,
      verfuegbar_fuer: w.verfuegbar_fuer,
      frei_wunsch: w.frei_wunsch || "",
      ist_urlaub: w.ist_urlaub,
      ziel_dienste: zielDienste,
      ziel_anmeldungen: zielAnmeldungen,
      zeit_von: w.zeit_von || "",
      zeit_bis: w.zeit_bis || "",
    });
  }
}

// ===== SCHICHT SLOTS =====

export async function getSchichtSlots(monat: string): Promise<SchichtSlot[]> {
  const records = await pb.collection("schicht_slots").getFullList({
    filter: `monat="${monat}"`,
    sort: "datum",
  });
  return records as unknown as SchichtSlot[];
}

// ===== ZUWEISUNGEN =====

export async function getZuweisungen(monat: string): Promise<Zuweisung[]> {
  const records = await pb.collection("zuweisungen").getFullList({
    filter: `monat="${monat}"`,
    expand: "hebamme,schicht_slot",
    sort: "schicht_slot",
  });
  return records as unknown as Zuweisung[];
}

export async function saveZuweisungen(
  monat: string,
  zuweisungen: {
    hebamme: string;
    schicht_slot: string;
    wunsch_erfuellt: boolean;
    manuell_geaendert: boolean;
  }[]
): Promise<void> {
  // Delete existing
  const existing = await getZuweisungen(monat);
  for (const z of existing) {
    await pb.collection("zuweisungen").delete(z.id);
  }
  // Create new
  for (const z of zuweisungen) {
    await pb.collection("zuweisungen").create({ ...z, monat });
  }
}

// ===== DIENSTPLAENE =====

export async function getDienstplan(monat: string): Promise<Dienstplan | null> {
  try {
    const record = await pb.collection("dienstplaene").getFirstListItem(
      `monat="${monat}"`
    );
    return record as unknown as Dienstplan;
  } catch {
    return null;
  }
}

export async function saveDienstplan(data: {
  monat: string;
  status: string;
  generiert_am?: string;
  freigegeben_am?: string;
  freigegeben_von?: string;
  statistik?: Record<string, unknown>;
}): Promise<Dienstplan> {
  try {
    const existing = await pb.collection("dienstplaene").getFirstListItem(
      `monat="${data.monat}"`
    );
    const record = await pb.collection("dienstplaene").update(existing.id, data);
    return record as unknown as Dienstplan;
  } catch {
    const record = await pb.collection("dienstplaene").create(data);
    return record as unknown as Dienstplan;
  }
}
