// Reads Meijer's in-store location text, e.g. "Aisle B | 1, Section 50" (Brownsburg whole milk)
// or "Aisle B | 16, Section 31". Meijer aisles are a zone letter + number; section is the spot along it.

export type MeijerLocation = { aisle: string; sortKey: number; section: number | null; detail: string | null };

export function parseMeijerLocation(pageText: string): MeijerLocation | null {
  const m = pageText.replace(/\s+/g, " ").match(/Aisle\s+([A-Z]{1,2})?\s*\|?\s*(\d{1,3})(?:\s*,\s*Section\s+(\d{1,4}))?/i);
  if (!m) return null;
  const zone = (m[1] ?? "").toUpperCase();
  const num = Number(m[2]);
  const section = m[3] ? Number(m[3]) : null;
  // Zone letter first (A=1, B=2…), then aisle number: B|1 → 201, B|16 → 216.
  const zoneRank = zone ? zone.charCodeAt(0) - 64 : 0;
  return {
    aisle: zone ? `Aisle ${zone}${num}` : `Aisle ${num}`,
    sortKey: zoneRank * 100 + num,
    section,
    detail: section !== null ? `Section ${section}` : null,
  };
}

/** meijer.com product URL. The name part is just for show; the number is what matters. */
export const meijerProductUrl = (name: string, id: string) =>
  `https://www.meijer.com/shopping/product/${name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item"}/${id}`;
