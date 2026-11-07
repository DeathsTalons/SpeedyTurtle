"use client";
import { useState, useTransition } from "react";
import { money } from "@/lib/money";
import { TipNote } from "@/components/tip-note";
import { addTipAfterDelivery } from "./actions";

const PRESETS = [300, 500, 1000];

export function TipAfter({ orderId }: { orderId: string }) {
  const [choice, setChoice] = useState<number | "other" | null>(null);
  const [other, setOther] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<number | null>(null);
  const [pending, start] = useTransition();

  const cents = choice === "other" ? Math.round(parseFloat(other || "0") * 100) : choice ?? 0;

  if (done) {
    return (
      <section className="bg-shell text-white rounded-3xl p-5" role="status">
        <p className="font-display text-2xl font-extrabold">Thank you!</p>
        <p>Your {money(done)} tip came straight to me. I really appreciate it.</p>
      </section>
    );
  }

  const send = () => {
    setError("");
    start(async () => {
      const r = await addTipAfterDelivery(orderId, cents);
      if (r.error) setError(r.error);
      else setDone(cents);
    });
  };

  return (
    <section className="bg-card border border-line rounded-3xl p-5 space-y-3" aria-labelledby="tip-h">
      <h2 id="tip-h" className="text-xl font-extrabold">Add a tip?</h2>
      <TipNote />
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((c) => (
          <button key={c} type="button" onClick={() => setChoice(c)} aria-pressed={choice === c}
            className={`rounded-full border-2 px-5 py-2 font-bold ${choice === c ? "border-shell bg-shell text-white" : "border-line bg-card"}`}>
            {money(c)}
          </button>
        ))}
        <button type="button" onClick={() => setChoice("other")} aria-pressed={choice === "other"}
          className={`rounded-full border-2 px-5 py-2 font-bold ${choice === "other" ? "border-shell bg-shell text-white" : "border-line bg-card"}`}>
          Other
        </button>
      </div>
      {choice === "other" && (
        <div className="max-w-40">
          <label htmlFor="tip-other" className="label">Amount</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden>$</span>
            <input id="tip-other" className="field !pl-7" inputMode="decimal" value={other} autoFocus
              onChange={(e) => setOther(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0.00" />
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-danger font-bold">{error}</p>}
      <button className="btn btn-primary" disabled={pending || cents < 100} onClick={send}>
        {pending ? "Adding tip…" : cents >= 100 ? `Tip ${money(cents)}` : "Choose an amount"}
      </button>
      <p className="text-xs text-muted">Charged to the card you used for this order.</p>
    </section>
  );
}
