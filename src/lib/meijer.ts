// Meijer product search through the public search feed meijer.com itself uses (Constructor.io).
// Unofficial: Meijer can change it any time, so every caller has a fallback.
// Prices come from Meijer's default store and can differ ±20% from Cody's stores,
// so they're shown as estimates and the card hold for Meijer items is larger.

const BASE = "https://ac.cnstrc.com";
const DEFAULT_KEY = "key_GdYuTcnduTUtsZd6"; // public key meijer.com sends every visitor

export type MeijerProduct = {
  externalId: string;
  name: string;
  imageUrl: string | null;
  priceCents: number | null;
  salePriceCents: number | null;
  /** "per lb" for weighed items */
  size: string | null;
  inStock: boolean;
  ageRestricted: boolean;
};

type Raw = {
  value: string;
  data: {
    id: string | number;
    image_url?: string;
    price?: number;
    discountSalePriceValue?: number;
    sale?: boolean;
    priceByWeight?: boolean;
    priceUnit?: string;
    stockLevelStatus?: string;
    isBuyable?: boolean;
    isPurchasable?: boolean;
    deactivated?: boolean;
    isAgeRestricted?: boolean;
    isAlcohol?: boolean;
  };
};

const cents = (n?: number) => (typeof n === "number" && n > 0 ? Math.round(n * 100) : null);

export function mapMeijer(r: Raw): MeijerProduct {
  const d = r.data;
  const price = cents(d.price);
  const sale = cents(d.discountSalePriceValue);
  const weighed = d.priceByWeight || d.priceUnit === "LB";
  return {
    externalId: String(d.id),
    name: r.value,
    imageUrl: d.image_url ?? null,
    priceCents: price,
    salePriceCents: sale && price && sale < price ? sale : null,
    size: weighed ? "per lb" : null,
    inStock: d.stockLevelStatus ? d.stockLevelStatus !== "outOfStock" : true,
    ageRestricted: !!(d.isAgeRestricted || d.isAlcohol),
  };
}

const usable = (r: Raw) => !r.data.deactivated && r.data.isBuyable !== false && r.data.isPurchasable !== false;

export class MeijerClient {
  private key: string;
  private fetchFn: typeof fetch;
  private visitor = crypto.randomUUID();

  constructor(key = DEFAULT_KEY, fetchFn: typeof fetch = fetch) {
    this.key = key;
    this.fetchFn = fetchFn;
  }

  static fromEnv() {
    return new MeijerClient(process.env.MEIJER_SEARCH_KEY || DEFAULT_KEY);
  }

  private async get(path: string, params: URLSearchParams): Promise<Raw[]> {
    params.set("key", this.key);
    params.set("c", "ciojs-client-2.93.0");
    params.set("i", this.visitor);
    params.set("s", "1");
    const res = await this.fetchFn(`${BASE}${path}?${params}`, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Meijer search failed (${res.status})`);
    const json = (await res.json()) as { response?: { results?: Raw[] } };
    if (!json.response?.results) throw new Error("Meijer search returned an unexpected format");
    return json.response.results;
  }

  async search(term: string, limit = 24): Promise<MeijerProduct[]> {
    const p = new URLSearchParams({ num_results_per_page: String(Math.min(limit, 50)), section: "Products" });
    const rows = await this.get(`/search/${encodeURIComponent(term)}`, p);
    return rows.filter(usable).map(mapMeijer);
  }

  /** Look up specific items by Meijer product number (used to re-price at checkout). */
  async getItems(ids: string[]): Promise<MeijerProduct[]> {
    if (ids.length === 0) return [];
    const out: MeijerProduct[] = [];
    for (let i = 0; i < ids.length; i += 40) {
      const p = new URLSearchParams({ num_results_per_page: "50" });
      for (const id of ids.slice(i, i + 40)) p.append("ids", id);
      const rows = await this.get("/browse/items", p);
      out.push(...rows.map(mapMeijer));
    }
    return out;
  }
}
