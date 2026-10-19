// Quick check that Meijer search works from this computer:
//   node scripts/check-meijer.ts "whole milk"
import { MeijerClient } from "../src/lib/meijer.ts";

const term = process.argv[2] ?? "whole milk";
const m = MeijerClient.fromEnv();
const items = await m.search(term, 5);
console.log(`Meijer search "${term}": ${items.length} results`);
for (const p of items) {
  const price = p.salePriceCents ?? p.priceCents;
  console.log(` - ${p.name}  ${price != null ? "$" + (price / 100).toFixed(2) : "no price"}${p.salePriceCents ? " (sale)" : ""}  #${p.externalId}`);
}
if (items[0]) {
  const [again] = await m.getItems([items[0].externalId]);
  console.log(`Lookup by number #${items[0].externalId}: ${again ? "OK" : "not found"}`);
}
