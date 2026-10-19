// Kroger Public API client (https://developer.kroger.com).
// Server-side only — the client secret must never reach the browser.
// Prices are per store, so every product search needs a Kroger locationId.

const BASE = "https://api.kroger.com/v1";

export type KrogerProduct = {
  externalId: string;
  upc: string | null;
  name: string;
  brand: string | null;
  size: string | null;
  imageUrl: string | null;
  department: string | null;
  aisle: string | null;
  /** Numeric aisle at this store, for sorting the walk. */
  aisleSort: number | null;
  /** Bay along the aisle, if Kroger sends it (used to order items within an aisle). */
  aisleBay: number | null;
  /** "Left side · Bay 4 · Shelf 3", if Kroger sends it. */
  aisleDetail: string | null;
  priceCents: number | null;
  salePriceCents: number | null;
  inStore: boolean | null;
};

export type KrogerLocation = {
  locationId: string;
  chain: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
};

type Fetch = typeof fetch;

export class KrogerClient {
  private token: { value: string; expiresAt: number } | null = null;
  private clientId: string;
  private clientSecret: string;
  private fetchFn: Fetch;

  constructor(clientId: string, clientSecret: string, fetchFn: Fetch = fetch) {
    if (!clientId || !clientSecret) throw new Error("Missing KROGER_CLIENT_ID / KROGER_CLIENT_SECRET");
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.fetchFn = fetchFn;
  }

  static fromEnv(): KrogerClient {
    return new KrogerClient(process.env.KROGER_CLIENT_ID ?? "", process.env.KROGER_CLIENT_SECRET ?? "");
  }

  private async getToken(): Promise<string> {
    if (this.token && Date.now() < this.token.expiresAt - 60_000) return this.token.value;
    const res = await this.fetchFn(`${BASE}/connect/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64"),
      },
      body: new URLSearchParams({ grant_type: "client_credentials", scope: "product.compact" }).toString(),
    });
    if (!res.ok) throw new Error(`Kroger auth failed (${res.status}): ${await res.text()}`);
    const json = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
    return json.access_token;
  }

  private async get<T>(path: string, params: Record<string, string | number | undefined>, retried = false): Promise<T> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
    const res = await this.fetchFn(`${BASE}${path}?${qs}`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${await this.getToken()}` },
    });
    if (res.status === 401 && !retried) {
      this.token = null; // expired early — get a fresh one once
      return this.get(path, params, true);
    }
    if (!res.ok) throw new Error(`Kroger ${path} failed (${res.status}): ${await res.text()}`);
    return res.json() as Promise<T>;
  }

  /** Search products at one store. Kroger caps a page at 50. */
  async searchProducts(term: string, locationId: string, opts: { limit?: number; start?: number } = {}) {
    const json = await this.get<{ data: RawProduct[] }>("/products", {
      "filter.term": term,
      "filter.locationId": locationId,
      "filter.limit": Math.min(opts.limit ?? 24, 50),
      "filter.start": opts.start,
    });
    return json.data.map(mapProduct);
  }

  /** Several products at once (Kroger takes a comma-separated list), with a one-by-one fallback. */
  async getProducts(productIds: string[], locationId: string): Promise<KrogerProduct[]> {
    if (productIds.length === 0) return [];
    try {
      const json = await this.get<{ data: RawProduct[] }>("/products", {
        "filter.productId": productIds.slice(0, 50).join(","),
        "filter.locationId": locationId,
        "filter.limit": Math.min(productIds.length, 50),
      });
      return json.data.map(mapProduct);
    } catch {
      const out = await Promise.all(productIds.slice(0, 20).map((id) => this.getProduct(id, locationId).catch(() => null)));
      return out.filter((p): p is KrogerProduct => p !== null);
    }
  }

  async getProduct(productId: string, locationId: string) {
    const json = await this.get<{ data: RawProduct }>(`/products/${encodeURIComponent(productId)}`, {
      "filter.locationId": locationId,
    });
    return mapProduct(json.data);
  }

  /** Find Kroger-family stores near a ZIP. Use this once to get your store's locationId. */
  async findLocations(zip: string, radiusMiles = 15, chain = "KROGER"): Promise<KrogerLocation[]> {
    const json = await this.get<{ data: RawLocation[] }>("/locations", {
      "filter.zipCode.near": zip,
      "filter.radiusInMiles": radiusMiles,
      "filter.chain": chain,
      "filter.limit": 10,
    });
    return json.data.map(mapLocation);
  }

  /** One store by its location ID (e.g. "02100215") — used to fill in store coordinates. */
  async getLocation(locationId: string): Promise<KrogerLocation> {
    const json = await this.get<{ data: RawLocation }>(`/locations/${encodeURIComponent(locationId)}`, {});
    return mapLocation(json.data);
  }
}

