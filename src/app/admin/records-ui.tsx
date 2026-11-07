// Small building blocks shared by the admin customer and order pages.
import Link from "next/link";
import { money } from "@/lib/money";
import { formatDate, clockLabel } from "@/lib/format";
import { STATUS, PAYMENT } from "@/lib/order-status";
import type { OrderRow } from "@/lib/admin-records";

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-card border border-line rounded-2xl p-4">
      <p className="text-sm text-muted font-bold">{label}</p>
      <p className="font-display text-2xl font-extrabold">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, tone: "bg-line" };
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${s.tone}`}>{s.label}</span>;
}

export const when = (r: Pick<OrderRow, "date" | "start" | "end" | "asap">) =>
  `${formatDate(r.date, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}${r.start ? ` · ${clockLabel(r.start)}–${clockLabel(r.end)}` : r.asap ? " · ASAP" : ""}`;

/** Order history list: a table on wide screens, stacked cards on a phone. */
export function OrderTable({ rows, showCustomer = true }: { rows: OrderRow[]; showCustomer?: boolean }) {
  if (!rows.length) return <p className="bg-card border border-line rounded-3xl p-8 text-center">No orders match.</p>;
  return (
    <>
      <table className="hidden md:table w-full bg-card border border-line rounded-2xl overflow-hidden text-sm">
        <thead className="bg-paper text-left text-muted">
          <tr>
            <th className="p-3">Delivery</th>
            {showCustomer && <th className="p-3">Customer</th>}
            <th className="p-3">Status</th>
            <th className="p-3">Card</th>
            <th className="p-3 text-right">Items</th>
            <th className="p-3 text-right">Total</th>
            <th className="p-3 text-right">You made</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-paper/60">
              <td className="p-3"><Link href={`/admin/orders/${r.id}`} className="font-bold underline">{when(r)}</Link>
                <span className="block text-xs text-muted">{r.stores.join(" + ")}</span></td>
              {showCustomer && <td className="p-3"><Link href={`/admin/customers/${r.customerId}`} className="underline">{r.customer}</Link></td>}
              <td className="p-3"><StatusPill status={r.status} /></td>
              <td className={`p-3 font-bold ${PAYMENT[r.paymentStatus]?.tone ?? ""}`}>{PAYMENT[r.paymentStatus]?.label ?? r.paymentStatus}</td>
              <td className="p-3 text-right">{r.items}</td>
              <td className="p-3 text-right">{money(r.money.total)}{!r.money.final && r.status !== "canceled" && <span className="text-muted"> est.</span>}</td>
              <td className="p-3 text-right font-bold">{r.money.final && r.status !== "canceled" ? money(r.money.earned) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="md:hidden space-y-2">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/admin/orders/${r.id}`} className="block bg-card border border-line rounded-2xl p-3 hover:border-shell">
              <div className="flex items-center gap-2 flex-wrap">
                <b>{showCustomer ? r.customer : when(r)}</b>
                <StatusPill status={r.status} />
              </div>
              {showCustomer && <p className="text-sm">{when(r)}</p>}
              <p className="text-sm text-muted">
                {r.items} items · {money(r.money.total)}{!r.money.final && r.status !== "canceled" ? " est." : ""}
                {r.money.final && r.status !== "canceled" ? ` · you made ${money(r.money.earned)}` : ""}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
