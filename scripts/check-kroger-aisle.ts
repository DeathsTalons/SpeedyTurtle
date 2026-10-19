// Shows exactly what location info Kroger sends for a few items at your store:
//   node --env-file=.env.local scripts/check-kroger-aisle.ts 02100985 "cheerios"
import { KrogerClient } from "../src/lib/kroger.ts";

const [locationId = "02100985", term = "cheerios"] = process.argv.slice(2);
const k = KrogerClient.fromEnv();
const token = await (k as unknown as { getToken: () => Promise<string> }).getToken();
const res = await fetch(`https://api.kroger.com/v1/products?filter.term=${encodeURIComponent(term)}&filter.locationId=${locationId}&filter.limit=5`, {
  headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
});
const json = (await res.json()) as { data?: { description: string; aisleLocations?: unknown[] }[] };
for (const p of json.data ?? []) {
  console.log(`\n${p.description}`);
  console.log(JSON.stringify(p.aisleLocations ?? "(no location info)", null, 2));
}
