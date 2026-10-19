"use server";
// Everything Cody can change from the admin screens. Each action re-checks that it's Cody.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdmin } from "@/lib/admin";
import { finalCaptureCents } from "@/lib/pricing";
import { authorizeOrder, chargeExtra, chargeFinal, releaseHold } from "@/lib/payments";
import { paymentsEnabled } from "@/lib/stripe";

const clip = (s: unknown, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "");
const cents = (v: unknown) => {
  const n = Number(String(v ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
};

// ───────────────────────── Orders & batches ─────────────────────────

export async function startBatch(orderIds: string[]) {
  const { db } = await assertAdmin();
  const ids = [...new Set(orderIds)].slice(0, 12);
  if (ids.length === 0) throw new Error("Pick at least one order.");
  const { data: batch, error } = await db.from("shopping_batches").insert({}).select("id").single();
  if (error) throw error;
  await db.from("orders").update({ batch_id: batch.id, status: "shopping" }).in("id", ids).in("status", ["placed", "shopping"]);
  await holdCards(db, ids);
  revalidatePath("/admin");
  redirect(`/admin/shop/${batch.id}`);
}

/** Orders booked too far out to hold at checkout get their hold now. Declines are flagged on the order. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function holdCards(db: any, orderIds: string[]) {
  if (!paymentsEnabled()) return;
  const { data } = await db.from("orders").select("id").in("id", orderIds).in("payment_status", ["card_saved", "failed"]);
  await Promise.all((data ?? []).map((o: { id: string }) => authorizeOrder(o.id)));
}

export async function retryHold(orderId: string) {
  await assertAdmin();
  const r = await authorizeOrder(orderId);
  revalidatePath("/admin");
  return r;
}

export async function addOrdersToBatch(batchId: string, orderIds: string[]) {
  const { db } = await assertAdmin();
  await db.from("orders").update({ batch_id: batchId, status: "shopping" }).in("id", orderIds).in("status", ["placed", "shopping"]);
  await holdCards(db, orderIds);
  revalidatePath(`/admin/shop/${batchId}`);
}

export async function removeOrderFromBatch(batchId: string, orderId: string) {
  const { db } = await assertAdmin();
  await db.from("orders").update({ batch_id: null, status: "placed" }).eq("id", orderId).eq("batch_id", batchId);
  revalidatePath(`/admin/shop/${batchId}`);
}

export async function finishBatch(batchId: string) {
  const { db } = await assertAdmin();
  await db.from("orders").update({ status: "delivering" }).eq("batch_id", batchId).eq("status", "shopping");
  await db.from("shopping_batches").update({ finished_at: new Date().toISOString() }).eq("id", batchId);
  revalidatePath("/admin");
  redirect(`/admin/shop/${batchId}/receipts`);
}

/** Save what each store's receipt came to for one order, and work out the final total. */
export async function saveReceipts(orderId: string, receipts: { kroger?: string; meijer?: string }) {
  const { db } = await assertAdmin();
  const { data: o, error } = await db.from("orders")
    .select("kroger_store_id, meijer_store_id, service_fee_cents, second_store_fee_cents, tip_cents, authorized_amount_cents")
    .eq("id", orderId).single();
  if (error) throw error;
  const k = o.kroger_store_id ? cents(receipts.kroger) : null;
  const m = o.meijer_store_id ? cents(receipts.meijer) : null;
  if ((o.kroger_store_id && k === null) || (o.meijer_store_id && m === null)) throw new Error("Enter each store's receipt total.");
  const subtotal = (k ?? 0) + (m ?? 0);
  const { captureCents, overAuthorizationCents } = finalCaptureCents({
    receiptSubtotalCents: subtotal, serviceFeeCents: o.service_fee_cents, secondStoreFeeCents: o.second_store_fee_cents ?? 0,
    tipCents: o.tip_cents, authorizedCents: o.authorized_amount_cents,
  });
  const totalCents = captureCents + overAuthorizationCents;
  await db.from("orders").update({
    receipt_kroger_cents: k, receipt_meijer_cents: m, final_subtotal_cents: subtotal,
    final_total_cents: totalCents, finalized_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq("id", orderId);
  // Charge the card: capture the hold up to its amount (refund if lowered after charging).
  let charge: { chargedCents: number; overCents: number; note?: string } = { chargedCents: 0, overCents: overAuthorizationCents };
  try { charge = await chargeFinal(orderId, totalCents); }
  catch (e) { charge = { chargedCents: 0, overCents: totalCents, note: `Charge failed: ${(e as Error).message}` }; }
  revalidatePath("/admin");
  return { totalCents, captureCents, overAuthorizationCents: charge.overCents, chargedCents: charge.chargedCents, note: charge.note, paymentsOn: paymentsEnabled() };
}

/** Charge the part of the total above the hold (after the customer OKs it). */
export async function chargeOverHold(orderId: string, cents: number) {
  await assertAdmin();
  if (!(cents > 0 && cents < 100_000)) throw new Error("Bad amount.");
  await chargeExtra(orderId, Math.round(cents));
  revalidatePath("/admin");
}

export async function setOrderStatus(orderId: string, status: "placed" | "shopping" | "delivering" | "delivered" | "canceled") {
  const { db } = await assertAdmin();
  if (status === "canceled") await releaseHold(orderId);
  await db.from("orders").update({ status, updated_at: new Date().toISOString() }).eq("id", orderId);
  revalidatePath("/admin");
}

// ───────────────────────── Items while shopping ─────────────────────────

type ItemUpdate = {
  status?: "pending" | "found" | "substituted" | "out_of_stock";
  foundQuantity?: number | null;
  substituteName?: string | null;
  actualPrice?: string | null;
  shopperNote?: string | null;
  scannedUpc?: string | null;
  removed?: boolean;
};

export async function updateItem(itemId: string, u: ItemUpdate) {
  const { db } = await assertAdmin();
  const patch: Record<string, unknown> = {};
  if (u.status) patch.status = u.status;
  if (u.foundQuantity !== undefined) patch.found_quantity = u.foundQuantity;
  if (u.substituteName !== undefined) patch.substitute_name = clip(u.substituteName, 200) || null;
  if (u.actualPrice !== undefined) patch.actual_price_cents = cents(u.actualPrice);
  if (u.shopperNote !== undefined) patch.shopper_note = clip(u.shopperNote, 300) || null;
  if (u.scannedUpc !== undefined) patch.scanned_upc = clip(u.scannedUpc, 20).replace(/\D/g, "") || null;
  if (u.removed !== undefined) patch.removed = u.removed;
  const { data: item, error } = await db.from("order_items").update(patch).eq("id", itemId).select("product_id, status, scanned_upc").single();
  if (error) throw error;

  // Learn barcodes: if Cody scanned the real item and the catalog doesn't know its UPC yet, save it.
  if (item.product_id && item.scanned_upc && item.status === "found") {
    await db.from("products").update({ upc: item.scanned_upc }).eq("id", item.product_id).is("upc", null);
  }
}

export async function addItem(orderId: string, form: { chain: "kroger" | "meijer"; name: string; quantity: number; price?: string; note?: string }) {
  const { db } = await assertAdmin();
  const name = clip(form.name, 200);
  if (!name) throw new Error("Enter what you're adding.");
  const price = cents(form.price);
  const { error } = await db.from("order_items").insert({
    order_id: orderId,
    chain: form.chain === "meijer" ? "meijer" : "kroger",
    free_text: name,
    name_snapshot: name,
    quantity: Math.max(1, Math.min(Number(form.quantity) || 1, 99)),
    unit_price_cents_snapshot: price,
    actual_price_cents: price,
    status: "found",
    added_by_shopper: true,
    shopper_note: clip(form.note, 300) || null,
    sub_choice: "codys_pick",
  });
  if (error) throw error;
}

/** Cody sets where an item lives. Saved per store so the next order already knows. */
export async function setAisle(itemId: string, storeId: string | null, aisle: string, detail?: string) {
  const { db } = await assertAdmin();
  const label = clip(aisle, 40);
  const { data: item } = await db.from("order_items").select("product_id").eq("id", itemId).single();
  if (item?.product_id && storeId) {
    if (!label) {
      await db.from("product_locations").delete().eq("store_id", storeId).eq("product_id", item.product_id);
    } else {
      const n = label.match(/(\d{1,3})/);
      await db.from("product_locations").upsert(
        { store_id: storeId, product_id: item.product_id, aisle: label, sort_key: n ? Number(n[1]) : null, bay: null, detail: clip(detail, 80) || null, source: "cody", updated_at: new Date().toISOString() },
        { onConflict: "store_id,product_id" },
      );
    }
  } else {
    const extra = clip(detail, 80);
    await db.from("order_items").update({ shopper_aisle: label ? (extra ? `${label} · ${extra}` : label) : null }).eq("id", itemId);
  }
}

// ───────────────────────── Calendar ─────────────────────────

const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);

/** Open or close one 2-hour window on one date. */
export async function setSlotOpen(date: string, slotTemplateId: number, open: boolean) {
  const { db } = await assertAdmin();
  if (!isDate(date)) throw new Error("Bad date");
  await db.from("schedule_overrides").delete().eq("date", date).eq("slot_template_id", slotTemplateId);
  await db.from("schedule_overrides").insert({ date, slot_template_id: slotTemplateId, is_open: open });
  revalidatePath("/admin/calendar");
}

/** Open or block a whole day (clears per-window changes for that day). */
export async function setDayOpen(date: string, open: boolean, note?: string) {
  const { db } = await assertAdmin();
  if (!isDate(date)) throw new Error("Bad date");
  await db.from("schedule_overrides").delete().eq("date", date);
  await db.from("schedule_overrides").insert({ date, slot_template_id: null, is_open: open, note: clip(note, 80) || null });
  revalidatePath("/admin/calendar");
}

/** Back to the default week for that day. */
export async function resetDay(date: string) {
  const { db } = await assertAdmin();
  if (!isDate(date)) throw new Error("Bad date");
  await db.from("schedule_overrides").delete().eq("date", date);
  revalidatePath("/admin/calendar");
}

export async function setWeekdayDefault(weekday: number, open: boolean) {
  const { db } = await assertAdmin();
  if (!(weekday >= 0 && weekday <= 6)) throw new Error("Bad weekday");
  await db.from("weekly_schedule").upsert({ weekday, is_open: open });
  revalidatePath("/admin/calendar");
}

/** Move an appointment to another date/window. Cody can overbook on purpose; it's his call. */
export async function moveOrder(orderId: string, date: string, slotTemplateId: number) {
  const { db } = await assertAdmin();
  if (!isDate(date)) throw new Error("Bad date");
  const { error } = await db.from("orders").update({ delivery_date: date, slot_template_id: slotTemplateId, updated_at: new Date().toISOString() }).eq("id", orderId);
  if (error) throw error;
  revalidatePath("/admin/calendar");
  revalidatePath("/admin");
}

// ───────────────────────── Available now (same-day ASAP) ─────────────────────────

/** Turn same-day ASAP orders on for a number of minutes, or off (0). */
export async function setAvailable(minutes: number) {
  const { db } = await assertAdmin();
  const until = minutes > 0 ? new Date(Date.now() + Math.min(minutes, 12 * 60) * 60_000).toISOString() : null;
  await db.from("settings").update({ available_until: until }).eq("id", true);
  revalidatePath("/admin");
}

export async function setAsapCapacity(n: number) {
  const { db } = await assertAdmin();
  await db.from("settings").update({ asap_capacity: Math.max(1, Math.min(Math.round(n), 10)) }).eq("id", true);
  revalidatePath("/admin");
}
