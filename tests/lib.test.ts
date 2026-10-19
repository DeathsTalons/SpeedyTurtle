import { test } from "node:test";
import assert from "node:assert/strict";
import { countUniqueItems, quoteOrder, finalCaptureCents, type FeeTier } from "../src/lib/pricing.ts";
import { availableSlots, calendarView, zonedToInstant, type ScheduleInput } from "../src/lib/schedule.ts";
import { KrogerClient } from "../src/lib/kroger.ts";

const tiers: FeeTier[] = [
  { minItems: 1, maxItems: 15, feeCents: 1000, label: "Small" },
  { minItems: 16, maxItems: 35, feeCents: 1500, label: "Medium" },
  { minItems: 36, maxItems: null, feeCents: 2000, label: "Large" },
];

// ───────── pricing ─────────
test("quantity doesn't change unique count; duplicates and free text dedupe", () => {
  assert.equal(
    countUniqueItems([
      { chain: "kroger", productId: "milk", quantity: 2 },
      { chain: "kroger", productId: "milk", quantity: 1 },
      { chain: "meijer", productId: "milk", quantity: 1 }, // different store = different item
      { chain: "meijer", freeText: "Good  Sourdough", quantity: 1 },
      { chain: "meijer", freeText: "good sourdough", quantity: 1 },
      { chain: "kroger", productId: "eggs", quantity: 0 }, // removed line
    ]),
    3,
  );
});

test("tier boundaries", () => {
  const lines = (n: number) => Array.from({ length: n }, (_, i) => ({ chain: "kroger" as const, productId: `p${i}`, quantity: 1, unitPriceCents: 100 }));
  assert.equal(quoteOrder(lines(15), tiers, { bufferPct: 15 }).serviceFeeCents, 1000);
  assert.equal(quoteOrder(lines(16), tiers, { bufferPct: 15 }).serviceFeeCents, 1500);
  assert.equal(quoteOrder(lines(36), tiers, { bufferPct: 15 }).serviceFeeCents, 2000);
});

test("authorization adds buffer on groceries only", () => {
  const q = quoteOrder([{ chain: "kroger", productId: "a", quantity: 2, unitPriceCents: 5000 }], tiers, { bufferPct: 15, tipCents: 500 });
  assert.equal(q.estimatedSubtotalCents, 10000);
  assert.equal(q.estimatedTotalCents, 10000 + 1000 + 500);
  assert.equal(q.authorizeCents, 10000 + 1500 + 1000 + 500);
});

test("capture never exceeds the hold", () => {
  assert.deepEqual(finalCaptureCents({ receiptSubtotalCents: 9000, serviceFeeCents: 1000, tipCents: 0, authorizedCents: 12000 }), { captureCents: 10000, overAuthorizationCents: 0 });
  assert.deepEqual(finalCaptureCents({ receiptSubtotalCents: 12000, serviceFeeCents: 1000, tipCents: 0, authorizedCents: 12000 }), { captureCents: 12000, overAuthorizationCents: 1000 });
});

// ───────── schedule ─────────
const base: ScheduleInput = {
  now: new Date("2026-10-12T12:00:00Z"), // Monday 8:00am in Indiana
  daysAhead: 7,
  cutoffHours: 3,
  weekly: { 0: true, 1: false, 2: false, 3: true, 4: true, 5: true, 6: true },
  templates: [
    { id: 1, label: "Morning", startTime: "10:00", endTime: "13:00", capacity: 5 },
    { id: 2, label: "Afternoon", startTime: "15:00", endTime: "18:00", capacity: 5 },
  ],
  overrides: [],
  bookings: [],
};

test("Mondays and Tuesdays are off by default", () => {
  const dates = new Set(availableSlots(base).map((s) => s.date));
  assert.ok(!dates.has("2026-10-12") && !dates.has("2026-10-13"));
  assert.ok(dates.has("2026-10-14"));
});

test("toggle a whole day off, one window off, and an off-day on", () => {
  const slots = availableSlots({
    ...base,
    overrides: [
      { date: "2026-10-14", slotTemplateId: null, isOpen: false, note: "Traveling" },
      { date: "2026-10-15", slotTemplateId: 2, isOpen: false },
      { date: "2026-10-19", slotTemplateId: null, isOpen: true }, // working a Monday
    ],
  });
  const keys = slots.map((s) => `${s.date}#${s.slotTemplateId}`);
  assert.ok(!keys.some((k) => k.startsWith("2026-10-14")));
  assert.ok(keys.includes("2026-10-15#1") && !keys.includes("2026-10-15#2"));
  assert.ok(keys.includes("2026-10-19#1") && keys.includes("2026-10-19#2"));
});

