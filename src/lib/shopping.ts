// Pure helpers for shopping mode: barcode matching and walking order through the store.

/**
 * Do two barcodes refer to the same product?
 * Stores and scanners disagree on leading zeros and on whether the last (check) digit is included:
 *   Kroger API:    0001111041700   (13 digits, no check digit)
 *   Meijer:        4125010200      (no leading zeros, no check digit)
 *   Scanner UPC-A: 041250102007    (12 digits, with check digit)
 */
export function sameUpc(a: string | null | undefined, b: string | null | undefined): boolean {
  const forms = (code: string | null | undefined) => {
    const digits = upcEtoA((code ?? "").replace(/\D/g, ""));
    if (digits.length < 6) return new Set<string>();
    const strip = (s: string) => s.replace(/^0+/, "");
    return new Set([strip(digits), strip(digits.slice(0, -1))].filter((s) => s.length >= 6));
  };
  const fa = forms(a);
  for (const f of forms(b)) if (fa.has(f)) return true;
  return false;
}

/** Expand an 8-digit UPC-E (small packages) to its 12-digit UPC-A so it can be compared. */
export function upcEtoA(code: string): string {
  const d = code.replace(/\D/g, "");
  if (d.length !== 8 || (d[0] !== "0" && d[0] !== "1")) return d;
  const [ns, a, b, c, x, y, z, check] = d.split("");
  let body: string;
  if (z <= "2") body = a + b + z + "0000" + c + x + y;
  else if (z === "3") body = a + b + c + "00000" + x + y;
  else if (z === "4") body = a + b + c + x + "00000" + y;
  else body = a + b + c + x + y + "0000" + z;
  return ns + body + check;
}

/** Turn an aisle label into a sort number. "Aisle 8" → 8, "A12" → 12. Unknown → null. */
export function aisleNumber(label: string | null | undefined): number | null {
  if (!label) return null;
  const m = label.match(/(\d{1,3})/);
  return m ? Number(m[1]) : null;
}

/** Typical walk for store sections without a numbered aisle, in rough order through a supercenter. */
const SECTION_ORDER: [RegExp, number][] = [
  [/produce|fruit|vegetable/i, 0],
  [/floral/i, 1],
  [/bakery|bread/i, 2],
  [/deli/i, 3],
  [/meat|seafood/i, 900],
  [/dairy|milk|egg|cheese/i, 910],
  [/frozen/i, 920],
  [/pharmacy|health/i, 930],
];

export type WalkItem = { aisle: string | null; sortKey?: number | null; bay?: number | null; name: string };

/**
 * Sort key for walking the store: produce/bakery/deli first, numbered aisles in order,
 * then meat, dairy, frozen at the back, and anything without a location last.
 */
export function walkKey(i: WalkItem): number {
  if (typeof i.sortKey === "number") return 100 + i.sortKey;
  const n = aisleNumber(i.aisle);
  if (n !== null) return 100 + n;
  for (const [re, k] of SECTION_ORDER) if (i.aisle && re.test(i.aisle)) return k;
  return i.aisle ? 950 : 10_000;
}

export function sortForWalk<T extends WalkItem>(items: T[]): T[] {
  // Within an aisle, walk by bay (front to back) when known.
  return [...items].sort((a, b) =>
    walkKey(a) - walkKey(b) || (a.aisle ?? "").localeCompare(b.aisle ?? "") || (a.bay ?? 9999) - (b.bay ?? 9999) || a.name.localeCompare(b.name));
}

/** Customer label colors so each order stands out in the combined list. */
export const CUSTOMER_COLORS = ["#1f5a40", "#b0322b", "#1f4fa3", "#8a5a00", "#6b3fa0", "#0f6e74"];

export const SUB_CHOICES = [
  { id: "approved", label: "Approved substitutions", hint: "List what's OK in the notes" },
  { id: "codys_pick", label: "Cody's pick", hint: "Nearest similar item" },
  { id: "store_brand", label: "Store brand is OK", hint: "Kroger or Meijer brand" },
  { id: "refund", label: "Refund", hint: "Skip it if it's out" },
  { id: "other", label: "Other", hint: "Explain in the notes" },
] as const;
export type SubChoice = (typeof SUB_CHOICES)[number]["id"];
export const subLabel = (id: string) => SUB_CHOICES.find((s) => s.id === id)?.label ?? id;

/** A specific product the customer said is OK as a swap. */
export type ApprovedSub = { name: string; externalId?: string; upc?: string | null; priceCents?: number | null };
export const MAX_APPROVED_SUBS = 3;

/**
 * Suggested receipt subtotal for one store, from what Cody checked off:
 * found items at (actual or listed) price × quantity found, swaps at their entered price,
 * nothing for out-of-stock or removed. Items with no price are counted in `unpriced`.
 */
export function suggestedSubtotal(lines: {
  status: string; removed: boolean; quantity: number; foundQuantity: number | null;
  priceCents: number | null; actualPriceCents: number | null;
}[]): { cents: number; unpriced: number } {
  let cents = 0, unpriced = 0;
  for (const l of lines) {
    if (l.removed || l.status === "out_of_stock" || l.status === "pending") continue;
    const qty = l.status === "substituted" ? l.quantity : (l.foundQuantity ?? l.quantity);
    const unit = l.actualPriceCents ?? (l.status === "found" ? l.priceCents : null);
    if (unit == null) { unpriced++; continue; }
    cents += Math.round(unit * qty);
  }
  return { cents, unpriced };
}

/** Rank products by how often they were ordered, most recent breaking ties. */
export function rankByOrders(rows: { productId: string; orderedAt: string }[], limit: number, exclude: Set<string> = new Set()): string[] {
  const stats = new Map<string, { n: number; last: string }>();
  for (const r of rows) {
    if (exclude.has(r.productId)) continue;
    const s = stats.get(r.productId);
    if (s) { s.n++; if (r.orderedAt > s.last) s.last = r.orderedAt; } else stats.set(r.productId, { n: 1, last: r.orderedAt });
  }
  return [...stats].sort((a, b) => b[1].n - a[1].n || b[1].last.localeCompare(a[1].last)).slice(0, limit).map(([id]) => id);
}
