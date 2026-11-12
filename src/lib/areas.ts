// Delivery areas, for "available now" (same-day ASAP): Cody is out in one of them at a time.
// A customer's area = the area of the Kroger store nearest their address (Kroger covers all three towns).

export type Area = "hendricks" | "greencastle";
export const AREAS: Area[] = ["hendricks", "greencastle"];

export const AREA_LABEL: Record<Area, string> = {
  hendricks: "Avon & Brownsburg",
  greencastle: "Greencastle",
};

/** A store's area: from the database, or (before migration 0018) from its name. */
export function storeArea(s: { area?: string | null; name?: string | null } | null | undefined): Area {
  if (s?.area === "greencastle" || s?.area === "hendricks") return s.area;
  return s?.name?.includes("Greencastle") ? "greencastle" : "hendricks";
}

export const asArea = (v: unknown): Area | null => (v === "hendricks" || v === "greencastle" ? v : null);