test("full windows and windows inside the cutoff disappear", () => {
  const now = new Date("2026-10-14T13:30:00Z"); // Wed 9:30am local → morning (10am) is inside 3h cutoff
  const slots = availableSlots({ ...base, now, daysAhead: 1, bookings: [{ date: "2026-10-15", slotTemplateId: 1, count: 5 }] });
  const keys = slots.map((s) => `${s.date}#${s.slotTemplateId}`);
  assert.deepEqual(keys, ["2026-10-14#2", "2026-10-15#2"]);
});

test("daylight saving handled (EDT vs EST)", () => {
  assert.equal(zonedToInstant("2026-10-14", "10:00").toISOString(), "2026-10-14T14:00:00.000Z");
  assert.equal(zonedToInstant("2026-11-12", "10:00").toISOString(), "2026-11-12T15:00:00.000Z");
});

test("calendar view explains each window's state", () => {
  const v = calendarView("2026-10-12", 3, { ...base, overrides: [{ date: "2026-10-14", slotTemplateId: null, isOpen: false, note: "Traveling" }] });
  assert.equal(v[0].slots[0].source, "default week");
  assert.equal(v[2].note, "Traveling");
  assert.equal(v[2].slots[1].open, false);
});

// ───────── Kroger (mocked network) ─────────
test("Kroger client: token caching, search mapping, 401 retry", async () => {
  const calls: string[] = [];
  let tokenCount = 0;
  let fail401Once = true;
  const fakeFetch = (async (url: string) => {
    calls.push(url);
    if (url.includes("/connect/oauth2/token")) {
      tokenCount++;
      return new Response(JSON.stringify({ access_token: `tok${tokenCount}`, expires_in: 1800 }));
    }
    if (fail401Once && calls.filter((c) => c.includes("/products")).length === 2) {
      fail401Once = false;
      return new Response("expired", { status: 401 });
    }
    return new Response(JSON.stringify({
      data: [{
        productId: "0001111041700", upc: "0001111041700", brand: "Kroger", description: "Kroger 2% Reduced Fat Milk",
        categories: ["Dairy"], aisleLocations: [{ description: "Dairy", number: "28" }],
        images: [{ perspective: "front", featured: true, sizes: [{ size: "medium", url: "https://img/milk.jpg" }] }],
        items: [{ size: "1 gal", price: { regular: 3.49, promo: 2.99 }, fulfillment: { inStore: true } }],
      }],
    }));
  }) as typeof fetch;

  const k = new KrogerClient("id", "secret", fakeFetch);
  const [milk] = await k.searchProducts("milk", "01400943");
  assert.equal(milk.name, "Kroger 2% Reduced Fat Milk");
  assert.equal(milk.priceCents, 349);
  assert.equal(milk.salePriceCents, 299);
  assert.equal(milk.aisle, "Dairy");
  assert.equal(milk.imageUrl, "https://img/milk.jpg");
  assert.ok(calls[1].includes("filter.locationId=01400943"));

  await k.searchProducts("eggs", "01400943"); // gets 401 → refreshes token once
  assert.equal(tokenCount, 2);
});

// ───────── nearest store ─────────
import { nearestStore, milesBetween, geocodeAddress, type Store } from "../src/lib/stores.ts";

const krogers: Store[] = [
  { id: "bb", chain: "kroger", name: "Kroger – Brownsburg", active: true, latitude: 39.8434, longitude: -86.3978 },
  { id: "av", chain: "kroger", name: "Kroger – Avon", active: true, latitude: 39.7629, longitude: -86.3994 },
  { id: "gc", chain: "kroger", name: "Kroger – Greencastle", active: true, latitude: 39.6445, longitude: -86.8650 },
  { id: "mj", chain: "meijer", name: "Meijer – Avon", active: true, latitude: 39.7700, longitude: -86.3600 },
];

test("picks the closest store of the right chain", () => {
  const nearAvon = { latitude: 39.755, longitude: -86.41 };
  assert.equal(nearestStore("kroger", krogers, nearAvon)?.store.id, "av");
  assert.equal(nearestStore("kroger", krogers, { latitude: 39.66, longitude: -86.83 })?.store.id, "gc");
  assert.equal(nearestStore("meijer", krogers, nearAvon)?.store.id, "mj");
});

