import { requireAdmin } from "@/lib/admin";
import { loadOrders } from "@/lib/admin-data";
import { addDays, localDate } from "@/lib/schedule";
import { Board } from "./board";
import { AvailabilityToggle } from "./availability";
import { getAvailability } from "@/lib/data";

export default async function AdminHome() {
  const { db } = await requireAdmin();
  const today = localDate(new Date());
  const orders = await loadOrders(db, { from: addDays(today, -7), to: addDays(today, 60), statuses: ["placed", "shopping", "delivering"] });
  // Trips in progress, so picked orders can join one instead of starting another.
  const openTrips = [...new Map(orders.filter((o) => o.status === "shopping" && o.batchId).map((o) => [o.batchId!, [] as string[]])).keys()].map((id) => ({
    id,
    names: orders.filter((o) => o.batchId === id).map((o) => o.customer.split(" ")[0]).join(", "),
  }));
  return (
    <>
      <AvailabilityToggle a={await getAvailability()} />
      <h1 className="text-3xl font-extrabold mb-1">Orders</h1>
      <p className="text-muted mb-5">Check the orders you want to shop together, then tap Shop.</p>
      <Board orders={orders} today={today} openTrips={openTrips} />
    </>
  );
}
