import "server-only";
import type { ApprovedSub } from "@/lib/shopping";
/* eslint-disable @typescript-eslint/no-explicit-any */

export type BoardOrder = {
  id: string;
  date: string;
  slotTemplateId: number | null;
  slotLabel: string;
  start: string;
  end: string;
  status: string;
  batchId: string | null;
  customer: string;
  phone: string | null;
  city: string | null;
  itemCount: number;
  stores: string[];
  estimateCents: number;
  paymentStatus: string;
  paymentError: string | null;
};

const ORDER_SELECT =
  "id, delivery_date, slot_template_id, status, batch_id, payment_status, payment_error, unique_item_count, estimated_subtotal_cents, service_fee_cents, second_store_fee_cents, tip_cents," +
  " profiles(full_name, phone), addresses(city), slot_templates(label, start_time, end_time)," +
  " kroger:stores!orders_kroger_store_id_fkey(name), meijer:stores!orders_meijer_store_id_fkey(name)";

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export function toBoardOrder(o: any): BoardOrder {
  const slot = one(o.slot_templates) as any;
  const p = one(o.profiles) as any;
  return {
    id: o.id,
    date: o.delivery_date,
    slotTemplateId: o.slot_template_id,
    slotLabel: slot?.label ?? "",
    start: slot?.start_time ?? "",
    end: slot?.end_time ?? "",
    status: o.status,
    batchId: o.batch_id,
    customer: p?.full_name || "Customer",
    phone: p?.phone ?? null,
    city: (one(o.addresses) as any)?.city ?? null,
    itemCount: o.unique_item_count,
    stores: [(one(o.kroger) as any)?.name, (one(o.meijer) as any)?.name].filter(Boolean),
    estimateCents: o.estimated_subtotal_cents + o.service_fee_cents + (o.second_store_fee_cents ?? 0) + o.tip_cents,
    paymentStatus: o.payment_status ?? "none",
    paymentError: o.payment_error ?? null,
  };
}

export async function loadOrders(db: any, opts: { from: string; to: string; statuses?: string[] }): Promise<BoardOrder[]> {
  let q = db.from("orders").select(ORDER_SELECT).gte("delivery_date", opts.from).lte("delivery_date", opts.to).order("delivery_date");
  if (opts.statuses) q = q.in("status", opts.statuses);
  const { data, error } = await q;
  if (error) throw error;
  return (data as any[]).map(toBoardOrder).sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
}

// ───────────── Shopping batch ─────────────

export type BatchLine = {
  id: string;
  orderId: string;
  customer: string;
  firstName: string;
  phone: string | null;
  color: string;
  chain: "kroger" | "meijer";
  storeId: string | null;
  storeName: string;
  productId: string | null;
  name: string;
  freeText: boolean;
  imageUrl: string | null;
  upc: string | null;
  quantity: number;
  foundQuantity: number | null;
  priceCents: number | null;
  actualPriceCents: number | null;
  note: string | null;
  subChoice: string;
  approvedSubs: ApprovedSub[];
  status: "pending" | "found" | "substituted" | "out_of_stock";
  substituteName: string | null;
  shopperNote: string | null;
  scannedUpc: string | null;
  removed: boolean;
  addedByShopper: boolean;
  aisle: string | null;
  aisleSort: number | null;
  aisleBay: number | null;
  aisleDetail: string | null;
  aisleSource: "kroger" | "meijer" | "cody" | null;
};

export type BatchOrder = BoardOrder & {
  color: string; customerNotes: string | null; krogerStoreId: string | null; meijerStoreId: string | null;
  serviceFeeCents: number; secondStoreFeeCents: number; tipCents: number; authorizedCents: number;
  receiptKrogerCents: number | null; receiptMeijerCents: number | null; finalTotalCents: number | null; finalizedAt: string | null;
};