test("skips inactive stores; falls back when address or coords are unknown", () => {
  const closed = krogers.map((s) => (s.id === "av" ? { ...s, active: false } : s));
  assert.equal(nearestStore("kroger", closed, { latitude: 39.755, longitude: -86.41 })?.store.id, "bb");
  const r = nearestStore("kroger", krogers, null);
  assert.equal(r?.store.id, "av"); // alphabetical fallback
  assert.equal(r?.miles, null);
  assert.equal(nearestStore("kroger", [], null), null);
});

test("distance sanity: Brownsburg → Greencastle is ~28 miles", () => {
  const m = milesBetween(krogers[0] as { latitude: number; longitude: number }, krogers[2] as { latitude: number; longitude: number });
  assert.ok(m > 24 && m < 32, String(m));
});

test("Census geocoder: parses a match, returns null on miss or network error", async () => {
  const hit = (async () => new Response(JSON.stringify({ result: { addressMatches: [{ coordinates: { x: -86.39, y: 39.84 } }] } }))) as typeof fetch;
  assert.deepEqual(await geocodeAddress({ line1: "1 Main St", city: "Brownsburg", state: "IN", zip: "46112" }, hit), { latitude: 39.84, longitude: -86.39 });
  const miss = (async () => new Response(JSON.stringify({ result: { addressMatches: [] } }))) as typeof fetch;
  assert.equal(await geocodeAddress({ line1: "x", city: "y", state: "IN", zip: "0" }, miss), null);
  const boom = (async () => { throw new Error("offline"); }) as typeof fetch;
  assert.equal(await geocodeAddress({ line1: "x", city: "y", state: "IN", zip: "0" }, boom), null);
});

// ───────── second-store fee ─────────
test("second-store fee only when both Kroger and Meijer are in the order", () => {
  const k = { chain: "kroger" as const, productId: "a", quantity: 1, unitPriceCents: 1000 };
  const m = { chain: "meijer" as const, productId: "b", quantity: 1, unitPriceCents: 1000 };
  const one = quoteOrder([k, { ...k, productId: "c" }], tiers, { bufferPct: 0, secondStoreFeeCents: 500 });
  assert.equal(one.storeCount, 1);
  assert.equal(one.secondStoreFeeCents, 0);
  const both = quoteOrder([k, m], tiers, { bufferPct: 10, secondStoreFeeCents: 500 });
  assert.equal(both.storeCount, 2);
  assert.equal(both.secondStoreFeeCents, 500);
  assert.equal(both.estimatedTotalCents, 2000 + 1000 + 500);
  assert.equal(both.authorizeCents, 2000 + 200 + 1000 + 500);
  // a removed (qty 0) Meijer line doesn't trigger it
  assert.equal(quoteOrder([k, { ...m, quantity: 0 }], tiers, { bufferPct: 0, secondStoreFeeCents: 500 }).secondStoreFeeCents, 0);
});

// ───────── add-on store is the one near the main store ─────────
import { storesForOrder } from "../src/lib/stores.ts";

const real: Store[] = [
  { id: "k-bb", chain: "kroger", name: "Kroger – Brownsburg", active: true, latitude: 39.856306, longitude: -86.389359 },
  { id: "k-av", chain: "kroger", name: "Kroger – Avon", active: true, latitude: 39.764633, longitude: -86.401149 },
  { id: "k-gc", chain: "kroger", name: "Kroger – Greencastle", active: true, latitude: 39.645654, longitude: -86.8478 },
  { id: "m-bb", chain: "meijer", name: "Meijer – Brownsburg", active: true, latitude: 39.85, longitude: -86.36 },
  { id: "m-av", chain: "meijer", name: "Meijer – Avon", active: true, latitude: 39.763555, longitude: -86.330285 },
];
const greencastleHome = { latitude: 39.64, longitude: -86.86 };
const brownsburgHome = { latitude: 39.845, longitude: -86.40 };

test("Greencastle customer, Meijer order: add-on Kroger is Avon, not Greencastle", () => {
  const s = storesForOrder("meijer", real, greencastleHome);
  assert.equal(s.primary?.id, "m-av");
  assert.equal(s.addOn?.id, "k-av");
});

test("Greencastle customer, Kroger order: main store is Greencastle", () => {
  assert.equal(storesForOrder("kroger", real, greencastleHome).primary?.id, "k-gc");
});

test("Brownsburg customer: both stores in Brownsburg either way", () => {
  assert.deepEqual([storesForOrder("kroger", real, brownsburgHome).primary?.id, storesForOrder("kroger", real, brownsburgHome).addOn?.id], ["k-bb", "m-bb"]);
  assert.deepEqual([storesForOrder("meijer", real, brownsburgHome).primary?.id, storesForOrder("meijer", real, brownsburgHome).addOn?.id], ["m-bb", "k-bb"]);
});

