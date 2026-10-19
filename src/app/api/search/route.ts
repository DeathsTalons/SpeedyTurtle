import { NextResponse, type NextRequest } from "next/server";
import { customerContext } from "@/lib/customer";
import { kroger } from "@/lib/kroger-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { orderStores } from "@/lib/data";
import { meijer } from "@/lib/meijer-server";

export type SearchResult = {
  chain: "kroger" | "meijer";
  externalId?: string;
  productId?: string;
  name: string;
  brand: string | null;
  size: string | null;
  imageUrl: string | null;
  priceCents: number | null;
  salePriceCents: number | null;
  /** Meijer prices are from a default store, so they're shown as "about". */
  estimated?: boolean;
  inStock?: boolean;
  upc?: string | null;
};

export async function GET(request: NextRequest) {
  const ctx = await customerContext();
  if (!ctx) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const chain = request.nextUrl.searchParams.get("chain") === "meijer" ? "meijer" : "kroger";
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  const primary = request.nextUrl.searchParams.get("primary") === "meijer" ? "meijer" : "kroger";
  const store = (await orderStores(ctx.home, primary))[chain];
  if (q.length < 2) return NextResponse.json({ store: store?.name ?? null, results: [] });

  try {
    if (chain === "kroger") {
      if (!store?.externalLocationId) return NextResponse.json({ error: "No Kroger store is set up." }, { status: 500 });
      const items = await kroger().searchProducts(q, store.externalLocationId, { limit: 24 });
      const results: SearchResult[] = items.map((p) => ({
        chain: "kroger", externalId: p.externalId, upc: p.upc, name: p.name, brand: p.brand, size: p.size,
        imageUrl: p.imageUrl, priceCents: p.priceCents, salePriceCents: p.salePriceCents,
      }));
      return NextResponse.json({ store: store.name, results });
    }

    // Meijer: live search feed first; if Meijer changes or blocks it, fall back to the saved catalog.
    try {
      const items = await meijer().search(q, 24);
      const results: SearchResult[] = items
        .filter((p) => !p.ageRestricted)
        .map((p) => ({
          chain: "meijer", externalId: p.externalId, upc: p.externalId, name: p.name, brand: null, size: p.size, imageUrl: p.imageUrl,
          priceCents: p.priceCents, salePriceCents: p.salePriceCents, estimated: true, inStock: p.inStock,
        }));
      return NextResponse.json({ store: store?.name ?? null, results });
    } catch (e) {
      console.warn("Meijer live search failed, using saved catalog:", (e as Error).message);
    }
    const words = q.split(/\s+/).filter(Boolean).slice(0, 5);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabaseAdmin() as any).from("products").select("*").eq("chain", "meijer").eq("active", true).limit(30);
    for (const w of words) query = query.or(`name.ilike.%${w.replace(/[%,()]/g, "")}%,brand.ilike.%${w.replace(/[%,()]/g, "")}%`);
    const { data, error } = await query;
    if (error) throw error;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: SearchResult[] = data.map((p: any) => ({
      chain: "meijer", externalId: p.external_id, name: p.name, brand: p.brand, size: p.size,
      imageUrl: p.image_url, priceCents: p.price_cents, salePriceCents: p.sale_price_cents, estimated: true,
    }));
    return NextResponse.json({ store: store?.name ?? null, results, fallback: true });
  } catch (e) {
    console.error("search failed", e);
    return NextResponse.json({ error: "Search isn't working right now. Try again in a minute." }, { status: 502 });
  }
}
