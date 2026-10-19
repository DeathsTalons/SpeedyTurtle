"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { money } from "@/lib/cart";
import { formatDate, clockLabel } from "@/lib/format";
import { STATUS } from "@/lib/order-status";
import type { BoardOrder } from "@/lib/admin-data";
import { addOrdersToBatch, retryHold, setOrderStatus, startBatch } from "./actions";
import { useRouter } from "next/navigation";

export function Board({ orders, today, openTrips }: { orders: BoardOrder[]; today: string; openTrips: { id: string; names: string }[] }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const groups = new Map<string, BoardOrder[]>();
  for (const o of orders) groups.set(o.date, [...(groups.get(o.date) ?? []), o]);

  return (
    <div className="space-y-6 pb-20">
      {orders.length === 0 && <p className="bg-card border border-line rounded-3xl p-8 text-center">No upcoming orders.</p>}
      {[...groups].map(([date, list]) => (
        <section key={date} className="space-y-2">
          <h2 className="text-xl font-extrabold">
            {date === today ? "Today" : formatDate(date, { weekday: "long", month: "short", day: "numeric" })}
            <span className="text-muted text-base font-normal"> · {list.length} {list.length === 1 ? "order" : "orders"}</span>
          </h2>
          <ul className="grid md:grid-cols-2 gap-2">
            {list.map((o) => {
              const s = STATUS[o.status];
              const canPick = o.status === "placed" || o.status === "shopping";
              return (
                <li key={o.id} className={`bg-card border-2 rounded-2xl p-3 flex gap-3 ${picked.has(o.id) ? "border-shell" : "border-line"}`}>
                  {canPick && (
                    <input type="checkbox" className="mt-1 w-6 h-6 accent-[var(--shell)]" checked={picked.has(o.id)} onChange={() => toggle(o.id)}
                      aria-label={`Pick ${o.customer}'s order`} />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <b className="text-lg">{o.customer}</b>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.tone}`}>{s.label}</span>
                    </div>
                    <p className="text-sm">{o.start ? `${clockLabel(o.start)}–${clockLabel(o.end)}` : <b className="text-danger">ASAP</b>} · {o.city ?? ""}</p>
                    {o.paymentStatus === "failed" && (
                      <p className="text-sm font-bold text-danger">
                        Card declined: {o.paymentError} <button className="underline" disabled={pending} onClick={() => start(async () => { await retryHold(o.id); router.refresh(); })}>Try again</button>
                      </p>
                    )}
                    {o.paymentStatus === "authorized" && <p className="text-sm text-shell font-bold">Card hold placed</p>}
                    {o.paymentStatus === "card_saved" && <p className="text-sm text-muted">Card saved, hold placed when you start shopping</p>}
                    <p className="text-sm text-muted">{o.itemCount} items · {o.stores.map((n) => n.replace(/ – /, " ")).join(" + ")} · {money(o.estimateCents)} est.</p>
                    <div className="flex gap-3 mt-2 text-sm font-bold flex-wrap">
                      {o.batchId && o.status === "shopping" && <Link href={`/admin/shop/${o.batchId}`} className="underline">Open shopping list</Link>}
                      {o.batchId && (o.status === "delivering" || o.status === "shopping") && <Link href={`/admin/shop/${o.batchId}/receipts`} className="underline">Receipt total</Link>}
                      {(o.status === "placed" || o.status === "shopping") && (
                        <button className="underline text-danger" disabled={pending}
                          onClick={() => { if (window.confirm(`Cancel ${o.customer}'s order? Any card hold is released.`)) start(() => setOrderStatus(o.id, "canceled")); }}>Cancel</button>
                      )}
                      {o.status === "delivering" && (
                        <button className="underline text-shell" disabled={pending} onClick={() => start(() => setOrderStatus(o.id, "delivered"))}>Mark delivered</button>
                      )}
                      {o.phone && <a className="underline" href={`sms:${o.phone}`}>Text</a>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {picked.size > 0 && (
        <div className="fixed bottom-4 inset-x-4 z-30 flex flex-wrap justify-center gap-2">
          {openTrips.map((t) => (
            <button key={t.id} className="btn btn-primary shadow-lg !px-6" disabled={pending}
              onClick={() => start(async () => { await addOrdersToBatch(t.id, [...picked]); router.push(`/admin/shop/${t.id}`); })}>
              Add {picked.size} to trip with {t.names}
            </button>
          ))}
          <button className={`btn shadow-lg !px-6 ${openTrips.length ? "btn-ghost" : "btn-primary text-lg !px-8"}`} disabled={pending}
            onClick={() => start(() => startBatch([...picked]))}>
            {pending ? "Starting…" : `${openTrips.length ? "Start new trip" : "Shop"} with ${picked.size} ${picked.size === 1 ? "order" : "orders"}`}
          </button>
        </div>
      )}
    </div>
  );
}
