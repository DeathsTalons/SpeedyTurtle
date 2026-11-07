"use client";
// "Refund" on one item of an order: for the 24-hour missing / damaged / wrong item promise.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/money";
import { refundOrderItem } from "../../actions";

export function RefundItem({ orderId, itemId, name, suggestedCents }: { orderId: string; itemId: string; name: string; suggestedCents: number | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(suggestedCents != null ? (suggestedCents / 100).toFixed(2) : "");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  if (!open) {
    return <button type="button" className="text-sm font-bold underline text-danger" onClick={() => setOpen(true)}>Refund</button>;
  }

  const go = () => {
    const n = Number(amount.replace(/[$,\s]/g, ""));
    if (!(n > 0)) { setError("Enter an amount."); return; }
    if (!window.confirm(`Refund ${money(Math.round(n * 100))} for ${name} to the customer's card?`)) return;
    setError("");
    start(async () => {
      const r = await refundOrderItem(orderId, itemId, amount, note);
      if (r.error) setError(r.error);
      else { setOpen(false); router.refresh(); }
    });
  };

  return (
    <div className="mt-2 bg-paper border border-line rounded-xl p-3 space-y-2 text-left">
      <div className="flex flex-wrap gap-2 items-end">
        <div className="w-28">
          <label htmlFor={`amt-${itemId}`} className="label text-sm">Amount</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden>$</span>
            <input id={`amt-${itemId}`} className="field !pl-7" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} />
          </div>
        </div>
        <div className="flex-1 min-w-40">
          <label htmlFor={`why-${itemId}`} className="label text-sm">Reason (optional)</label>
          <input id={`why-${itemId}`} className="field" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Missing, crushed, wrong size…" />
        </div>
      </div>
      {suggestedCents == null && <p className="text-xs text-muted">No price on file for this item. Use the receipt.</p>}
      {error && <p role="alert" className="text-sm font-bold text-danger">{error}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary !min-h-0 !py-2" disabled={pending} onClick={go}>{pending ? "Refunding…" : "Refund to card"}</button>
        <button type="button" className="btn btn-ghost !min-h-0 !py-2" disabled={pending} onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}