// ───────── Meijer ─────────
import { MeijerClient, mapMeijer } from "../src/lib/meijer.ts";

test("extra hold applies only to Meijer lines", () => {
  const q = quoteOrder([
    { chain: "kroger", productId: "a", quantity: 1, unitPriceCents: 10000 },
    { chain: "meijer", productId: "b", quantity: 1, unitPriceCents: 10000 },
  ], tiers, { bufferPct: 15, extraBufferPct: { meijer: 10 } });
  assert.equal(q.authorizeCents - q.estimatedTotalCents, 1500 + 2500);
});

test("Meijer feed mapping: price, sale, weighed, stock", () => {
  const milk = mapMeijer({ value: "Meijer Whole Milk, Gallon", data: { id: 4125010200, price: 2.79, discountSalePriceValue: 2.79, sale: false, stockLevelStatus: "inStock", image_url: "https://x/milk.jpg" } });
  assert.deepEqual([milk.externalId, milk.priceCents, milk.salePriceCents, milk.inStock], ["4125010200", 279, null, true]);
  const sale = mapMeijer({ value: "Chips", data: { id: 1, price: 4.99, discountSalePriceValue: 3.5, sale: true } });
  assert.equal(sale.salePriceCents, 350);
  assert.equal(mapMeijer({ value: "Bananas", data: { id: 2, price: 0.59, priceByWeight: true, priceUnit: "LB" } }).size, "per lb");
  assert.equal(mapMeijer({ value: "X", data: { id: 3, stockLevelStatus: "outOfStock" } }).inStock, false);
});

test("Meijer client: search URL, hides deactivated, item lookup by ids", async () => {
  const urls: string[] = [];
  const fake = (async (url: string) => {
    urls.push(url);
    return new Response(JSON.stringify({ response: { results: [
      { value: "Meijer Whole Milk, Gallon", data: { id: 4125010200, price: 2.79 } },
      { value: "Old thing", data: { id: 9, price: 1, deactivated: true } },
    ] } }));
  }) as typeof fetch;
  const m = new MeijerClient("key_test", fake);
  const found = await m.search("whole milk", 10);
  assert.equal(found.length, 1);
  assert.ok(urls[0].startsWith("https://ac.cnstrc.com/search/whole%20milk?"));
  assert.ok(urls[0].includes("key=key_test") && urls[0].includes("num_results_per_page=10"));
  await m.getItems(["4125010200", "4125010210"]);
  assert.ok(urls[1].includes("/browse/items?") && urls[1].includes("ids=4125010200&ids=4125010210"));
});

test("Meijer client: unexpected response throws (so callers fall back)", async () => {
  const bad = (async () => new Response("<html>Access Denied</html>", { status: 403 })) as typeof fetch;
  await assert.rejects(new MeijerClient("k", bad).search("milk"));
});

// ───────── shopping helpers ─────────
import { sameUpc, aisleNumber, sortForWalk } from "../src/lib/shopping.ts";

test("UPC matching across Kroger, Meijer and scanner formats", () => {
  assert.ok(sameUpc("4125010200", "041250102007"));       // Meijer id vs scanned UPC-A
  assert.ok(sameUpc("0001111041700", "011110417008"));     // Kroger vs scanned UPC-A
  assert.ok(sameUpc("0001111041700", "0001111041700"));
  assert.ok(!sameUpc("4125010200", "041250102106"));
  assert.ok(!sameUpc(null, "041250102007"));
  assert.ok(!sameUpc("12", "12"));                          // too short to trust
});

test("aisle parsing and store walk order", () => {
  assert.equal(aisleNumber("AISLE 18"), 18);
  assert.equal(aisleNumber("Dairy"), null);
  const walk = sortForWalk([
    { name: "ice cream", aisle: "Frozen" },
    { name: "mystery", aisle: null },
    { name: "cereal", aisle: "Aisle 12" },
    { name: "bananas", aisle: "Produce" },
    { name: "pasta", aisle: "Aisle 3" },
    { name: "milk", aisle: "Dairy" },
  ]).map((i) => i.name);
  assert.deepEqual(walk, ["bananas", "pasta", "cereal", "milk", "ice cream", "mystery"]);
});

