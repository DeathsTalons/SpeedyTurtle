"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatTime } from "@/lib/format";
import type { Availability } from "@/lib/data";
import { AREAS, AREA_LABEL, type Area } from "@/lib/areas";
import { setAsapCapacity, setAvailable, setAvailableArea } from "./actions";

/** "Available now" for same-day ASAP orders, in ONE area at a time (Avon & Brownsburg, or Greencastle). */
export function AvailabilityToggle({ a }: { a: Availability }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const live = !!a.until;
  const [area, setArea] = useState<Area>(a.area ?? "hendricks");
  const run = (fn: () => Promise<void>) => start(async () => { await fn(); router.refresh(); });

  // While live, switching the area moves you there right away (same end time).
  const pickArea = (next: Area) => {
    setArea(next);
    if (live) run(() => setAvailableArea(next));
  };

  const where = a.area ? AREA_LABEL[a.area] : "all areas";

  return (
    <section className={`rounded-3xl border-2 p-4 mb-6 ${live ? "bg-shell text-white border-shell" : "bg-card border-line"}`} aria-live="polite">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-56">
          <p className="font-display text-xl font-extrabold">{live ? `Available now in ${where} until ${formatTime(a.until!)}` : "Not taking same-day orders"}</p>
          <p className={live ? "text-white/85" : "text-muted"}>
            {live
              ? `${a.taken} of ${a.capacity} ASAP spots taken${a.open ? "" : " · full, customers can't book ASAP"}. Only customers in ${where} see it.`
              : "Pick where you are, then how long. Only customers in that area can order same-day."}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Area">
        {AREAS.map((ar) => {
          const on = area === ar;
          return (
            <button key={ar} type="button" role="radio" aria-checked={on} disabled={pending} onClick={() => pickArea(ar)}
              className={`rounded-full border-2 px-4 py-2 font-bold ${
                on ? (live ? "bg-white text-ink border-white" : "bg-shell text-white border-shell") : live ? "border-white/60 text-white" : "border-line bg-card"
              }`}>
              {AREA_LABEL[ar]}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {[60, 120, 240].map((m) => (
          <button key={m} disabled={pending} onClick={() => run(() => setAvailable(m, area))}
            className={`btn !min-h-10 ${live ? "bg-white text-ink" : "btn-primary"}`}>{m / 60} hr{m > 60 ? "s" : ""}</button>
        ))}
        {live && <button disabled={pending} onClick={() => run(() => setAvailable(0))} className="btn !min-h-10 border-2 border-white">Go offline</button>}
      </div>

      <label className={`mt-3 text-sm flex items-center gap-2 ${live ? "text-white/85" : "text-muted"}`}>
        ASAP orders at once
        <select className="rounded-lg px-2 py-1 bg-white text-ink font-bold" value={a.capacity} disabled={pending} onChange={(e) => run(() => setAsapCapacity(Number(e.target.value)))}>
          {[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}
        </select>
      </label>
    </section>
  );
}
