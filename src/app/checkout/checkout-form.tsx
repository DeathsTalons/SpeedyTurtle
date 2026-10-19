"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { CardSection, type CardHandle } from "./card-section";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart, money } from "@/lib/cart";
import { OrderSummary } from "@/components/order-summary";
import type { FeeTier } from "@/lib/pricing";
import { formatDate, formatTime } from "@/lib/format";
import { placeOrder } from "./actions";

export type SlotOption = { date: string; slotTemplateId: number; label: string; window: string; remaining: number };
type Address = { id: string; line1: string; line2: string | null; city: string; zip: string; is_default: boolean };

export function CheckoutForm({ paymentsOn, asapUntil, addresses, slots, tiers, bufferPct, meijerExtraBufferPct, secondStoreFeeCents }: {
  paymentsOn: boolean; asapUntil: string | null; addresses: Address[]; slots: SlotOption[]; tiers: FeeTier[]; bufferPct: number; meijerExtraBufferPct: number; secondStoreFeeCents: number;
}) {
  const cart = useCart();
  const router = useRouter();
  const [addressId, setAddressId] = useState(addresses.find((a) => a.is_default)?.id ?? addresses[0]?.id ?? "");
  const [slotKey, setSlotKey] = useState("");
  const [notes, setNotes] = useState("");
  const [tip, setTip] = useState(500);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const card = useRef<CardHandle>(null);
  const [cardKey, setCardKey] = useState(0); // new card form after a decline (each form saves one card)

  const byDate = useMemo(() => {
    const m = new Map<string, SlotOption[]>();
    for (const s of slots) m.set(s.date, [...(m.get(s.date) ?? []), s]);
    return [...m];
  }, [slots]);

  if (!cart.ready) return <p className="text-muted">Loading…</p>;
  if (cart.items.length === 0)
    return <p>Your cart is empty. <Link href="/shop" className="underline font-bold">Go shopping</Link></p>;
  if (addresses.length === 0)
    return <p className="bg-amber-soft rounded-2xl p-4"><Link href="/account" className="underline font-bold">Add a delivery address</Link> before checking out.</p>;

  const submit = () => {
    setError("");
    const asap = slotKey === "asap";
    const [date, id] = asap ? ["", "0"] : slotKey.split("#");
    if (!asap && !date) { setError("Pick a delivery window."); return; }
    start(async () => {
      let paymentMethodId: string | undefined;
      if (paymentsOn) {
        const c = await card.current?.confirm();
        if (!c || c.error || !c.paymentMethodId) { setError(c?.error ?? "Add a card to place your order."); return; }
        paymentMethodId = c.paymentMethodId;
      }
      const res = await placeOrder({
        paymentMethodId,
        addressId, date, slotTemplateId: Number(id), asap, notes, tipCents: tip, primaryChain: cart.primary ?? "kroger",
        items: cart.items.map((i) => ({ chain: i.chain, externalId: i.externalId, productId: i.productId, freeText: i.freeText, quantity: i.quantity, note: i.note, subChoice: i.subChoice ?? "codys_pick", approvedSubs: i.approvedSubs ?? [] })),
      });
      if (res.error) { setError(res.error); if (paymentMethodId) setCardKey((k) => k + 1); return; }
      cart.clear();
      router.push(`/orders/${res.orderId}?placed=1`);
    });
  };

  return (
    <div className="space-y-8">
      <fieldset className="space-y-3">
        <legend className="text-xl font-extrabold mb-2">Delivery window</legend>
        {asapUntil && (
          <label className={`flex gap-3 items-center cursor-pointer rounded-2xl border-2 p-3 ${slotKey === "asap" ? "border-shell bg-shell text-white" : "border-shell/50 bg-card"}`}>
            <input type="radio" name="slot" value="asap" checked={slotKey === "asap"} onChange={() => setSlotKey("asap")} className="sr-only" />
            <span className="w-3 h-3 rounded-full bg-amber animate-pulse shrink-0" aria-hidden />
            <span><b>ASAP, today</b><br /><span className={slotKey === "asap" ? "text-white/85" : "text-muted"}>Cody is out now. Order by {formatTime(asapUntil)}.</span></span>
          </label>
        )}
        {byDate.length === 0 && !asapUntil && <p className="bg-amber-soft rounded-2xl p-4">No delivery windows are open right now. Check back soon.</p>}
        {byDate.map(([date, list]) => (
          <div key={date} className="flex flex-wrap items-center gap-2">
            <span className="w-28 font-bold">{formatDate(date)}</span>
            {list.map((s) => {
              const k = `${s.date}#${s.slotTemplateId}`;
              return (
                <label key={k} className={`cursor-pointer rounded-full border-2 px-4 py-2 ${slotKey === k ? "border-shell bg-shell text-white" : "border-line bg-card"}`}>
                  <input type="radio" name="slot" value={k} checked={slotKey === k} onChange={() => setSlotKey(k)} className="sr-only" />
                  <span className="font-bold">{s.window}</span>
                  {s.remaining <= 2 && <span className={`ml-2 text-sm ${slotKey === k ? "" : "text-danger"}`}>{s.remaining} left</span>}
                </label>
              );
            })}
          </div>
        ))}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-xl font-extrabold mb-2">Deliver to</legend>
        {addresses.map((a) => (
          <label key={a.id} className={`flex gap-3 items-start cursor-pointer rounded-2xl border-2 p-3 ${addressId === a.id ? "border-shell bg-card" : "border-line"}`}>
            <input type="radio" name="address" checked={addressId === a.id} onChange={() => setAddressId(a.id)} className="mt-1.5 accent-[var(--shell)]" />
            <span><b>{a.line1}{a.line2 ? `, ${a.line2}` : ""}</b><br /><span className="text-muted">{a.city}, IN {a.zip}</span></span>
          </label>
        ))}
      </fieldset>

      <p className="bg-card border border-line rounded-2xl p-4 text-sm">
        Substitution choices are set per item in your <Link href="/cart" className="underline font-bold">cart</Link>.
        {" "}{cart.items.filter((i) => (i.subChoice ?? "codys_pick") === "codys_pick").length} of {cart.items.length} items are set to Cody&apos;s pick.
      </p>

      <div>
        <label htmlFor="notes" className="text-xl font-extrabold block mb-2">Notes for Cody</label>
        <textarea id="notes" className="field min-h-24" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500}
          placeholder="Anything that helps: “ripe avocados for tonight”, “paper bags please”" />
      </div>

      <fieldset>
        <legend className="text-xl font-extrabold mb-2">Tip</legend>
        <div className="flex flex-wrap gap-2">
          {[0, 300, 500, 1000].map((c) => (
            <button key={c} type="button" onClick={() => setTip(c)} aria-pressed={tip === c}
              className={`rounded-full border-2 px-5 py-2 font-bold ${tip === c ? "border-shell bg-shell text-white" : "border-line bg-card"}`}>
              {c === 0 ? "No tip" : money(c)}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="bg-card border border-line rounded-3xl p-5 space-y-4">
        <OrderSummary items={cart.items} tiers={tiers} bufferPct={bufferPct} tipCents={tip} secondStoreFeeCents={secondStoreFeeCents} addOn={cart.addOn} />
        <p className="text-sm text-muted">
          Your card is held for the estimate plus {bufferPct}%{cart.items.some((i) => i.chain === "meijer") ? ` (${bufferPct + meijerExtraBufferPct}% on Meijer items, since their prices are estimates)` : ""} to cover weighed produce and price changes. You&apos;re only charged the receipt total after Cody shops.
        </p>
        {paymentsOn ? (
          <div className="space-y-2">
            <h2 className="font-extrabold text-lg">Payment</h2>
            <CardSection key={cardKey} handle={card} />
          </div>
        ) : (
          <p className="text-sm bg-amber-soft rounded-xl p-3"><b>Test mode:</b> card payment isn&apos;t connected yet, so no card is charged.</p>
        )}
        {error && <p role="alert" className="text-danger font-bold">{error}</p>}
        <button className="btn btn-primary w-full" onClick={submit} disabled={pending || (byDate.length === 0 && !asapUntil)}>
          {pending ? "Placing order…" : "Place order"}
        </button>
      </div>
    </div>
  );
}