export function mapLocation(l: RawLocation): KrogerLocation {
  return {
    locationId: l.locationId,
    chain: l.chain,
    name: l.name,
    address: [l.address?.addressLine1, l.address?.city, l.address?.state, l.address?.zipCode].filter(Boolean).join(", "),
    latitude: l.geolocation?.latitude ?? null,
    longitude: l.geolocation?.longitude ?? null,
  };
}

// ── Raw API shapes (only the fields we use) ──
type RawProduct = {
  productId: string;
  upc?: string;
  brand?: string;
  description: string;
  categories?: string[];
  aisleLocations?: {
    description?: string; number?: string; side?: string; bayNumber?: string;
    shelfNumber?: string; shelfPositionInBay?: string; sequenceNumber?: string;
  }[];
  images?: { perspective?: string; featured?: boolean; sizes?: { size: string; url: string }[] }[];
  items?: {
    size?: string;
    price?: { regular?: number; promo?: number };
    inventory?: { stockLevel?: string };
    fulfillment?: { inStore?: boolean };
  }[];
};
type RawLocation = {
  locationId: string;
  chain: string;
  name: string;
  address?: { addressLine1?: string; city?: string; state?: string; zipCode?: string };
  geolocation?: { latitude?: number; longitude?: number };
};

const num = (s?: string) => (s && /^\d+$/.test(s.trim()) ? Number(s) : null);

/** "Left side · Bay 4 · Shelf 3" from whatever Kroger fills in (often only some of it). */
export function shelfDetail(a?: { side?: string; bayNumber?: string; shelfNumber?: string; shelfPositionInBay?: string }): string | null {
  if (!a) return null;
  const side = a.side?.trim().toUpperCase();
  const parts = [
    side === "L" ? "Left side" : side === "R" ? "Right side" : null,
    num(a.bayNumber) !== null ? `Bay ${num(a.bayNumber)}` : null,
    num(a.shelfNumber) !== null ? `Shelf ${num(a.shelfNumber)}` : null,
    num(a.shelfPositionInBay) !== null ? `Spot ${num(a.shelfPositionInBay)}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

const toCents = (n?: number) => (typeof n === "number" && n > 0 ? Math.round(n * 100) : null);

export function mapProduct(p: RawProduct): KrogerProduct {
  const item = p.items?.[0];
  const img = p.images?.find((i) => i.featured) ?? p.images?.find((i) => i.perspective === "front") ?? p.images?.[0];
  const imageUrl =
    img?.sizes?.find((s) => s.size === "medium")?.url ?? img?.sizes?.find((s) => s.size === "large")?.url ?? img?.sizes?.[0]?.url ?? null;
  const regular = toCents(item?.price?.regular);
  const promo = toCents(item?.price?.promo);
  const aisle = p.aisleLocations?.[0];
  return {
    externalId: p.productId,
    upc: p.upc ?? null,
    name: p.description,
    brand: p.brand ?? null,
    size: item?.size ?? null,
    imageUrl,
    department: p.categories?.[0] ?? null,
    aisle: aisle ? (aisle.description?.trim() || (aisle.number ? `Aisle ${aisle.number}` : null)) : null,
    aisleSort: aisle?.number && /^\d+$/.test(aisle.number) ? Number(aisle.number) : null,
    aisleBay: num(aisle?.bayNumber) ?? num(aisle?.sequenceNumber),
    aisleDetail: [shelfDetail(aisle), ...(p.aisleLocations ?? []).slice(1, 3).map((x) => {
      const d = shelfDetail({ bayNumber: x.bayNumber, shelfNumber: x.shelfNumber });
      const sameAisle = !x.number || x.number === aisle?.number;
      return d ? `also ${sameAisle ? "" : `${x.description ?? `Aisle ${x.number}`} `}${d}` : null;
    })].filter(Boolean).join(" · ") || null,
    priceCents: regular,
    salePriceCents: promo && regular && promo < regular ? promo : null,
    inStore: item?.fulfillment?.inStore ?? null,
  };
}
