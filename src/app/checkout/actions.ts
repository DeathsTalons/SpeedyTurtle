"use server";
// Checkout: everything the browser sends is re-checked here.
// Prices are re-fetched, fees recomputed, and the delivery window re-validated,
// so a customer can't edit their way to a cheaper order or an overbooked slot.
import { customerContext } from "@/lib/customer";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAvailability, getAvailableSlots, getFeeTiers, getSettings, orderStores } from "@/lib/data";
import { kroger } from "@/lib/kroger-server";
import { meijer } from "@/lib/meijer-server";
import { quoteOrder, type CartLine } from "@/lib/pricing";
import { addDays, localDate, weekdayOf } from "@/lib/schedule";
import { paymentsEnabled, HOLD_AT_CHECKOUT_WITHIN_DAYS } from "@/lib/stripe";
import { authorizeOrder, createCardSetup, verifyPaymentMethod } from "@/lib/payments";
import { MAX_APPROVED_SUBS, SUB_CHOICES, type ApprovedSub, type SubChoice } from "@/lib/shopping";

export type CheckoutItem = {
  chain: "kroger" | "meijer";
  externalId?: string;
  productId?: string;
  freeText?: string;
  quantity: number;
  note?: string;
  subChoice?: SubChoice;
  approvedSubs?: ApprovedSub[];
};

export type CheckoutInput = {
  addressId: string;
  /** Saved card from the checkout card form (when payments are on). */
  paymentMethodId?: string;
  /** The store the order started at; the other chain is the add-on. */
  primaryChain: "kroger" | "meijer";
  date: string;
  slotTemplateId: number;
  /** Same-day, while Cody is "available now". */
  asap?: boolean;
  notes?: string;
  tipCents: number;
  items: CheckoutItem[];
};

export type CheckoutResult = { orderId?: string; error?: string };

const clip = (s: unknown, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "");

async function mapLimit<T, R>(list: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(list.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, async () => {
    while (next < list.length) { const i = next++; out[i] = await fn(list[i]); }
  }));
  return out;
}

/** Starts the card form at checkout. */
export async function startCardSetup(): Promise<{ clientSecret?: string; error?: string }> {
  if (!paymentsEnabled()) return {};
  const ctx = await customerContext();
  if (!ctx) return { error: "Sign in again." };
  try { return { clientSecret: await createCardSetup(ctx.user.id, ctx.user.email) }; }
  catch (e) { console.error("card setup failed", e); return { error: "The card form didn't load. Refresh and try again." }; }
}

