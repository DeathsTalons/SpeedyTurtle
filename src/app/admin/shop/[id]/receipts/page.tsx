import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { loadBatch } from "@/lib/admin-data";
import { CUSTOMER_COLORS, suggestedSubtotal } from "@/lib/shopping";
import { Receipts } from "./receipts";

export default async function ReceiptsPage({ params }: PageProps<"/admin/shop/[id]/receipts">) {
  const { id } = await params;
  const { db } = await requireAdmin();
  const data = await loadBatch(db, id, CUSTOMER_COLORS);
  if (!data) notFound();
  const suggest = Object.fromEntries(data.orders.map((o) => {
    const mine = data.lines.filter((l) => l.orderId === o.id);
    return [o.id, {
      kroger: o.krogerStoreId ? suggestedSubtotal(mine.filter((l) => l.chain === "kroger")) : null,
      meijer: o.meijerStoreId ? suggestedSubtotal(mine.filter((l) => l.chain === "meijer")) : null,
    }];
  }));
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-extrabold mr-auto">Receipt totals</h1>
        <Link href={`/admin/shop/${id}`} className="underline font-bold">Back to list</Link>
      </div>
      <p className="text-muted">Enter what each store&apos;s receipt came to for each customer. The app adds your fees and tip.</p>
      <Receipts orders={data.orders} suggest={suggest} />
    </div>
  );
}
