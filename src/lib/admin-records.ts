// Everything Cody's "see it all" admin pages read: customers, their history, every order.
// Server only, always with the master database client from requireAdmin().
import "server-only";
/* eslint-disable @typescript-eslint/no-explicit-any */

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

/** Money for one order, as Cody thinks about it. */
export function orderMoney(o: any) {
  const fees = (o.service_fee_cents ?? 0) + (o.second_store_fee_cents ?? 0);
  const tips = (o.tip_cents ?? 0) + (o.later_tip_cents ?? 0);
  const groceries = o.final_subtotal_cents ?? o.estimated_subtotal_cents ?? 0;
  const final = o.final_total_cents != null;
  const total = (o.final_total_cents ?? groceries + fees + (o.tip_cents ?? 0)) + (o.later_tip_cents ?? 0) - (o.item_refunds_cents ?? 0);
  // Only finished, non-canceled orders count toward what Cody actually made.
  const counts = final && o.status !== "canceled";
  return { fees, tips, groceries, total, final, earned: counts ? fees + tips : 0, spent: counts ? total : 0 };
}

/** Sign-in emails and last sign-in, from Supabase Auth (profiles don't store email). */
export async function authUsers(db: any): Promise<Map<string, { email: string | null; lastSignIn: string | null; createdAt: string | null }>> {
  const out = new Map<string, { email: string | null; lastSignIn: string | null; createdAt: string | null }>();
  for (let page = 1; page < 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) break;
    for (const u of data.users) out.set(u.id, { email: u.email ?? null, lastSignIn: u.last_sign_in_at ?? null, createdAt: u.created_at ?? null });
    if (data.users.length < 1000) break;
  }
  return out;
}

const SUMMARY_COLS =
  "*, slot_templates(start_time, end_time)," +
  " kroger:stores!orders_kroger_store_id_fkey(name), meijer:stores!orders_meijer_store_id_fkey(name)";

export type OrderRow = {
  id: string; customerId: string; customer: string; status: string; date: string; start: string | null; end: string | null; asap: boolean;
  createdAt: string; items: number; paymentStatus: string; stores: string[];
  money: ReturnType<typeof orderMoney>;
};

function toRow(o: any, names: Map<string, string>): OrderRow {
  const slot = one(o.slot_templates) as any;
  return {
    id: o.id, customerId: o.customer_id, customer: names.get(o.customer_id) ?? "Customer", status: o.status,
    date: o.delivery_date, start: slot?.start_time ?? null, end: slot?.end_time ?? null, asap: !!o.asap,
    createdAt: o.created_at, items: o.unique_item_count, paymentStatus: o.payment_status ?? "none",
    stores: [(one(o.kroger) as any)?.name, (one(o.meijer) as any)?.name].filter(Boolean),
    money: orderMoney(o),
  };
}

async function customerNames(db: any): Promise<Map<string, string>> {
  const { data } = await db.from("profiles").select("id, full_name");
  return new Map((data ?? []).map((p: any) => [p.id, p.full_name || "Customer"]));
}

// ───────────── Customers ─────────────

export type CustomerRow = {
  id: string; name: string; phone: string | null; email: string | null; role: string; joined: string | null; lastSignIn: string | null;
  hasCard: boolean; orders: number; activeOrders: number; spentCents: number; tipsCents: number; lastOrder: string | null; city: string | null;
};

