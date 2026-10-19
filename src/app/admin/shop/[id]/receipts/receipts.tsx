"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { money } from "@/lib/money";
import type { BatchOrder } from "@/lib/admin-data";
import { chargeOverHold, saveReceipts, setOrderStatus } from "../../../actions";

type Suggest = { kroger: { cents: number; unpriced: number } | null; meijer: { cents: number; unpriced: number } | null };
const toInput = (c: number | null | undefined) => (c == null ? "" : (c / 100).toFixed(2));
const parse = (v: string) => { const n = Number(v.replace(/[$,\s]/g, "")); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null; };

export function Receipts({ orders, suggest }: { orders: BatchOrder[]; suggest: Record<string, Suggest> }) {
  return (
    <div className="space-y-4">
      {orders.map((o) => <OrderReceipt key={o.id} o={o} s={suggest[o.id]} />)}
      <Link href="/admin" className="btn btn-ghost">Back to orders</Link>
    </div>
  );
}

function OrderReceipt({ o, s }: { o: BatchOrder; s: Suggest }) {
  const [k, setK] = useState(toInput(o.receiptKrogerCents));
  const [m, setM] = useState(toInput(o.receiptMeijerCents));
  type Saved = { totalCents: number; overAuthorizationCents: number; chargedCents?: number; note?: string; paymentsOn?: boolean };
  const [saved, setSaved] = useState<Saved | null>(
    o.finalTotalCents != null ? { totalCents: o.finalTotalCents, overAuthorizationCents: Math.max(0, o.finalTotalCents - o.authorizedCents) } : null);
  const [extraDone, setExtraDone] = useState(false);
  const [error, setError] = useState("");
  const [delivered, setDelivered] = useState(o.status === "delivered");
  const [pending, start] = useTransition();

  const fees = o.serviceFeeCents + o.secondStoreFeeCents + o.tipCents;
  const subtotal = (o.krogerStoreId ? parse(k) ?? 0 : 0) + (o.meijerStoreId ? parse(m) ?? 0 : 0);
  const preview = subtotal + fees;
  const over = preview - o.authorizedCents;

  const field = (label: string, value: string, set: (v: string) => void, sug: Suggest["kroger"]) => (
    <div>
      <label className="label">{label} receipt total</label>
      <div className="flex gap-2 items-center">
        <span className="font-bold">$</span>
        <input className="field" inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} placeholder="0.00" />
      </div>
      {sug && (
        <p className="text-sm text-muted mt-1">
          From your checklist: {money(sug.cents)}{sug.unpriced ? ` + ${sug.unpriced} item${sug.unpriced === 1 ? "" : "s"} with no price` : ""}.
          {" "}<button type="button" className="underline font-bold" onClick={() => set((sug.cents / 100).toFixed(2))}>Use it</button>
        </p>
      )}
    </div>
  );

  return (
    <section className="bg-card border-2 rounded-3xl p-4 space-y-3" style={{ borderColor: o.color }}>
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-extrabold flex-1">{o.customer}</h2>
        {saved && <span className="text-sm font-bold bg-shell text-white px-3 py-1 rounded-full">Saved</span>}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {o.krogerStoreId && field("Kroger", k, setK, s.kroger)}
        {o.meijerStoreId && field("Meijer", m, setM, s.meijer)}
      </div>
      <dl className="text-sm grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
        <dt>Groceries</dt><dd>{money(subtotal)}</dd>
        <dt>Service fee{o.secondStoreFeeCents ? " + second store" : ""}</dt><dd>{money(o.serviceFeeCents + o.secondStoreFeeCents)}</dd>
        {o.tipCents > 0 && <><dt>Tip</dt><dd>{money(o.tipCents)}</dd></>}
        <dt className="font-bold text-base">Final total</dt><dd className="font-bold text-base">{money(preview)}</dd>
        <dt className="text-muted">Card hold</dt><dd className="text-muted">{money(o.authorizedCents)}</dd>
      </dl>
      {subtotal > 0 && over > 0 && (
        <p className="text-sm font-bold text-danger">{money(over)} over the card hold. The hold covers {money(o.authorizedCents)}; text {o.customer.split(" ")[0]} about the difference.</p>
      )}
      {o.paymentStatus === "failed" && !saved && <p className="text-sm font-bold text-danger">Card declined earlier: {o.paymentError}. Saving will try the card again.</p>}
      {saved?.paymentsOn && (
        <div className="bg-paper rounded-2xl p-3 text-sm space-y-2" role="status">
          {saved.chargedCents ? <p><b>Charged {money(saved.chargedCents)}</b> to {o.customer.split(" ")[0]}&apos;s card.</p> : null}
          {saved.note && <p>{saved.note}</p>}
          {saved.overAuthorizationCents > 0 && !extraDone && (
            <p className="flex flex-wrap items-center gap-2">
              <span className="text-danger font-bold">{money(saved.overAuthorizationCents)} still to collect.</span>
              <button className="btn btn-ghost !min-h-9" disabled={pending} onClick={() => {
                if (!window.confirm(`Charge ${money(saved.overAuthorizationCents)} more to ${o.customer}'s card? Make sure they OK'd it.`)) return;
                start(async () => { try { await chargeOverHold(o.id, saved.overAuthorizationCents); setExtraDone(true); } catch (e) { setError((e as Error).message); } });
              }}>Charge {money(saved.overAuthorizationCents)} more</button>
            </p>
          )}
          {extraDone && <p className="font-bold">Charged the extra {money(saved.overAuthorizationCents)}.</p>}
        </div>
      )}
      {error && <p role="alert" className="text-danger font-bold">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" disabled={pending} onClick={() => start(async () => {
          setError("");
          try { setSaved(await saveReceipts(o.id, { kroger: k, meijer: m })); } catch (e) { setError((e as Error).message); }
        })}>{saved ? "Update total" : "Save total & charge"}</button>
        {saved && !delivered && (
          <button className="btn btn-ghost" disabled={pending} onClick={() => start(async () => { await setOrderStatus(o.id, "delivered"); setDelivered(true); })}>Mark delivered</button>
        )}
        {delivered && <span className="self-center font-bold text-shell">Delivered ✓</span>}
      </div>
      {o.paymentStatus === "none" && <p className="text-xs text-muted">This order was placed without a card (test mode), so saving sets the total but doesn&apos;t charge anything.</p>}
    </section>
  );
}
