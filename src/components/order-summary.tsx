"use client";
import { quoteOrder, type FeeTier } from "@/lib/pricing";
import { money, toCartLines, CHAIN_NAME, type CartItem, type Chain } from "@/lib/cart";

export function OrderSummary({ items, tiers, bufferPct, secondStoreFeeCents, addOn, tipCents = 0 }: {
  items: CartItem[]; tiers: FeeTier[]; bufferPct: number; secondStoreFeeCents: number; addOn: Chain | null; tipCents?: number;
}) {
  const q = quoteOrder(toCartLines(items), tiers, { bufferPct, tipCents, secondStoreFeeCents });
  const sorted = [...tiers].sort((a, b) => a.minItems - b.minItems);
  const next = q.tier ? sorted.find((t) => t.minItems > (q.tier!.maxItems ?? Infinity)) : null;
  const room = q.tier?.maxItems != null ? q.tier.maxItems - q.uniqueItems : null;
  const hasRequests = items.some((i) => i.unitPriceCents == null);

  return (
    <div className="space-y-2">
      <div className="flex justify-between"><span>Groceries (estimate)</span><span>{money(q.estimatedSubtotalCents)}</span></div>
      <div className="flex justify-between">
        <span>Service fee <span className="text-muted">· {q.uniqueItems} unique {q.uniqueItems === 1 ? "item" : "items"}</span></span>
        <span>{money(q.serviceFeeCents)}</span>
      </div>
      {q.secondStoreFeeCents > 0 && (
        <div className="flex justify-between"><span>Second store <span className="text-muted">· {addOn ? CHAIN_NAME[addOn] : "add-on"}</span></span><span>{money(q.secondStoreFeeCents)}</span></div>
      )}
      {tipCents > 0 && <div className="flex justify-between"><span>Tip</span><span>{money(tipCents)}</span></div>}
      <div className="flex justify-between text-lg font-bold border-t border-line pt-2"><span>Estimated total</span><span>{money(q.estimatedTotalCents)}</span></div>
      {q.tier && (
        <p className="text-sm text-muted">
          {room != null && room > 0 && next
            ? `Add up to ${room} more unique ${room === 1 ? "item" : "items"} and the fee stays ${money(q.serviceFeeCents)}.`
            : room === 0 && next
              ? `One more unique item moves the fee to ${money(next.feeCents)}.`
              : `${q.tier.label} fee.`}
        </p>
      )}
      {hasRequests && <p className="text-sm text-muted">Requested items are estimated at $5 each until Cody finds them.</p>}
    </div>
  );
}
