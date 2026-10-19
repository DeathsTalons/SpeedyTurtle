import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { money } from "@/lib/money";
import { formatDate, clockLabel } from "@/lib/format";
import { STATUS } from "@/lib/order-status";

export const metadata = { title: "Orders · Speedy Turtle" };

export default async function OrdersPage() {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login?next=/orders");
  const { data: orders } = await db
    .from("orders")
    .select("id, delivery_date, status, unique_item_count, estimated_subtotal_cents, service_fee_cents, second_store_fee_cents, tip_cents, final_total_cents, slot_templates(start_time, end_time)")
    .eq("customer_id", user.id)
    .order("delivery_date", { ascending: false })
    .limit(50);

  return (
    <>
      <h1 className="text-3xl font-extrabold mb-5">Orders</h1>
      {!orders?.length ? (
        <div className="bg-card border border-line rounded-3xl p-8 text-center space-y-4">
          <p>No orders yet.</p>
          <Link href="/shop" className="btn btn-primary">Start shopping</Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => {
            const slot = Array.isArray(o.slot_templates) ? o.slot_templates[0] : o.slot_templates;
            const s = STATUS[o.status];
            return (
              <li key={o.id}>
                <Link href={`/orders/${o.id}`} className="flex items-center gap-4 bg-card border border-line rounded-2xl p-4 hover:border-shell">
                  <div className="flex-1">
                    <p className="font-bold">{formatDate(o.delivery_date, { weekday: "long", month: "short", day: "numeric" })}{slot ? `, ${clockLabel(slot.start_time)}–${clockLabel(slot.end_time)}` : ", ASAP"}</p>
                    <p className="text-muted text-sm">{o.unique_item_count} items · {money(o.final_total_cents ?? o.estimated_subtotal_cents + o.service_fee_cents + (o.second_store_fee_cents ?? 0) + o.tip_cents)}{o.final_total_cents == null ? " est." : ""}</p>
                  </div>
                  <span className={`text-sm font-bold px-3 py-1 rounded-full ${s.tone}`}>{s.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