export async function placeOrder(input: CheckoutInput): Promise<CheckoutResult> {
  const ctx = await customerContext();
  if (!ctx) return { error: "Sign in again to place your order." };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = supabaseAdmin() as any;

  // ── Basic checks ──
  const address = ctx.addresses.find((a) => a.id === input.addressId);
  if (!address) return { error: "Pick a delivery address." };
  const tipCents = Math.max(0, Math.min(Math.round(Number(input.tipCents) || 0), 20000));

  const items = (Array.isArray(input.items) ? input.items : [])
    .slice(0, 200)
    .map((i) => ({
      chain: i.chain === "meijer" ? ("meijer" as const) : ("kroger" as const),
      externalId: clip(i.externalId, 40) || undefined,
      productId: clip(i.productId, 40) || undefined,
      freeText: clip(i.freeText, 200) || undefined,
      quantity: Math.max(1, Math.min(Math.round(Number(i.quantity) || 1), 99)),
      note: clip(i.note, 300) || undefined,
      subChoice: (SUB_CHOICES.some((s) => s.id === i.subChoice) ? i.subChoice : "codys_pick") as SubChoice,
      approvedSubs: (Array.isArray(i.approvedSubs) ? i.approvedSubs : []).slice(0, MAX_APPROVED_SUBS)
        .map((a) => ({ name: clip(a?.name, 200), externalId: clip(a?.externalId, 40) || undefined, upc: clip(a?.upc, 20).replace(/\D/g, "") || null,
          priceCents: Number.isFinite(Number(a?.priceCents)) ? Math.round(Number(a.priceCents)) : null }))
        .filter((a) => a.name),
    }))
    .filter((i) => i.externalId || i.productId || i.freeText);
  if (items.length === 0) return { error: "Your cart is empty." };

  // ── Card (when payments are on) ──
  const payments = paymentsEnabled();
  if (payments) {
    if (!input.paymentMethodId) return { error: "Add a card to place your order." };
    const ok = await verifyPaymentMethod(ctx.user.id, clip(input.paymentMethodId, 80)).catch(() => null);
    if (!ok) return { error: "That card didn't save. Try entering it again." };
  }

  // ── Delivery window still open? (or ASAP, while Cody is available) ──
  let slot: { date: string; slotTemplateId: number | null };
  if (input.asap) {
    const a = await getAvailability();
    if (!a.open) return { error: "Cody just stopped taking same-day orders. Pick a delivery window instead." };
    slot = { date: localDate(new Date()), slotTemplateId: null };
  } else {
    const slots = await getAvailableSlots();
    const found = slots.find((s) => s.date === input.date && s.slotTemplateId === Number(input.slotTemplateId));
    if (!found) return { error: "That delivery window just filled up or closed. Pick another one." };
    slot = found;
  }

  const settings = await getSettings();
  const weekStart = addDays(slot.date, -weekdayOf(slot.date));
  const { count: weekCount } = await admin.from("orders").select("id", { count: "exact", head: true })
    .neq("status", "canceled").gte("delivery_date", weekStart).lte("delivery_date", addDays(weekStart, 6));
  if ((weekCount ?? 0) >= settings.maxOrdersPerWeek) return { error: "Cody is fully booked that week. Pick a day in another week." };

  // ── Stores: main store nearest this address, add-on store nearest the main store ──
  const home = address.latitude != null ? { latitude: address.latitude, longitude: address.longitude } : null;
  const chainsInCart = new Set(items.map((i) => i.chain));
  const startChain = chainsInCart.size === 1 ? [...chainsInCart][0] : input.primaryChain === "meijer" ? "meijer" : "kroger";
  const stores = await orderStores(home, startChain);
  const hasKroger = items.some((i) => i.chain === "kroger");
  const hasMeijer = items.some((i) => i.chain === "meijer");
  if (hasKroger && !stores.kroger?.externalLocationId) return { error: "No Kroger store is set up yet." };
  if (hasMeijer && !stores.meijer) return { error: "No Meijer store is set up yet." };
  if (hasKroger && hasMeijer) {
    const startStore = stores[startChain]!;
    if (!startStore.allowSecondStore) {
      const other = startChain === "kroger" ? "Meijer" : "Kroger";
      return { error: `Orders from ${startStore.name} can't include ${other} items. Remove the ${other} items and try again.` };
    }
  }

  // ── Re-price Kroger items at that store, and save them to the catalog ──
  const krogerIds = [...new Set(items.filter((i) => i.chain === "kroger" && i.externalId).map((i) => i.externalId!))];
  const krogerRows = await mapLimit(krogerIds, 5, async (id) => {
    try { return await kroger().getProduct(id, stores.kroger!.externalLocationId!); } catch { return null; }
  });
  const now = new Date().toISOString();
  const found = krogerRows.filter((p): p is NonNullable<typeof p> => p !== null);
  const productIdByKroger = new Map<string, { id: string; price: number | null; name: string }>();
  if (found.length) {
    const { data, error } = await admin.from("products").upsert(found.map((p) => ({
      chain: "kroger", external_id: p.externalId, upc: p.upc, name: p.name, brand: p.brand, size: p.size,
      image_url: p.imageUrl, department: p.department, aisle: p.aisle,
      price_cents: p.priceCents, sale_price_cents: p.salePriceCents, price_updated_at: now, active: true,
    })), { onConflict: "chain,external_id" }).select("id, external_id, name, price_cents, sale_price_cents");
    if (error) return { error: "Couldn't save your items. Try again." };
    for (const r of data) productIdByKroger.set(r.external_id, { id: r.id, price: r.sale_price_cents ?? r.price_cents, name: r.name });

    // Remember where each item sits in THIS Kroger. Cody's own corrections are never overwritten.
    const storeId = stores.kroger!.id;
    const withAisle = found.filter((p) => p.aisle && productIdByKroger.has(p.externalId));
    if (withAisle.length) {
      const ids = withAisle.map((p) => productIdByKroger.get(p.externalId)!.id);
      const { data: mine } = await admin.from("product_locations").select("product_id").eq("store_id", storeId).eq("source", "cody").in("product_id", ids);
      const keep = new Set((mine ?? []).map((r: { product_id: string }) => r.product_id));
      const rows = withAisle
        .map((p) => ({ store_id: storeId, product_id: productIdByKroger.get(p.externalId)!.id, aisle: p.aisle!, sort_key: p.aisleSort, bay: p.aisleBay, detail: p.aisleDetail, source: "kroger", updated_at: now }))
        .filter((r) => !keep.has(r.product_id));
      if (rows.length) await admin.from("product_locations").upsert(rows, { onConflict: "store_id,product_id" });
    }
  }
  const missing = krogerIds.filter((id) => !productIdByKroger.has(id));
  if (missing.length) return { error: `${missing.length} Kroger ${missing.length === 1 ? "item isn't" : "items aren't"} available at ${stores.kroger!.name} anymore. Remove ${missing.length === 1 ? "it" : "them"} from your cart and try again.` };

  // ── Meijer items from live search: re-check with the feed, save to the catalog ──
  // If the feed is down, fall back to the last saved price so checkout still works.
  const meijerExt = [...new Set(items.filter((i) => i.chain === "meijer" && i.externalId).map((i) => i.externalId!))];
  const productIdByMeijer = new Map<string, { id: string; price: number | null; name: string }>();
  if (meijerExt.length) {
    let fresh: Awaited<ReturnType<ReturnType<typeof meijer>["getItems"]>> = [];
    try { fresh = await meijer().getItems(meijerExt); } catch (e) { console.warn("Meijer re-price failed:", (e as Error).message); }
    if (fresh.length) {
      const { data, error } = await admin.from("products").upsert(fresh.map((p) => ({
        chain: "meijer", external_id: p.externalId, upc: p.externalId, name: p.name, size: p.size, image_url: p.imageUrl,
        price_cents: p.priceCents, sale_price_cents: p.salePriceCents, price_updated_at: now, active: true,
      })), { onConflict: "chain,external_id" }).select("id, external_id, name, price_cents, sale_price_cents");
      if (error) return { error: "Couldn't save your items. Try again." };
      for (const r of data) productIdByMeijer.set(r.external_id, { id: r.id, price: r.sale_price_cents ?? r.price_cents, name: r.name });
    }
    const stillMissing = meijerExt.filter((id) => !productIdByMeijer.has(id));
    if (stillMissing.length) {
      const { data } = await admin.from("products").select("id, external_id, name, price_cents, sale_price_cents").eq("chain", "meijer").in("external_id", stillMissing);
      for (const r of data ?? []) productIdByMeijer.set(r.external_id, { id: r.id, price: r.sale_price_cents ?? r.price_cents, name: r.name });
    }
    const gone = meijerExt.filter((id) => !productIdByMeijer.has(id));
    if (gone.length) return { error: `${gone.length} Meijer ${gone.length === 1 ? "item isn't" : "items aren't"} available anymore. Remove ${gone.length === 1 ? "it" : "them"} from your cart and try again.` };
  }

  // ── Meijer items from Cody's catalog ──
  const meijerIds = [...new Set(items.filter((i) => i.chain === "meijer" && i.productId).map((i) => i.productId!))];
  const meijerById = new Map<string, { price: number | null; name: string }>();
  if (meijerIds.length) {
    const { data } = await admin.from("products").select("id, name, price_cents, sale_price_cents").eq("chain", "meijer").in("id", meijerIds);
    for (const r of data ?? []) meijerById.set(r.id, { price: r.sale_price_cents ?? r.price_cents, name: r.name });
    if (meijerById.size !== meijerIds.length) return { error: "A Meijer item in your cart is no longer listed. Remove it and try again." };
  }

  // ── Build priced lines and the quote ──
  const priced = items.map((i) => {
    if (i.chain === "kroger" && i.externalId) {
      const p = productIdByKroger.get(i.externalId)!;
      return { ...i, productRowId: p.id, name: p.name, unitPrice: p.price };
    }
    if (i.chain === "meijer" && i.externalId) {
      const p = productIdByMeijer.get(i.externalId)!;
      return { ...i, productRowId: p.id, name: p.name, unitPrice: p.price };
    }
    if (i.chain === "meijer" && i.productId) {
      const p = meijerById.get(i.productId)!;
      return { ...i, productRowId: i.productId, name: p.name, unitPrice: p.price };
    }
    return { ...i, productRowId: null, name: i.freeText!, unitPrice: null };
  });
  const lines: CartLine[] = priced.map((p) => ({ chain: p.chain, productId: p.productRowId, freeText: p.productRowId ? null : p.freeText, quantity: p.quantity, unitPriceCents: p.unitPrice }));
  const quote = quoteOrder(lines, await getFeeTiers(), { bufferPct: settings.authBufferPct, extraBufferPct: { meijer: settings.meijerExtraBufferPct }, tipCents, secondStoreFeeCents: settings.secondStoreFeeCents });

  // ── Save the order ──
  const { data: order, error: orderErr } = await admin.from("orders").insert({
    customer_id: ctx.user.id,
    address_id: address.id,
    delivery_date: slot.date,
    slot_template_id: slot.slotTemplateId,
    asap: !!input.asap,
    payment_status: payments ? "card_saved" : "none",
    stripe_payment_method_id: payments ? clip(input.paymentMethodId, 80) : null,
    customer_notes: clip(input.notes, 500) || null,
    unique_item_count: quote.uniqueItems,
    service_fee_cents: quote.serviceFeeCents,
    second_store_fee_cents: quote.secondStoreFeeCents,
    estimated_subtotal_cents: quote.estimatedSubtotalCents,
    tip_cents: quote.tipCents,
    authorized_amount_cents: quote.authorizeCents,
    kroger_store_id: hasKroger ? stores.kroger!.id : null,
    meijer_store_id: hasMeijer ? stores.meijer!.id : null,
    // stripe_payment_intent_id: set once card payments are connected
  }).select("id").single();
  if (orderErr) return { error: "Couldn't place your order. Try again." };

  const { error: itemsErr } = await admin.from("order_items").insert(priced.map((p) => ({
    order_id: order.id,
    chain: p.chain,
    product_id: p.productRowId,
    free_text: p.productRowId ? null : p.freeText,
    name_snapshot: p.name,
    unit_price_cents_snapshot: p.unitPrice,
    quantity: p.quantity,
    item_note: p.note ?? null,
    sub_choice: p.subChoice,
    approved_subs: p.subChoice === "approved" ? p.approvedSubs : [],
  })));
  if (itemsErr) {
    await admin.from("orders").delete().eq("id", order.id);
    return { error: "Couldn't place your order. Try again." };
  }

  // Hold the card now if delivery is soon (holds last about a week); otherwise it's placed when Cody starts shopping.
  if (payments) {
    const daysOut = (new Date(`${slot.date}T12:00:00Z`).getTime() - new Date(`${localDate(new Date())}T12:00:00Z`).getTime()) / 86_400_000;
    if (daysOut <= HOLD_AT_CHECKOUT_WITHIN_DAYS) {
      const hold = await authorizeOrder(order.id);
      if (!hold.ok) {
        await admin.from("orders").delete().eq("id", order.id);
        return { error: `Your card wasn't accepted: ${hold.error} Try another card.` };
      }
    }
  }
  return { orderId: order.id };
}
