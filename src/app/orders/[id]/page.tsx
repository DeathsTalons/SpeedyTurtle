import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { money } from "@/lib/money";
import { formatDate, clockLabel } from "@/lib/format";
import { STATUS } from "@/lib/order-status";
import { subLabel } from "@/lib/shopping";

export const metadata = { title: "Order · Speedy Turtle" };

const ITEM_STATUS: Record<string, string> = { pending: "", found: "Found", substituted: "Swapped", out_of_stock: "Out of stock" };

export default async function OrderPage({ params, searchParams }: PageProps<"/orders/[id]">) {
  const { id } = await params;
  const { placed } = await searchParams;
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect(`/login?next=/orders/${id}`);

  const { data: o } = await db
    .from("orders")
    .select("*, slot_templates(start_time, end_time), addresses(line1, line2, city, zip), kroger:stores!orders_kroger_store_id_fkey(name), meijer:stores!orders_meijer_store_id_fkey(name), order_items(*)")
    .eq("id", id)
    .maybeSingle();
  if (!o) notFound();

  const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? v[0] : v);
  const slot = one(o.slot_templates);
  const addr = one(o.addresses);
  const kroger = one(o.kroger);
  const meijer = one(o.meijer);
  type Item = { id: string; chain: string; quantity: number; name_snapshot: string; item_note: string | null; substitute_name: string | null; status: string; unit_price_cents_snapshot: number | null; sub_choice: string; removed: boolean; approved_subs: { name: string }[] | null };
  const items: Item[] = (o.order_items ?? []).filter((i: Item) => !i.removed);
  const s = STATUS[o.status];

  return (
    <div className="space-y-6">
      {placed && (
        <div role="status" className="bg-shell text-white rounded-3xl p-5">
          <p className="font-display text-2xl font-extrabold">Order placed</p>
          <p>Cody will shop it {formatDate(o.delivery_date, { weekday: "long" })}. You&apos;ll get a text if anything needs your OK.</p>
        </div>
      )}

      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h1 className="text-3xl font-extrabold">{formatDate(o.delivery_date, { weekday: "long", month: "long", day: "numeric" })}</h1>
          {slot ? <p className="text-lg">{clockLabel(slot.start_time)}–{clockLabel(slot.end_time)}</p> : o.asap ? <p className="text-lg font-bold">ASAP, same day</p> : null}
          {addr && <p className="text-muted">{addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}, {addr.city}</p>}
        </div>
        <span className={`text-sm font-bold px-3 py-1 rounded-full ${s.tone}`}>{s.label}</span>
      </div>

      {(["kroger", "meijer"] as const).map((chain) => {
        const list = items.filter((i) => i.chain === chain);
        if (!list.length) return null;
        const store = chain === "kroger" ? kroger : meijer;
        return (
          <section key={chain} className="bg-card border border-line rounded-3xl p-4">
            <h2 className={`text-xl font-extrabold tag-${chain}`}>{store?.name ?? chain}</h2>
            <ul className="divide-y divide-line mt-2">
              {list.map((i) => (
                <li key={i.id} className="py-2.5 flex gap-3">
                  <span className="font-bold w-8 shrink-0">{Number(i.quantity)}×</span>
                  <span className="flex-1">
                    {i.name_snapshot}
                    <span className="block text-sm text-muted">If out: {subLabel(i.sub_choice)}{i.approved_subs?.length ? ` (${i.approved_subs.map((x) => x.name).join(", ")})` : ""}{i.item_note ? ` · “${i.item_note}”` : ""}</span>
                    {i.substitute_name && <span className="block text-sm">Swapped for {i.substitute_name}</span>}
                  </span>
                  <span className="text-sm text-right">
                    {ITEM_STATUS[i.status] && <span className="block font-bold">{ITEM_STATUS[i.status]}</span>}
                    {i.unit_price_cents_snapshot != null ? money(i.unit_price_cents_snapshot * Number(i.quantity)) : "At shelf price"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <section className="bg-card border border-line rounded-3xl p-5 space-y-2">
        <div className="flex justify-between"><span>Groceries {o.final_subtotal_cents == null && "(estimate)"}</span><span>{money(o.final_subtotal_cents ?? o.estimated_subtotal_cents)}</span></div>
        <div className="flex justify-between"><span>Service fee · {o.unique_item_count} items</span><span>{money(o.service_fee_cents)}</span></div>
        {o.second_store_fee_cents > 0 && <div className="flex justify-between"><span>Second store</span><span>{money(o.second_store_fee_cents)}</span></div>}
        {o.tip_cents > 0 && <div className="flex justify-between"><span>Tip</span><span>{money(o.tip_cents)}</span></div>}
        <div className="flex justify-between text-lg font-bold border-t border-line pt-2">
          <span>{o.final_total_cents == null ? "Estimated total" : "Total charged"}</span>
          <span>{money(o.final_total_cents ?? o.estimated_subtotal_cents + o.service_fee_cents + (o.second_store_fee_cents ?? 0) + o.tip_cents)}</span>
        </div>
        <p className="text-sm text-muted">
          {o.payment_status === "captured" ? `Charged ${money((o.captured_cents ?? 0) - (o.refunded_cents ?? 0))} to your card.`
            : o.payment_status === "authorized" ? `Hold of ${money(o.authorized_amount_cents)} on your card. You're charged the receipt total after shopping, and the rest is released.`
            : o.payment_status === "card_saved" ? `Card saved. A hold of about ${money(o.authorized_amount_cents)} is placed on shopping day.`
            : o.payment_status === "failed" ? "Your card couldn't be held. Cody will text you."
            : o.final_total_cents == null ? `Estimated hold: ${money(o.authorized_amount_cents)}. Final charge is the receipt total.` : null}
        </p>
      </section>

      <Link href="/orders" className="btn btn-ghost">All orders</Link>
    </div>
  );
}
