// Public holidays + school vacation for Bavaria.
// Sources:
//   - https://feiertage-api.de  (public holidays)
//   - https://ferien-api.de     (school vacation periods)
// Both CORS-enabled. Fetched once per year and cached client-side.

export type HolidayKind = "feiertag" | "ferien";

export type HolidayInfo = {
  name: string;
  kind: HolidayKind;
};

export type HolidayMap = Record<string, HolidayInfo>; // YYYY-MM-DD → info

const cache = new Map<number, Promise<HolidayMap>>();

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function fetchSchulferien(year: number): Promise<{ name: string; start: string; end: string }[]> {
  try {
    const r = await fetch(`https://ferien-api.de/api/v1/holidays/BY/${year}`);
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function fetchFeiertage(year: number): Promise<Record<string, { datum: string }>> {
  try {
    const r = await fetch(`https://feiertage-api.de/api/?jahr=${year}&nur_land=BY`);
    if (!r.ok) return {};
    const data = await r.json();
    return typeof data === "object" && data ? data : {};
  } catch {
    return {};
  }
}

export async function loadBayernHolidays(year: number): Promise<HolidayMap> {
  const map: HolidayMap = {};

  // School vacation first – they cover spans of days
  const ferien = await fetchSchulferien(year);
  for (const f of ferien) {
    const cur = new Date(f.start.slice(0, 10) + "T12:00:00Z");
    const end = new Date(f.end.slice(0, 10) + "T12:00:00Z");
    while (cur <= end) {
      const key = fmt(cur);
      if (!map[key]) {
        const niceName = f.name.charAt(0).toUpperCase() + f.name.slice(1);
        map[key] = { name: niceName, kind: "ferien" };
      }
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  }

  // Public holidays override ferien-coloring (they are more important)
  const feiertage = await fetchFeiertage(year);
  for (const [name, info] of Object.entries(feiertage)) {
    const datum = info?.datum;
    if (typeof datum === "string" && /^\d{4}-\d{2}-\d{2}$/.test(datum)) {
      map[datum] = { name, kind: "feiertag" };
    }
  }

  return map;
}

export function getBayernHolidays(year: number): Promise<HolidayMap> {
  let p = cache.get(year);
  if (!p) {
    p = loadBayernHolidays(year);
    cache.set(year, p);
  }
  return p;
}