export async function loadBatch(db: any, batchId: string, colors: string[]) {
  const { data: batch } = await db.from("shopping_batches").select("*").eq("id", batchId).maybeSingle();
  if (!batch) return null;

  const { data: orders, error } = await db
    .from("orders")
    .select(ORDER_SELECT + ", customer_notes, kroger_store_id, meijer_store_id, authorized_amount_cents, receipt_kroger_cents, receipt_meijer_cents, final_total_cents, finalized_at, order_items(*, products(upc, image_url))")
    .eq("batch_id", batchId)
    .order("delivery_date");
  if (error) throw error;

  const batchOrders: BatchOrder[] = (orders as any[]).map((o, i) => ({
    ...toBoardOrder(o),
    color: colors[i % colors.length],
    customerNotes: o.customer_notes,
    krogerStoreId: o.kroger_store_id,
    meijerStoreId: o.meijer_store_id,
    serviceFeeCents: o.service_fee_cents,
    secondStoreFeeCents: o.second_store_fee_cents ?? 0,
    tipCents: o.tip_cents,
    authorizedCents: o.authorized_amount_cents,
    receiptKrogerCents: o.receipt_kroger_cents,
    receiptMeijerCents: o.receipt_meijer_cents,
    finalTotalCents: o.final_total_cents,
    finalizedAt: o.finalized_at,
  }));
  const storeName = new Map<string, string>();
  for (const o of orders as any[]) {
    if (o.kroger_store_id) storeName.set(o.kroger_store_id, (one(o.kroger) as any)?.name ?? "Kroger");
    if (o.meijer_store_id) storeName.set(o.meijer_store_id, (one(o.meijer) as any)?.name ?? "Meijer");
  }

  // Aisle locations for every (store, product) pair in this batch.
  const pairs: { storeId: string; productId: string }[] = [];
  for (const o of orders as any[]) for (const it of o.order_items ?? []) {
    const storeId = it.chain === "kroger" ? o.kroger_store_id : o.meijer_store_id;
    if (storeId && it.product_id) pairs.push({ storeId, productId: it.product_id });
  }
  const locs = new Map<string, { aisle: string; sort_key: number | null; bay: number | null; detail: string | null; source: "kroger" | "meijer" | "cody" }>();
  if (pairs.length) {
    const { data } = await db.from("product_locations").select("*")
      .in("store_id", [...new Set(pairs.map((p) => p.storeId))])
      .in("product_id", [...new Set(pairs.map((p) => p.productId))]);
    for (const l of data ?? []) locs.set(`${l.store_id}:${l.product_id}`, l);
  }

  const lines: BatchLine[] = [];
  (orders as any[]).forEach((o, idx) => {
    const bo = batchOrders[idx];
    for (const it of o.order_items ?? []) {
      const storeId = it.chain === "kroger" ? o.kroger_store_id : o.meijer_store_id;
      const loc = it.product_id && storeId ? locs.get(`${storeId}:${it.product_id}`) : undefined;
      const prod = one(it.products) as any;
      lines.push({
        id: it.id,
        orderId: o.id,
        customer: bo.customer,
        firstName: bo.customer.split(" ")[0],
        phone: bo.phone,
        color: bo.color,
        chain: it.chain,
        storeId,
        storeName: (storeId && storeName.get(storeId)) || (it.chain === "kroger" ? "Kroger" : "Meijer"),
        productId: it.product_id,
        name: it.name_snapshot,
        freeText: !it.product_id,
        imageUrl: prod?.image_url ?? null,
        upc: prod?.upc ?? null,
        quantity: Number(it.quantity),
        foundQuantity: it.found_quantity === null ? null : Number(it.found_quantity),
        priceCents: it.unit_price_cents_snapshot,
        actualPriceCents: it.actual_price_cents,
        note: it.item_note,
        subChoice: it.sub_choice ?? "codys_pick",
        approvedSubs: Array.isArray(it.approved_subs) ? it.approved_subs : [],
        status: it.status,
        substituteName: it.substitute_name,
        shopperNote: it.shopper_note,
        scannedUpc: it.scanned_upc,
        removed: it.removed,
        addedByShopper: it.added_by_shopper,
        aisle: loc?.aisle ?? it.shopper_aisle ?? null,
        aisleSort: loc?.sort_key ?? null,
        aisleBay: loc?.bay ?? null,
        aisleDetail: loc?.detail ?? null,
        aisleSource: loc?.source ?? (it.shopper_aisle ? "cody" : null),
      });
    }
  });

  return { batch, orders: batchOrders, lines };
}