test("UPC-E barcodes expand and match their UPC-A", async () => {
  const { upcEtoA } = await import("../src/lib/shopping.ts");
  assert.equal(upcEtoA("04252614"), "042100005264");   // standard example
  assert.ok(sameUpc("04252614", "042100005264"));
  assert.ok(sameUpc("04252614", "4210000526"));          // vs Meijer-style id
});

test("Kroger shelf detail: uses whatever parts are filled in", async () => {
  const { shelfDetail, mapProduct } = await import("../src/lib/kroger.ts");
  assert.equal(shelfDetail({ side: "L", bayNumber: "4", shelfNumber: "3" }), "Left side · Bay 4 · Shelf 3");
  assert.equal(shelfDetail({ side: "", bayNumber: "", shelfNumber: "" }), null);
  const p = mapProduct({ productId: "1", description: "Cheerios", aisleLocations: [{ description: "AISLE 12", number: "12", side: "R", bayNumber: "6", shelfNumber: "2" }] });
  assert.deepEqual([p.aisle, p.aisleSort, p.aisleBay, p.aisleDetail], ["AISLE 12", 12, 6, "Right side · Bay 6 · Shelf 2"]);
});

test("within an aisle, walk by bay", () => {
  const order = sortForWalk([
    { name: "b", aisle: "Aisle 4", bay: 9 },
    { name: "a", aisle: "Aisle 4", bay: 2 },
    { name: "c", aisle: "Aisle 4" },
  ]).map((i) => i.name);
  assert.deepEqual(order, ["a", "b", "c"]);
});

test("Kroger items stocked in two spots show both", async () => {
  const { mapProduct } = await import("../src/lib/kroger.ts");
  const p = mapProduct({ productId: "1", description: "General Mills Cheerios", aisleLocations: [
    { bayNumber: "10", description: "AISLE 12", number: "12", side: "R", shelfNumber: "2", shelfPositionInBay: "1" },
    { bayNumber: "11", description: "AISLE 12", number: "12", side: "R", shelfNumber: "1", shelfPositionInBay: "5" },
  ] });
  assert.equal(p.aisleDetail, "Right side · Bay 10 · Shelf 2 · Spot 1 · also Bay 11 · Shelf 1");
  assert.equal(p.aisleBay, 10);
});

test("Meijer location text parses into aisle, walk order and section", async () => {
  const { parseMeijerLocation, meijerProductUrl } = await import("../src/lib/meijer-aisle.ts");
  assert.deepEqual(parseMeijerLocation("Ways to Shop Pickup ready within 3 hrs Aisle B | 1, Section 50 At Brownsburg"),
    { aisle: "Aisle B1", sortKey: 201, section: 50, detail: "Section 50" });
  assert.equal(parseMeijerLocation("Aisle B | 16, Section 31")?.sortKey, 216);
  assert.equal(parseMeijerLocation("Aisle 7")?.aisle, "Aisle 7");
  assert.equal(parseMeijerLocation("Pickup ready within 3 hrs"), null);
  assert.equal(meijerProductUrl("Meijer Whole Milk, Gallon", "4125010200"), "https://www.meijer.com/shopping/product/meijer-whole-milk-gallon/4125010200");
});

test("suggested receipt subtotal skips out-of-stock/removed and counts unpriced", async () => {
  const { suggestedSubtotal } = await import("../src/lib/shopping.ts");
  const base = { removed: false, quantity: 1, foundQuantity: null, priceCents: 300, actualPriceCents: null };
  const r = suggestedSubtotal([
    { ...base, status: "found", quantity: 3, foundQuantity: 2 },               // 2 × 3.00
    { ...base, status: "substituted", actualPriceCents: 450 },                 // swap at 4.50
    { ...base, status: "substituted" },                                        // swap, no price
    { ...base, status: "out_of_stock" },
    { ...base, status: "found", removed: true },
    { ...base, status: "found", priceCents: null },                            // request, no price
  ]);
  assert.deepEqual(r, { cents: 600 + 450, unpriced: 2 });
});

test("buy-again / popular ranking: frequency first, then most recent", async () => {
  const { rankByOrders } = await import("../src/lib/shopping.ts");
  const rows = [
    { productId: "milk", orderedAt: "2026-10-01" }, { productId: "milk", orderedAt: "2026-10-08" },
    { productId: "eggs", orderedAt: "2026-10-09" },
    { productId: "bread", orderedAt: "2026-10-02" },
  ];
  assert.deepEqual(rankByOrders(rows, 10), ["milk", "eggs", "bread"]);
  assert.deepEqual(rankByOrders(rows, 2, new Set(["milk"])), ["eggs", "bread"]);
});
