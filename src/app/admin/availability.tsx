"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatTime } from "@/lib/format";
import type { Availability } from "@/lib/data";
import { setAsapCapacity, setAvailable } from "./actions";

export function AvailabilityToggle({ a }: { a: Availability }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const live = !!a.until;
  const run = (fn: () => Promise<void>) => start(async () => { await fn(); router.refresh(); });

  return (
    <section className={`rounded-3xl border-2 p-4 mb-6 ${live ? "bg-shell text-white border-shell" : "bg-card border-line"}`} aria-live="polite">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-56">
          <p className="font-display text-xl font-extrabold">{live ? `Available now until ${formatTime(a.until!)}` : "Not taking same-day orders"}</p>
          <p className={live ? "text-white/85" : "text-muted"}>
            {live ? `${a.taken} of ${a.capacity} ASAP spots taken${a.open ? "" : " · full, customers can't book ASAP"}` : "Turn this on when you're out and can deliver today."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[60, 120, 240].map((m) => (
            <button key={m} disabled={pending} onClick={() => run(() => setAvailable(m))}
              className={`btn !min-h-10 ${live ? "bg-white text-ink" : "btn-primary"}`}>{m / 60} hr{m > 60 ? "s" : ""}</button>
          ))}
          {live && <button disabled={pending} onClick={() => run(() => setAvailable(0))} className="btn !min-h-10 border-2 border-white">Go offline</button>}
        </div>
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
