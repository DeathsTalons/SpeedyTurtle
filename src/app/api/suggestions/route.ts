// "Buy again" (this customer's past items) and "Popular" (what everyone orders) for one store,
// shown on the shop page before the customer searches. Prices are re-checked live with the store.
import { NextResponse, type NextRequest } from "next/server";
import { customerContext } from "@/lib/customer";
import { orderStores } from "@/lib/data";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { kroger } from "@/lib/kroger-server";
import { meijer } from "@/lib/meijer-server";
import { rankByOrders } from "@/lib/shopping";
import type { SearchResult } from "../search/route";

/* eslint-disable @typescript-eslint/no-explicit-any */
const BUY_AGAIN = 12;
const POPULAR = 12;

export async function GET(request: NextRequest) {
  const ctx = await customerContext();
  if (!ctx) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const chain = request.nextUrl.searchParams.get("chain") === "meijer" ? "meijer" : "kroger";
  const primary = request.nextUrl.searchParams.get("primary") === "meijer" ? "meijer" : "kroger";
  const admin = supabaseAdmin() as any;

  // Recent orders first, then their items, so "recent" really means recent.
  const recentItems = async (onlyMine: boolean, orderLimit: number) => {
    let q = admin.from("orders").select("id, created_at").neq("status", "canceled").order("created_at", { ascending: false }).limit(orderLimit);
    if (onlyMine) q = q.eq("customer_id", ctx.user.id);
    const { data: orders } = await q;
    if (!orders?.length) return [];
    const when = new Map<string, string>(orders.map((o: any) => [o.id, o.created_at]));
    let iq = admin.from("order_items").select("product_id, order_id").in("order_id", [...when.keys()])
      .eq("chain", chain).eq("removed", false).not("product_id", "is", null);
    if (!onlyMine) iq = iq.eq("added_by_shopper", false);
    const { data: items } = await iq;
    return (items ?? []).map((x: any) => ({ productId: x.product_id, orderedAt: when.get(x.order_id) ?? "" }));
  };
  const [mine, everyone] = await Promise.all([recentItems(true, 40), recentItems(false, 150)]);
  const buyAgainIds = rankByOrders(mine, BUY_AGAIN);
  const popularIds = rankByOrders(everyone, POPULAR, new Set(buyAgainIds));
  const ids = [...buyAgainIds, ...popularIds];
  if (ids.length === 0) return NextResponse.json({ buyAgain: [], popular: [] });

  const { data: products } = await admin.from("products").select("*").in("id", ids);
  const byId = new Map<string, any>((products ?? []).map((p: any) => [p.id, p]));

  // Live prices at the store this order uses; fall back to the last saved price.
  const store = (await orderStores(ctx.home, primary))[chain];
  const live = new Map<string, { price: number | null; sale: number | null; inStock?: boolean; image?: string | null }>();
  try {
    const ext = ids.map((id) => byId.get(id)?.external_id).filter(Boolean);
    if (chain === "kroger" && store?.externalLocationId) {
      for (const p of await kroger().getProducts(ext, store.externalLocationId)) live.set(p.externalId, { price: p.priceCents, sale: p.salePriceCents, image: p.imageUrl });
    } else if (chain === "meijer") {
      for (const p of await meijer().getItems(ext)) live.set(p.externalId, { price: p.priceCents, sale: p.salePriceCents, inStock: p.inStock, image: p.imageUrl });
    }
  } catch (e) {
    console.warn("suggestions: live prices failed, using saved prices", (e as Error).message);
  }

  const toResult = (id: string): SearchResult | null => {
    const p = byId.get(id);
    if (!p) return null;
    const l = live.get(p.external_id);
    // Kroger returned nothing for it at this store → probably not carried there; skip it.
    if (chain === "kroger" && live.size > 0 && !l) return null;
    return {
      chain, externalId: p.external_id, upc: p.upc, name: p.name, brand: p.brand, size: p.size,
      imageUrl: l?.image ?? p.image_url, priceCents: l?.price ?? p.price_cents, salePriceCents: l ? l.sale : p.sale_price_cents,
      estimated: chain === "meijer" || !l, inStock: l?.inStock,
    };
  };
  return NextResponse.json({
    buyAgain: buyAgainIds.map(toResult).filter(Boolean),
    popular: popularIds.map(toResult).filter(Boolean),
  });
}
