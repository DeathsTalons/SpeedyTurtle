import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { listAllOrders, totals } from "@/lib/admin-records";
import { money } from "@/lib/money";
import { addDays, localDate } from "@/lib/schedule";
import { STATUS } from "@/lib/order-status";
import { OrderTable, Stat } from "../records-ui";

export const metadata = { title: "All orders · Admin" };

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

export default async function AllOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  const { db } = await requireAdmin();
  const sp = await searchParams;
  const today = localDate(new Date());
  const status = STATUS[str(sp.status)] ? str(sp.status) : "";
  const from = isDate(str(sp.from)) ? str(sp.from) : "";
  const to = isDate(str(sp.to)) ? str(sp.to) : "";
  const q = str(sp.q);
  const rows = await listAllOrders(db, { status, from, to, q });
  const t = totals(rows);
  const filtered = !!(status || from || to || q);

  const quick = [
    { label: "This week", from: addDays(today, -6), to: today },
    { label: "Last 30 days", from: addDays(today, -29), to: today },
    { label: "This year", from: `${today.slice(0, 4)}-01-01`, to: today },
  ];

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-extrabold">All orders</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label="Orders" value={String(t.orders)} hint={`${t.completed} finished`} />
        <Stat label="Collected" value={money(t.collectedCents)} hint="Groceries + fees + tips" />
        <Stat label="You made" value={money(t.earnedCents)} hint="Service fees + tips" />
        <Stat label="Tips" value={money(t.tipsCents)} />
      </div>

      <form className="bg-card border border-line rounded-3xl p-4 flex flex-wrap items-end gap-3" role="search">
        <div className="min-w-40 flex-1">
          <label htmlFor="q" className="label">Customer</label>
          <input id="q" name="q" defaultValue={q} className="field" placeholder="Name" />
        </div>
        <div>
          <label htmlFor="status" className="label">Status</label>
          <select id="status" name="status" defaultValue={status} className="field">
            <option value="">Any</option>
            {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="from" className="label">From</label>
          <input id="from" name="from" type="date" defaultValue={from} className="field" />
        </div>
        <div>
          <label htmlFor="to" className="label">To</label>
          <input id="to" name="to" type="date" defaultValue={to} className="field" />
        </div>
        <button className="btn btn-primary">Filter</button>
        {filtered && <Link href="/admin/orders" className="btn btn-ghost">Clear</Link>}
      </form>

      <div className="flex flex-wrap gap-2 text-sm font-bold">
        {quick.map((r) => (
          <Link key={r.label} href={`/admin/orders?from=${r.from}&to=${r.to}`}
            className={`px-3 py-1.5 rounded-full border ${from === r.from && to === r.to ? "bg-shell text-white border-shell" : "border-line bg-card"}`}>
            {r.label}
          </Link>
        ))}
      </div>

      <OrderTable rows={rows} />
      {rows.length >= 2000 && <p className="text-sm text-muted">Showing the newest 2,000. Narrow the dates to see older ones.</p>}
    </div>
  );
}
