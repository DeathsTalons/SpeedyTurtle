// Looks up Meijer aisle + section for items in upcoming orders, at the right store, and saves them.
// Opens Microsoft Edge normally (its own separate profile) and reads the pages, at a gentle pace.
// If Meijer blocks it anyway, it stops; aisles can always be set by hand in shopping mode.
// Leave the Edge window alone while it runs.
//
//   node --env-file=.env.local scripts/sync-meijer-aisles.ts          ← items in upcoming orders
//   node --env-file=.env.local scripts/sync-meijer-aisles.ts --all    ← every Meijer item ever ordered
//   node --env-file=.env.local scripts/sync-meijer-aisles.ts --list data/meijer-baseline.txt
//        ← search each line, take the top matches, look them up at EVERY Meijer (baseline map)
//        options: --per 2 (matches per line)   --store brownsburg (just one store)
//
// Safe to stop with Ctrl+C anytime: everything found so far is saved, and the next run skips it.
// Each product is looked up once per store; after that the app remembers it.

import { createInterface } from "node:readline/promises";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium, type BrowserContext } from "playwright";
import { supabaseSecretKey, supabaseUrl } from "../src/lib/env.ts";
import { meijerProductUrl, parseMeijerLocation } from "../src/lib/meijer-aisle.ts";
import { MeijerClient } from "../src/lib/meijer.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */
const db = createClient(supabaseUrl(), supabaseSecretKey(), { auth: { persistSession: false } }) as any;
const ALL = process.argv.includes("--all");
const argAfter = (flag: string) => { const i = process.argv.indexOf(flag); return i >= 0 ? process.argv[i + 1] : undefined; };
const LIST = argAfter("--list");
const PER = Math.max(1, Math.min(Number(argAfter("--per") ?? 2) || 2, 10));
const ONLY_STORE = argAfter("--store")?.toLowerCase();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pause = () => sleep(4000 + Math.random() * 5000); // be gentle: one page every 4–9 seconds
const ask = async (q: string) => { const rl = createInterface({ input: process.stdin, output: process.stdout }); const a = await rl.question(q); rl.close(); return a; };

// ── What needs looking up ──
const { data: stores } = await db.from("stores").select("id, name, external_location_id").eq("chain", "meijer").eq("active", true);
const storeById = new Map<string, { id: string; name: string; number: string | null }>(
  (stores ?? []).map((s: any) => [s.id, { id: s.id, name: s.name, number: s.external_location_id }]),
);

const wanted = new Map<string, Set<string>>(); // storeId → productIds
const add = (storeId: string, productId: string) => {
  if (!wanted.has(storeId)) wanted.set(storeId, new Set());
  wanted.get(storeId)!.add(productId);
};

const statuses = ALL ? ["placed", "shopping", "delivering", "delivered"] : ["placed", "shopping"];
const { data: items, error } = await db
  .from("order_items")
  .select("product_id, orders!inner(meijer_store_id, status)")
  .eq("chain", "meijer").eq("removed", false).not("product_id", "is", null)
  .in("orders.status", statuses);
if (error) throw error;
for (const it of items ?? []) {
  const o = Array.isArray(it.orders) ? it.orders[0] : it.orders;
  if (o?.meijer_store_id) add(o.meijer_store_id, it.product_id);
}

// ── Baseline list: search Meijer for each line, save the top matches, queue them for every Meijer ──
if (LIST) {
  if (!existsSync(LIST)) { console.log(`Can't find ${LIST}.`); process.exit(1); }
  const terms = readFileSync(LIST, "utf8").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  console.log(`Searching Meijer for ${terms.length} list items (top ${PER} each)…`);
  const feed = MeijerClient.fromEnv();
  const now = new Date().toISOString();
  let found = 0;
  for (const [n, term] of terms.entries()) {
    if (n % 10 === 0) process.stdout.write(`  …${n}/${terms.length} searched\r`);
    try {
      const hits = (await feed.search(term, PER + 2)).filter((h) => !h.ageRestricted).slice(0, PER);
      if (!hits.length) { console.log(`  – no Meijer results for "${term}"`); continue; }
      const { data: rows, error: upErr } = await db.from("products").upsert(hits.map((h) => ({
        chain: "meijer", external_id: h.externalId, upc: h.externalId, name: h.name, size: h.size, image_url: h.imageUrl,
        price_cents: h.priceCents, sale_price_cents: h.salePriceCents, price_updated_at: now, active: true,
      })), { onConflict: "chain,external_id" }).select("id");
      if (upErr) throw upErr;
      for (const r of rows ?? []) for (const st of storeById.values()) add(st.id, r.id);
      found += (rows ?? []).length;
    } catch (e) {
      console.log(`  – search failed for "${term}": ${(e as Error).message}`);
    }
    await sleep(300);
  }
  console.log(`Found ${found} products from the list.\n`);
}
if (ONLY_STORE) {
  for (const id of [...wanted.keys()]) if (!storeById.get(id)?.name.toLowerCase().includes(ONLY_STORE)) wanted.delete(id);
}

let total = 0;
const todo: { store: { id: string; name: string; number: string | null }; products: { id: string; external_id: string; name: string }[] }[] = [];
for (const [storeId, ids] of wanted) {
  const store = storeById.get(storeId);
  if (!store) continue;
  // Ask in chunks of 100 so the requests stay a reasonable size.
  const chunks = <T,>(xs: T[]) => Array.from({ length: Math.ceil(xs.length / 100) }, (_, i) => xs.slice(i * 100, i * 100 + 100));
  const have = new Set<string>();
  for (const part of chunks([...ids])) {
    const { data: known } = await db.from("product_locations").select("product_id").eq("store_id", storeId).in("product_id", part);
    for (const k of known ?? []) have.add(k.product_id);
  }
  const missing = [...ids].filter((id) => !have.has(id));
  if (!missing.length) continue;
  const products: { id: string; external_id: string; name: string }[] = [];
  for (const part of chunks(missing)) {
    const { data } = await db.from("products").select("id, external_id, name").in("id", part);
    products.push(...(data ?? []));
  }
  todo.push({ store, products });
  total += products.length;
}

