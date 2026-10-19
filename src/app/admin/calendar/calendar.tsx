"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDate, clockLabel } from "@/lib/format";
import { moveOrder, resetDay, setDayOpen, setSlotOpen, setWeekdayDefault } from "../actions";

type Slot = { id: number; label: string; start: string; end: string; capacity: number };
type Cell = { slotId: number; open: boolean; source: string; orders: { id: string; customer: string; status: string }[] };
type Day = { date: string; weekday: number; note: string | null; dayOverride: boolean | null; cells: Cell[] };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function Calendar({ days, slots, weekly, today }: { days: Day[]; slots: Slot[]; weekly: Record<number, boolean>; today: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [moving, setMoving] = useState<{ id: string; customer: string } | null>(null);
  const [error, setError] = useState("");
  const run = (fn: () => Promise<void>) => start(async () => {
    setError("");
    try { await fn(); router.refresh(); } catch (e) { setError((e as Error).message); }
  });

  const blockDay = (date: string) => {
    const note = window.prompt("Block this day. Reason (optional, only you see it):", "Traveling") ?? undefined;
    if (note === undefined) return;
    run(() => setDayOpen(date, false, note));
  };

  return (
    <div className="space-y-5">
      <section className="bg-card border border-line rounded-3xl p-4">
        <h2 className="font-extrabold mb-2">Default week</h2>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((w, i) => (
            <button key={w} disabled={pending} onClick={() => run(() => setWeekdayDefault(i, !weekly[i]))} aria-pressed={!!weekly[i]}
              className={`rounded-full px-4 py-2 font-bold border-2 ${weekly[i] ? "bg-shell text-white border-shell" : "bg-paper border-line text-muted line-through"}`}>
              {w}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted mt-2">Days you normally work. Changes below override this for specific dates.</p>
      </section>

      {moving && (
        <div className="sticky top-20 z-20 bg-amber-soft border-2 border-amber rounded-2xl p-3 flex items-center gap-3">
          <p className="flex-1"><b>Moving {moving.customer}&apos;s order.</b> Tap the window to move it to.</p>
          <button className="btn btn-ghost" onClick={() => setMoving(null)}>Cancel</button>
        </div>
      )}
      {error && <p role="alert" className="text-danger font-bold">{error}</p>}

      <ol className="space-y-3">
        {days.map((d) => {
          const anyOpen = d.cells.some((c) => c.open);
          return (
            <li key={d.date} className={`rounded-3xl border-2 p-3 ${anyOpen ? "bg-card border-line" : "bg-paper border-dashed border-line"}`}>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h3 className="font-extrabold text-lg mr-auto">
                  {d.date === today ? "Today · " : ""}{formatDate(d.date, { weekday: "long", month: "short", day: "numeric" })}
                  {!anyOpen && <span className="ml-2 text-sm font-bold text-danger">Blocked{d.note ? ` · ${d.note}` : ""}</span>}
                </h3>
                {anyOpen ? (
                  <button className="text-sm font-bold underline" disabled={pending} onClick={() => blockDay(d.date)}>Block day</button>
                ) : (
                  <button className="text-sm font-bold underline" disabled={pending} onClick={() => run(() => setDayOpen(d.date, true))}>Open day</button>
                )}
                {d.dayOverride !== null || d.cells.some((c) => c.source === "slot override") ? (
                  <button className="text-sm underline text-muted" disabled={pending} onClick={() => run(() => resetDay(d.date))}>Reset to default</button>
                ) : null}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {d.cells.map((c) => {
                  const slot = slots.find((s) => s.id === c.slotId)!;
                  const full = c.orders.length >= slot.capacity;
                  return (
                    <div key={c.slotId}
                      onClick={moving ? () => { const m = moving; setMoving(null); run(() => moveOrder(m.id, d.date, c.slotId)); } : undefined}
                      className={`rounded-2xl border-2 p-2 min-h-24 ${moving ? "cursor-pointer hover:border-amber" : ""} ${c.open ? "border-shell/40 bg-white" : "border-line bg-paper"}`}>
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-sm">{clockLabel(slot.start)}–{clockLabel(slot.end)}</span>
                        {!moving && (
                          <button disabled={pending} onClick={() => run(() => setSlotOpen(d.date, c.slotId, !c.open))}
                            className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.open ? "bg-shell text-white" : "bg-line text-muted"}`}
                            aria-label={`${c.open ? "Close" : "Open"} ${clockLabel(slot.start)} window`}>
                            {c.open ? "Open" : "Closed"}
                          </button>
                        )}
                      </div>
                      <p className={`text-xs ${full ? "text-danger font-bold" : "text-muted"}`}>{c.orders.length}/{slot.capacity} booked</p>
                      <ul className="mt-1 space-y-1">
                        {c.orders.map((o) => (
                          <li key={o.id}>
                            <button disabled={!!moving} onClick={(e) => { e.stopPropagation(); setMoving({ id: o.id, customer: o.customer }); }}
                              className="w-full text-left text-sm bg-amber-soft rounded-lg px-2 py-1 font-bold truncate" title="Tap to move">
                              {o.customer}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="text-sm text-muted">Tap a customer&apos;s name to move their order. Moving doesn&apos;t notify them yet, so give them a text.</p>
    </div>
  );
}
