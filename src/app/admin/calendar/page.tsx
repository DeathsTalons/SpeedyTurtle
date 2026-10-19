import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { addDays, isSlotOpen, localDate, weekdayOf, type Override } from "@/lib/schedule";
import { loadOrders } from "@/lib/admin-data";
import { Calendar } from "./calendar";

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function CalendarPage({ searchParams }: PageProps<"/admin/calendar">) {
  const { db } = await requireAdmin();
  const { from: fromParam } = await searchParams;
  const today = localDate(new Date());
  const from = typeof fromParam === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fromParam) ? fromParam : today;
  const to = addDays(from, 6);

  const [{ data: templates }, { data: weekly }, { data: overrides }, orders] = await Promise.all([
    db.from("slot_templates").select("*").eq("active", true).order("sort_order"),
    db.from("weekly_schedule").select("*"),
    db.from("schedule_overrides").select("*").gte("date", from).lte("date", to),
    loadOrders(db, { from, to, statuses: ["placed", "shopping", "delivering", "delivered"] }),
  ]);
  const weeklyMap: Record<number, boolean> = Object.fromEntries((weekly ?? []).map((w: any) => [w.weekday, w.is_open]));
  const ov: Override[] = (overrides ?? []).map((o: any) => ({ date: o.date, slotTemplateId: o.slot_template_id, isOpen: o.is_open, note: o.note }));
  const slots = (templates ?? []).map((t: any) => ({ id: t.id, label: t.label, start: t.start_time, end: t.end_time, capacity: t.capacity }));

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(from, i);
    const dayOv = ov.find((o) => o.date === date && o.slotTemplateId === null);
    return {
      date,
      weekday: weekdayOf(date),
      note: dayOv?.note ?? null,
      dayOverride: dayOv ? dayOv.isOpen : null,
      cells: slots.map((s: any) => ({
        slotId: s.id,
        open: isSlotOpen(date, s.id, { weekly: weeklyMap, overrides: ov }),
        source: ov.some((o) => o.date === date && o.slotTemplateId === s.id) ? "slot override" : dayOv ? "day override" : "default week",
        orders: orders.filter((o) => o.date === date && o.slotTemplateId === s.id).map((o) => ({ id: o.id, customer: o.customer, status: o.status })),
      })),
    };
  });
  // Orders sitting in an old/retired window still need to show somewhere.
  const stray = orders.filter((o) => o.slotTemplateId !== null && !slots.some((s: any) => s.id === o.slotTemplateId));
  const asap = orders.filter((o) => o.slotTemplateId === null);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h1 className="text-3xl font-extrabold mr-auto">Calendar</h1>
        <Link className="btn btn-ghost" href={`/admin/calendar?from=${addDays(from, -7)}`}>Previous week</Link>
        {from !== today && <Link className="btn btn-ghost" href="/admin/calendar">This week</Link>}
        <Link className="btn btn-ghost" href={`/admin/calendar?from=${addDays(from, 7)}`}>Next week</Link>
      </div>
      {stray.length > 0 && (
        <p className="bg-amber-soft rounded-2xl p-3 mb-4">
          {stray.length} {stray.length === 1 ? "order is" : "orders are"} in an old window ({stray.map((o) => o.customer).join(", ")}). Open them from Orders to check.
        </p>
      )}
      {asap.length > 0 && (
        <p className="bg-card border border-line rounded-2xl p-3 mb-4">ASAP orders this week: {asap.map((o) => `${o.customer} (${o.date.slice(5)})`).join(", ")}</p>
      )}
      <Calendar days={days} slots={slots} weekly={weeklyMap} today={today} />
    </>
  );
}
