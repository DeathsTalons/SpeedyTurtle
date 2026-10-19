// Picks the nearest store of each chain for a customer's address.

export type Chain = "kroger" | "meijer";
export type LatLng = { latitude: number; longitude: number };
export type Store = {
  id: string;
  chain: Chain;
  name: string;
  active: boolean;
  latitude: number | null;
  longitude: number | null;
};

/** Straight-line ("as the crow flies") miles. Good enough for picking between a few nearby stores. */
export function milesBetween(a: LatLng, b: LatLng): number {
  const R = 3958.8;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Nearest active store of a chain. If the address couldn't be located, falls back to the
 * first active store (by name) so checkout never gets stuck — Cody can fix it on the order.
 */
export function nearestStore(chain: Chain, stores: Store[], home: LatLng | null): { store: Store; miles: number | null } | null {
  const candidates = stores.filter((s) => s.chain === chain && s.active).sort((a, b) => a.name.localeCompare(b.name));
  if (candidates.length === 0) return null;

  const located = candidates.filter((s) => s.latitude !== null && s.longitude !== null);
  if (!home || located.length === 0) return { store: candidates[0], miles: null };

  let best = located[0];
  let bestMiles = milesBetween(home, best as LatLng);
  for (const s of located.slice(1)) {
    const m = milesBetween(home, s as LatLng);
    if (m < bestMiles) [best, bestMiles] = [s, m];
  }
  return { store: best, miles: Math.round(bestMiles * 10) / 10 };
}

/**
 * Stores for one order. The main store is the one nearest the customer; the add-on store
 * (other chain) is the one nearest the MAIN store, since Cody goes from one to the other.
 * e.g. Greencastle customer + Meijer order → Meijer Avon, then Kroger Avon (not Greencastle).
 */
export function storesForOrder<S extends Store>(primary: Chain, stores: S[], home: LatLng | null): { primary?: S; addOn?: S } {
  const main = nearestStore(primary, stores, home)?.store as S | undefined;
  const other: Chain = primary === "kroger" ? "meijer" : "kroger";
  const from = main && main.latitude !== null && main.longitude !== null ? { latitude: main.latitude, longitude: main.longitude } : home;
  const addOn = nearestStore(other, stores, from)?.store as S | undefined;
  return { primary: main, addOn };
}

/**
 * Free US address → coordinates via the U.S. Census Bureau geocoder (no API key needed).
 * Returns null if the address can't be matched; callers should save the address anyway.
 */
export async function geocodeAddress(
  addr: { line1: string; city: string; state: string; zip: string },
  fetchFn: typeof fetch = fetch,
): Promise<LatLng | null> {
  return geocodeOneLine(`${addr.line1}, ${addr.city}, ${addr.state} ${addr.zip}`, fetchFn);
}

/** Same as geocodeAddress, for a full address in one string ("9202 E 56th St, Brownsburg, IN 46112"). */
export async function geocodeOneLine(address: string, fetchFn: typeof fetch = fetch): Promise<LatLng | null> {
  const qs = new URLSearchParams({
    address,
    benchmark: "Public_AR_Current",
    format: "json",
  });
  try {
    const res = await fetchFn(`https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?${qs}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: { addressMatches?: { coordinates: { x: number; y: number } }[] } };
    const match = json.result?.addressMatches?.[0];
    return match ? { latitude: match.coordinates.y, longitude: match.coordinates.x } : null;
  } catch {
    return null;
  }
}
