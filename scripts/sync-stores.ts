// Fills in address + map coordinates for every store, so nearest-store matching works.
//   Kroger stores: pulled from Kroger's API by location ID.
//   Meijer stores: looked up from their street address (free U.S. Census geocoder).
// Run once after setup, and again whenever you add a store:
//
//   node --env-file=.env.local scripts/sync-stores.ts

import { createClient } from "@supabase/supabase-js";
import { KrogerClient } from "../src/lib/kroger.ts";
import { geocodeOneLine } from "../src/lib/stores.ts";
import { supabaseUrl, supabaseSecretKey } from "../src/lib/env.ts";

const db = createClient(supabaseUrl(), supabaseSecretKey(), {
  auth: { persistSession: false },
});

const { data: stores, error } = await db.from("stores").select("id, chain, name, address, external_location_id");
if (error) throw error;

let kroger: KrogerClient | null = null;

for (const s of stores ?? []) {
  try {
    let update: { address?: string; latitude: number | null; longitude: number | null };
    if (s.chain === "kroger" && s.external_location_id) {
      kroger ??= KrogerClient.fromEnv();
      const loc = await kroger.getLocation(s.external_location_id);
      update = { address: loc.address, latitude: loc.latitude, longitude: loc.longitude };
    } else if (s.address) {
      const pt = await geocodeOneLine(s.address);
      if (!pt) throw new Error(`couldn't locate "${s.address}" — check the address`);
      update = pt;
    } else {
      throw new Error("no location ID or address to look up");
    }
    const { error: upErr } = await db.from("stores").update(update).eq("id", s.id);
    if (upErr) throw upErr;
    console.log(`✓ ${s.name}: ${update.address ?? s.address} (${update.latitude}, ${update.longitude})`);
  } catch (e) {
    console.error(`✗ ${s.name}: ${(e as Error).message}`);
  }
}
