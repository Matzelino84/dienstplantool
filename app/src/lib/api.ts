import pb from "./pocketbase";
import type {
  Hebamme,
  HebammeSettings,
  Wunsch,
  Zuweisung,
  SchichtSlot,
  Dienstplan,
  Feiertag,
  DienstEintrag,
  SchichtTyp,
} from "./types";

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
    settings: {},
    email: `${data.vorname.toLowerCase().replace(/\s/g, "")}@dienstplan.app`,
    password: data.pin,
    passwordConfirm: data.pin,
  });
  return record as unknown as Hebamme;
}

export async function updateHebamme(
  id: string,
  data: Partial<{
    vorname: string;
    nachname: string;
    rolle: string;
    farbe: string;
    aktiv: boolean;
    fairness_score: number;
    settings: HebammeSettings;
  }>
): Promise<void> {
  await pb.collection("hebammen").update(id, data);
}

export async function updateHebammeSettings(
  id: string,
  settings: HebammeSettings
): Promise<void> {
  await pb.collection("hebammen").update(id, { settings });
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

export async function deleteWunsch(hebammeId: string, datum: string): Promise<void> {
  try {
    const existing = await pb.collection("wuensche").getFirstListItem(
      `hebamme="${hebammeId}" && datum="${datum}"`
    );
    await pb.collection("wuensche").delete(existing.id);
  } catch {
    // doesn't exist
  }
}

export type WunschBulkEintrag = {
  datum: string;
  verfuegbar_fuer: string[];
  frei_wunsch: string | null;
  ist_urlaub: boolean;
  dienste: DienstEintrag[];
};

export async function saveWuenscheBulk(
  hebammeId: string,
  monat: string,
  wuensche: WunschBulkEintrag[],
  zielDienste: number,
  zielAnmeldungen: number
): Promise<void> {
  const existing = await getWuensche(monat, hebammeId);
  for (const w of existing) {
    await pb.collection("wuensche").delete(w.id);
  }

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
      zeit_von: w.dienste[0]?.zeit_von || "",
      zeit_bis: w.dienste[0]?.zeit_bis || "",
      dienste_json: w.dienste,
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

export async function ensureSchichtSlots(
  monat: string,
  slots: { datum: string; typ: SchichtTyp; ist_feiertag?: boolean }[]
): Promise<Record<string, string>> {
  const existing = await getSchichtSlots(monat);
  for (const s of existing) {
    await pb.collection("schicht_slots").delete(s.id);
  }
  const map: Record<string, string> = {};
  for (const s of slots) {
    const rec = await pb.collection("schicht_slots").create({
      datum: s.datum,
      typ: s.typ,
      ist_feiertag: s.ist_feiertag || false,
      monat,
    });
    map[`${s.datum}|${s.typ}`] = rec.id;
  }
  return map;
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

export async function saveZuweisungenMitSlots(
  monat: string,
  eintraege: {
    tag: number;
    typ: SchichtTyp;
    hebammeId: string;
    zeit_von: string;
    zeit_bis: string;
    wunsch_erfuellt: boolean;
    manuell_geaendert: boolean;
    ist_feiertag?: boolean;
  }[]
): Promise<Record<string, string>> {
  const oldZ = await getZuweisungen(monat);
  for (const z of oldZ) {
    await pb.collection("zuweisungen").delete(z.id);
  }
  const datumOf = (tag: number) => `${monat}-${String(tag).padStart(2, "0")} 00:00:00.000Z`;
  const slotMap = await ensureSchichtSlots(
    monat,
    eintraege.map((e) => ({ datum: datumOf(e.tag), typ: e.typ, ist_feiertag: e.ist_feiertag }))
  );
  const idMap: Record<string, string> = {};
  for (const e of eintraege) {
    const slotId = slotMap[`${datumOf(e.tag)}|${e.typ}`];
    if (!slotId) continue;
    const rec = await pb.collection("zuweisungen").create({
      hebamme: e.hebammeId,
      schicht_slot: slotId,
      monat,
      wunsch_erfuellt: e.wunsch_erfuellt,
      manuell_geaendert: e.manuell_geaendert,
      zeit_von: e.zeit_von,
      zeit_bis: e.zeit_bis,
    });
    idMap[`${e.tag}|${e.typ}`] = rec.id;
  }
  return idMap;
}

export async function updateZuweisung(
  recordId: string,
  data: {
    hebammeId?: string;
    zeit_von?: string;
    zeit_bis?: string;
    wunsch_erfuellt?: boolean;
    manuell_geaendert?: boolean;
  }
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (data.hebammeId !== undefined) payload.hebamme = data.hebammeId;
  if (data.zeit_von !== undefined) payload.zeit_von = data.zeit_von;
  if (data.zeit_bis !== undefined) payload.zeit_bis = data.zeit_bis;
  if (data.wunsch_erfuellt !== undefined) payload.wunsch_erfuellt = data.wunsch_erfuellt;
  if (data.manuell_geaendert !== undefined) payload.manuell_geaendert = data.manuell_geaendert;
  await pb.collection("zuweisungen").update(recordId, payload);
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

// ===== FEIERTAGE =====

export async function getFeiertage(jahr?: number): Promise<Feiertag[]> {
  const filter = jahr
    ? `datum >= "${jahr}-01-01" && datum <= "${jahr}-12-31"`
    : "";
  const records = await pb.collection("feiertage").getFullList({
    filter,
    sort: "datum",
  });
  return records as unknown as Feiertag[];
}

export async function createFeiertag(data: {
  datum: string;
  name: string;
  typ: "feiertag" | "ferien";
}): Promise<Feiertag> {
  const record = await pb.collection("feiertage").create(data);
  return record as unknown as Feiertag;
}

export async function deleteFeiertag(id: string): Promise<void> {
  await pb.collection("feiertage").delete(id);
}
