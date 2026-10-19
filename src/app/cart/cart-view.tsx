"use client";
import Link from "next/link";
import { useState } from "react";
import { SubPicker } from "@/components/sub-picker";
import { useCart, money, otherChain, CHAIN_NAME, type Chain } from "@/lib/cart";
import { QtyStepper } from "@/components/qty-stepper";
import { OrderSummary } from "@/components/order-summary";
import type { FeeTier } from "@/lib/pricing";
import { SUB_CHOICES, type SubChoice } from "@/lib/shopping";

const STORE = CHAIN_NAME;

export function CartView({ tiers, bufferPct, secondStoreFeeCents, canAddOther, primaryStoreNames }: {
  tiers: FeeTier[]; bufferPct: number; secondStoreFeeCents: number;
  canAddOther: Record<Chain, boolean>; primaryStoreNames: Record<Chain, string | null>;
}) {
  const cart = useCart();
  const [picking, setPicking] = useState<string | null>(null);
  const pickingItem = cart.items.find((i) => i.key === picking);
  if (!cart.ready) return <p className="text-muted">Loading your cart…</p>;
  if (cart.items.length === 0)
    return (
      <div className="bg-card border border-line rounded-3xl p-8 text-center space-y-4">
        <p className="text-lg">Your cart is empty.</p>
        <Link href="/shop" className="btn btn-primary">Start shopping</Link>
      </div>
    );

  return (
    <div className="space-y-6">
      {/* The order's store first; the other store only shows up as a priced add-on. */}
      <div className={`grid gap-4 ${cart.addOn ? "md:grid-cols-2" : ""}`}>
        {([cart.primary!, otherChain(cart.primary!)] as Chain[]).map((chain) => {
          const lines = cart.items.filter((i) => i.chain === chain);
          const isAddOn = chain !== cart.primary;
          if (isAddOn && lines.length === 0) return null;
          return (
            <section key={chain} aria-labelledby={`bag-${chain}`}
              className={`rounded-3xl border-2 bg-card p-4 ${lines.length ? (chain === "kroger" ? "border-kroger/40" : "border-meijer/40") : "border-dashed border-line"}`}>
              <h2 id={`bag-${chain}`} className={`text-xl font-extrabold tag-${chain}`}>
                {STORE[chain]} <span className="text-muted text-base font-normal">· {lines.length} {lines.length === 1 ? "item" : "items"}</span>
              </h2>
              {isAddOn && !canAddOther[cart.primary!] && (
                <p role="alert" className="mt-1 text-sm font-bold text-danger">
                  {primaryStoreNames[cart.primary!] ?? STORE[cart.primary!]} orders can&apos;t include {STORE[chain]}. Remove these items to check out.
                </p>
              )}
              {isAddOn && canAddOther[cart.primary!] && (
                <p className="mt-1 text-sm bg-amber-soft rounded-xl px-3 py-1.5 inline-block">
                  Add-on store · +{money(secondStoreFeeCents)}. Remove these to drop the fee.
                </p>
              )}
              {lines.length === 0 ? (
                <p className="text-muted mt-2">Nothing from {STORE[chain]} yet. <Link href="/shop" className="underline font-bold">Add some</Link></p>
              ) : (
                <ul className="divide-y divide-line mt-2">
                  {lines.map((i) => (
                    <li key={i.key} className="py-3 space-y-2">
                      <div className="flex gap-3 items-start">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold leading-snug">{i.name}{i.freeText && <span className="ml-2 text-xs font-bold bg-amber-soft px-2 py-0.5 rounded-full align-middle">Request</span>}</p>
                          <p className="text-sm text-muted">{[i.size, i.unitPriceCents != null ? `${money(i.unitPriceCents)} each` : null].filter(Boolean).join(" · ")}</p>
                        </div>
                        <QtyStepper value={i.quantity} onChange={(n) => cart.setQuantity(i.key, n)} label={i.name} />
                      </div>
                      <div className="grid sm:grid-cols-[auto_1fr] gap-2 items-center">
                        <label className="text-sm font-bold" htmlFor={`sub-${i.key}`}>If it&apos;s out</label>
                        <select id={`sub-${i.key}`} className="field !min-h-0 !py-2 text-sm"
                          value={i.subChoice ?? "codys_pick"} onChange={(e) => cart.setSubChoice(i.key, e.target.value as SubChoice)}>
                          {SUB_CHOICES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                      </div>
                      {(i.subChoice ?? "codys_pick") === "approved" && (
                        <div className="flex flex-wrap items-center gap-2">
                          {(i.approvedSubs ?? []).map((s, n) => (
                            <span key={s.externalId ?? s.name} className="text-sm bg-amber-soft rounded-full px-3 py-1">{n + 1}. {s.name}</span>
                          ))}
                          <button type="button" className="text-sm font-bold underline" onClick={() => setPicking(i.key)}>
                            {(i.approvedSubs ?? []).length ? "Change substitutes" : "Pick OK substitutes"}
                          </button>
                        </div>
                      )}
                      <label className="sr-only" htmlFor={`note-${i.key}`}>Notes for {i.name}</label>
                      <input id={`note-${i.key}`} className="field !min-h-0 !py-2 text-sm"
                        placeholder={(i.subChoice ?? "codys_pick") === "approved" ? "Anything else that's OK? “any 2% gallon”" : (i.subChoice === "other" ? "What should Cody do if it's out?" : "Notes for Cody (optional)")}
                        value={i.note ?? ""} onChange={(e) => cart.setNote(i.key, e.target.value)} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {pickingItem && (
        <SubPicker itemName={pickingItem.name} chain={pickingItem.chain} primary={cart.primary ?? pickingItem.chain}
          initial={pickingItem.approvedSubs ?? []} onClose={() => setPicking(null)}
          onSave={(subs) => { cart.setApprovedSubs(pickingItem.key, subs); setPicking(null); }} />
      )}

      <div className="bg-card border border-line rounded-3xl p-5 space-y-4">
        {!cart.addOn && canAddOther[cart.primary!] && (
          <p className="text-sm text-muted">
            Need something from {STORE[otherChain(cart.primary!)]} too? <Link href="/shop?addon=1" className="underline font-bold">Add it</Link> for {money(secondStoreFeeCents)} more.
          </p>
        )}
        <OrderSummary items={cart.items} tiers={tiers} bufferPct={bufferPct} secondStoreFeeCents={secondStoreFeeCents} addOn={cart.addOn} />
        {cart.addOn && !canAddOther[cart.primary!] ? (
          <button className="btn btn-primary w-full" disabled>Remove {STORE[cart.addOn]} items to continue</button>
        ) : (
          <Link href="/checkout" className="btn btn-primary w-full">Choose a delivery time</Link>
        )}
      </div>
    </div>
  );
}