export async function listCustomers(db: any, q = ""): Promise<CustomerRow[]> {
  const [{ data: profiles, error }, { data: orders }, { data: addresses }, users] = await Promise.all([
    db.from("profiles").select("id, full_name, phone, role, created_at, stripe_customer_id"),
    db.from("orders").select("*"),
    db.from("addresses").select("user_id, city, is_default"),
    authUsers(db),
  ]);
  if (error) throw error;
  const byCustomer = new Map<string, any[]>();
  for (const o of orders ?? []) byCustomer.set(o.customer_id, [...(byCustomer.get(o.customer_id) ?? []), o]);
  const cityOf = new Map<string, string>();
  for (const a of addresses ?? []) if (a.is_default || !cityOf.has(a.user_id)) cityOf.set(a.user_id, a.city);

  const needle = q.trim().toLowerCase();
  return (profiles ?? [])
    .map((p: any): CustomerRow => {
      const list = byCustomer.get(p.id) ?? [];
      const u = users.get(p.id);
      const money = list.map(orderMoney);
      return {
        id: p.id, name: p.full_name || "(no name)", phone: p.phone, email: u?.email ?? null, role: p.role,
        joined: u?.createdAt ?? p.created_at, lastSignIn: u?.lastSignIn ?? null, hasCard: !!p.stripe_customer_id,
        orders: list.filter((o) => o.status !== "canceled").length,
        activeOrders: list.filter((o) => ["placed", "shopping", "delivering"].includes(o.status)).length,
        spentCents: money.reduce((s, m) => s + m.spent, 0),
        tipsCents: list.reduce((s, o, i) => s + (money[i].final && o.status !== "canceled" ? money[i].tips : 0), 0),
        lastOrder: list.map((o) => o.delivery_date).sort().at(-1) ?? null,
        city: cityOf.get(p.id) ?? null,
      };
    })
    .filter((c: CustomerRow) => !needle || [c.name, c.email, c.phone, c.city].some((v) => v?.toLowerCase().includes(needle)))
    .sort((a: CustomerRow, b: CustomerRow) => (b.lastOrder ?? "").localeCompare(a.lastOrder ?? "") || (b.joined ?? "").localeCompare(a.joined ?? ""));
}

export async function customerDetail(db: any, id: string) {
  const [{ data: p }, { data: addresses }, { data: orders }, users] = await Promise.all([
    db.from("profiles").select("*").eq("id", id).maybeSingle(),
    db.from("addresses").select("*").eq("user_id", id).order("created_at"),
    db.from("orders").select(SUMMARY_COLS).eq("customer_id", id).order("delivery_date", { ascending: false }),
    authUsers(db),
  ]);
  if (!p) return null;
  const names = new Map([[p.id, p.full_name || "Customer"]]);
  const rows: OrderRow[] = (orders ?? []).map((o: any) => toRow(o, names));
  return { profile: p, auth: users.get(id) ?? null, addresses: addresses ?? [], orders: rows };
}

// ───────────── Orders ─────────────

export type OrderFilters = { status?: string; q?: string; from?: string; to?: string };

export async function listAllOrders(db: any, f: OrderFilters): Promise<OrderRow[]> {
  let query = db.from("orders").select(SUMMARY_COLS).order("delivery_date", { ascending: false }).order("created_at", { ascending: false }).limit(2000);
  if (f.status) query = query.eq("status", f.status);
  if (f.from) query = query.gte("delivery_date", f.from);
  if (f.to) query = query.lte("delivery_date", f.to);
  const [{ data, error }, names] = await Promise.all([query, customerNames(db)]);
  if (error) throw error;
  const needle = f.q?.trim().toLowerCase() ?? "";
  return (data ?? []).map((o: any) => toRow(o, names)).filter((r: OrderRow) => !needle || r.customer.toLowerCase().includes(needle) || r.id.startsWith(needle));
}

export async function orderDetail(db: any, id: string) {
  const { data: o } = await db.from("orders")
    .select("*, profiles(id, full_name, phone, stripe_customer_id), addresses(*), slot_templates(label, start_time, end_time)," +
      " kroger:stores!orders_kroger_store_id_fkey(name, address), meijer:stores!orders_meijer_store_id_fkey(name, address), order_items(*)")
    .eq("id", id).maybeSingle();
  if (!o) return null;
  const users = await authUsers(db);
  return {
    o,
    customer: one(o.profiles) as any,
    email: users.get(o.customer_id)?.email ?? null,
    address: one(o.addresses) as any,
    slot: one(o.slot_templates) as any,
    kroger: one(o.kroger) as any,
    meijer: one(o.meijer) as any,
    items: ((o.order_items ?? []) as any[]).sort((a, b) => a.chain.localeCompare(b.chain) || a.name_snapshot.localeCompare(b.name_snapshot)),
    money: orderMoney(o),
  };
}

/** Totals for a set of orders: what came in, what Cody kept. */
export function totals(rows: OrderRow[]) {
  const done = rows.filter((r) => r.money.final && r.status !== "canceled");
  return {
    orders: rows.filter((r) => r.status !== "canceled").length,
    completed: done.length,
    collectedCents: done.reduce((s, r) => s + r.money.total, 0),
    earnedCents: done.reduce((s, r) => s + r.money.earned, 0),
    tipsCents: done.reduce((s, r) => s + r.money.tips, 0),
  };
}