if (total === 0) {
  console.log(LIST ? "✓ Everything on that list already has an aisle at your Meijers. Nothing to do." : "✓ Every Meijer item in your orders already has an aisle. Nothing to do.");
  process.exit(0);
}
console.log(`Looking up ${total} Meijer item${total === 1 ? "" : "s"} across ${todo.length} store${todo.length === 1 ? "" : "s"}.`);
console.log(`At about 6 seconds a page, that's roughly ${Math.max(1, Math.round((total * 6.5) / 60))} minutes. Ctrl+C stops it safely; rerun to pick up where it left off.`);
console.log("An Edge window will open. Leave it alone until this finishes.\n");

// ── Open Edge the ordinary way (no automation flags), with its own profile, then connect to it ──
const EDGE = [
  process.env.EDGE_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => p && existsSync(p));
if (!EDGE) { console.log("Couldn't find Microsoft Edge. Set EDGE_PATH in .env.local to msedge.exe."); process.exit(1); }
const PORT = 9333;
const edge = spawn(EDGE, [`--remote-debugging-port=${PORT}`, `--user-data-dir=${resolve(".meijer-edge")}`, "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore" });
let browser;
for (let i = 0; i < 30 && !browser; i++) {
  await sleep(500);
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`).catch(() => undefined);
}
if (!browser) { console.log("Edge opened but the script couldn't connect to it. Close all Edge windows and try again."); edge.kill(); process.exit(1); }
const context: BrowserContext = browser.contexts()[0];
const page = context.pages()[0] ?? (await context.newPage());
const isBlocked = (text: string) => /Access Denied|unusual activity|are you a robot/i.test(text);

async function openStore(store: { name: string; number: string | null }) {
  const town = store.name.replace(/^Meijer – /, "");
  await page.goto("https://www.meijer.com/", { waitUntil: "domcontentloaded" });
  await sleep(3000);
  if (isBlocked(await page.locator("body").innerText())) {
    console.log("\n✗ Meijer is blocking this browser. Open meijer.com in your normal browser:");
    console.log("   • if it ALSO says Access Denied, your connection is cooling down; wait an hour or two before trying again.");
    console.log("   • if your normal browser works fine, Meijer is spotting the script. Stick with setting aisles in shopping mode.");
    await browser!.close().catch(() => {}); edge.kill();
    process.exit(0);
  }
  const cookie = (await context.cookies("https://www.meijer.com")).find((c) => c.name.startsWith("meijer-sel"));
  if (cookie && store.number) {
    await context.addCookies([{ ...cookie, value: store.number }]);
    console.log(`Store set to ${town} (#${store.number}).`);
  } else {
    console.log(`\n>>> ACTION NEEDED: in the Edge window, set your Meijer store to ${town} (top right of the page).`);
    console.log(">>> Then come back to THIS window and press Enter.\n");
    await ask("Press Enter once the store is set… ");
    const now = (await context.cookies("https://www.meijer.com")).find((c) => c.name.startsWith("meijer-sel"));
    if (now) {
      console.log(`(${town} is store #${now.value}. Saving that for next time.)`);
      await db.from("stores").update({ external_location_id: now.value }).eq("name", store.name);
      store.number = now.value;
    }
  }
}

let saved = 0, notFound = 0, blocked = false;
for (const { store, products } of todo) {
  if (blocked) break;
  const town = store.name.replace(/^Meijer – /, "");
  await openStore(store);
  for (const p of products) {
    try {
      await page.goto(meijerProductUrl(p.name, p.external_id), { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.getByText(/Aisle\s/).first().waitFor({ timeout: 10_000 }).catch(() => {});
      const text = await page.locator("body").innerText();
      if (isBlocked(text)) {
        console.log("\n✗ Meijer is blocking for now. Stopping. Try again later; what's saved so far stays saved.");
        blocked = true;
        break;
      }
      // Meijer names stores by street (Avon shows as "Rockville Rd"), so check the store number instead of the town.
      const current = (await context.cookies("https://www.meijer.com")).find((c) => c.name.startsWith("meijer-sel"))?.value;
      if (store.number && current && current !== store.number) console.log(`  (heads-up: browser is on store #${current}, expected #${store.number})`);
      const loc = parseMeijerLocation(text);
      if (loc) {
        await db.from("product_locations").upsert({
          store_id: store.id, product_id: p.id, aisle: loc.aisle, sort_key: loc.sortKey,
          bay: loc.section, detail: loc.detail, source: "meijer", updated_at: new Date().toISOString(),
        }, { onConflict: "store_id,product_id" });
        saved++;
        console.log(`✓ ${town}: ${p.name} → ${loc.aisle}${loc.detail ? `, ${loc.detail}` : ""}`);
      } else {
        notFound++;
        console.log(`– ${town}: ${p.name} → no aisle shown (you can set it while shopping)`);
      }
    } catch (e) {
      notFound++;
      console.log(`– ${town}: ${p.name} → couldn't load (${(e as Error).message.split("\n")[0]})`);
    }
    await pause();
  }
}

await browser.close().catch(() => {});
edge.kill();
console.log(`\nDone. Saved ${saved}, couldn't find ${notFound}.`);
