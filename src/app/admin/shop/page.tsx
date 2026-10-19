import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function ShopTrips() {
  const { db } = await requireAdmin();
  const { data: open } = await db.from("shopping_batches").select("id, created_at, orders(id, profiles(full_name))").is("finished_at", null).order("created_at", { ascending: false });
  const trips = (open ?? []).filter((b: any) => (b.orders ?? []).length > 0);
  if (trips.length === 1) redirect(`/admin/shop/${trips[0].id}`);
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="text-3xl font-extrabold">Shopping</h1>
      {trips.length === 0 ? (
        <p className="bg-card border border-line rounded-3xl p-6">No trip in progress. <Link href="/admin" className="underline font-bold">Pick orders to shop</Link></p>
      ) : (
        <ul className="space-y-2">
          {trips.map((b: any) => (
            <li key={b.id}>
              <Link href={`/admin/shop/${b.id}`} className="block bg-card border border-line rounded-2xl p-4 hover:border-shell">
                <b>{b.orders.map((o: any) => (Array.isArray(o.profiles) ? o.profiles[0] : o.profiles)?.full_name ?? "Customer").join(", ")}</b>
                <span className="block text-sm text-muted">Started {new Date(b.created_at).toLocaleString("en-US", { timeZone: "America/Indiana/Indianapolis", weekday: "short", hour: "numeric", minute: "2-digit" })}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
