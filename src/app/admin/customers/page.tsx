import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { listCustomers } from "@/lib/admin-records";
import { money } from "@/lib/money";
import { formatDate, formatDay } from "@/lib/format";
import { Stat } from "../records-ui";

export const metadata = { title: "Customers · Admin" };

export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  const { db } = await requireAdmin();
  const { q } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const all = await listCustomers(db, query);
  const customers = all.filter((c) => c.role !== "admin");
  const ordered = customers.filter((c) => c.orders > 0);

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-extrabold">Customers</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label="Accounts" value={String(customers.length)} />
        <Stat label="Have ordered" value={String(ordered.length)} />
        <Stat label="Repeat customers" value={String(customers.filter((c) => c.orders > 1).length)} />
        <Stat label="Total spent" value={money(customers.reduce((s, c) => s + c.spentCents, 0))} hint="Finished orders, incl. groceries" />
      </div>

      <form className="flex gap-2" role="search">
        <label htmlFor="q" className="sr-only">Search customers</label>
        <input id="q" name="q" defaultValue={query} className="field max-w-md" placeholder="Name, email, phone or city" />
        <button className="btn btn-primary">Search</button>
        {query && <Link href="/admin/customers" className="btn btn-ghost">Clear</Link>}
      </form>

      {customers.length === 0 ? (
        <p className="bg-card border border-line rounded-3xl p-8 text-center">{query ? "No customers match." : "No customer accounts yet."}</p>
      ) : (
        <>
          <table className="hidden md:table w-full bg-card border border-line rounded-2xl overflow-hidden text-sm">
            <thead className="bg-paper text-left text-muted">
              <tr>
                <th className="p-3">Customer</th>
                <th className="p-3">Contact</th>
                <th className="p-3">Joined</th>
                <th className="p-3 text-right">Orders</th>
                <th className="p-3 text-right">Spent</th>
                <th className="p-3">Last delivery</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-paper/60">
                  <td className="p-3">
                    <Link href={`/admin/customers/${c.id}`} className="font-bold underline">{c.name}</Link>
                    <span className="block text-xs text-muted">{c.city ?? "No address yet"}{c.activeOrders ? ` · ${c.activeOrders} upcoming` : ""}</span>
                  </td>
                  <td className="p-3">
                    {c.phone ? <a href={`sms:${c.phone}`} className="underline">{c.phone}</a> : <span className="text-muted">No phone</span>}
                    <span className="block text-xs text-muted">{c.email ?? ""}</span>
                  </td>
                  <td className="p-3">{formatDay(c.joined)}</td>
                  <td className="p-3 text-right">{c.orders}</td>
                  <td className="p-3 text-right font-bold">{money(c.spentCents)}</td>
                  <td className="p-3">{c.lastOrder ? formatDate(c.lastOrder, { month: "short", day: "numeric", year: "numeric" }) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <ul className="md:hidden space-y-2">
            {customers.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/customers/${c.id}`} className="block bg-card border border-line rounded-2xl p-3 hover:border-shell">
                  <b>{c.name}</b>
                  <p className="text-sm">{c.phone ?? c.email ?? ""}</p>
                  <p className="text-sm text-muted">{c.orders} {c.orders === 1 ? "order" : "orders"} · {money(c.spentCents)}{c.city ? ` · ${c.city}` : ""}</p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
