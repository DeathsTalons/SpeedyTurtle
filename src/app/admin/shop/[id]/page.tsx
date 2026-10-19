import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { loadBatch, loadOrders } from "@/lib/admin-data";
import { CUSTOMER_COLORS } from "@/lib/shopping";
import { addDays, localDate } from "@/lib/schedule";
import { formatDate, clockLabel } from "@/lib/format";
import { ShoppingList } from "./shopping-list";
import { AddOrders } from "./add-orders";

export default async function BatchPage({ params }: PageProps<"/admin/shop/[id]">) {
  const { id } = await params;
  const { db } = await requireAdmin();
  const data = await loadBatch(db, id, CUSTOMER_COLORS);
  if (!data) notFound();
  const today = localDate(new Date());
  const waiting = (await loadOrders(db, { from: addDays(today, -7), to: addDays(today, 60), statuses: ["placed", "shopping"] }))
    .filter((o) => o.batchId !== id)
    .map((o) => ({ id: o.id, label: `${o.customer} · ${formatDate(o.date)} ${clockLabel(o.start)}${o.status === "shopping" ? " (in another trip)" : ""}` }));

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-extrabold mr-auto">Shopping</h1>
        <Link href="/admin" className="underline font-bold">All orders</Link>
      </div>
      {data.batch.finished_at && <p className="bg-amber-soft rounded-2xl p-3">This trip is finished. Changes still save.</p>}
      <AddOrders batchId={id} options={waiting} />
      {data.orders.length === 0 ? (
        <p className="bg-card border border-line rounded-3xl p-6">No orders in this trip. <Link href="/admin" className="underline font-bold">Pick some orders</Link></p>
      ) : (
        <ShoppingList key={data.lines.length} batchId={id} orders={data.orders} initialLines={data.lines} />
      )}
    </div>
  );
}
