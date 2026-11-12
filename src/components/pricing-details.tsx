// Every fee, spelled out. Used on the public Pricing page and the one-time welcome screen,
// so both always show the same (live) numbers.
import { money } from "@/lib/money";
import type { FeeTier } from "@/lib/pricing";
import { TipNote } from "@/components/tip-note";

const range = (min: number, max: number | null) =>
  max == null ? `${min}+ items` : min <= 1 ? `Up to ${max} items` : `${min}–${max} items`;

export function PricingDetails({ tiers, secondStoreFeeCents, bufferPct }: { tiers: FeeTier[]; secondStoreFeeCents: number; bufferPct: number }) {
  return (
    <div className="space-y-6">
      <section className="bg-card border border-line rounded-3xl p-5 space-y-2">
        <h2 className="text-xl font-extrabold">Groceries at receipt price</h2>
        <p>You pay exactly what&apos;s on the Kroger or Meijer receipt. I don&apos;t mark up a single item.</p>
      </section>

      <section className="bg-card border border-line rounded-3xl p-5 space-y-3" aria-labelledby="save-h">
        <h2 id="save-h" className="text-xl font-extrabold">Ways I save you money</h2>
        <ul className="space-y-3">
          <li>
            <b>Sale-size swaps.</b> If a deal gets you the same amount for less, I&apos;ll take it. Say you order a 16 oz block of cheese
            for $5, but the 8 oz is on sale 2 for $4. I&apos;ll grab two 8 oz blocks and you save $1. It still counts as one item for your fee.
          </li>
          <li>
            <b>You get the sale price.</b> Prices while you shop are estimates. You pay the shelf price on the day I shop, so if something
            goes on sale in between, the savings are yours.
          </li>
          <li>
            <b>Never charged for what I can&apos;t find.</b> Out-of-stock items come right off. You only pay for what&apos;s on the receipt.
          </li>
          <li>
            <b>Store brand when you&apos;re open to it.</b> Choose &ldquo;Store brand is OK&rdquo; as the backup on any item and I&apos;ll
            grab the Kroger or Meijer version if yours is out.
          </li>
        </ul>
        <p className="text-sm text-muted">Want exactly what you picked, no swaps? Add a note to that item in your cart and I&apos;ll stick to it.</p>
      </section>

      <section className="bg-card border border-line rounded-3xl p-5 space-y-3" aria-labelledby="fee-h">
        <h2 id="fee-h" className="text-xl font-extrabold">One flat service fee per order</h2>
        <p>The fee depends on how many <b>different</b> items you order, not how many of each. Six bananas and two gallons of milk count as 2 items.</p>
        <table className="w-full">
          <caption className="sr-only">Service fee by number of different items</caption>
          <thead className="sr-only"><tr><th>Size</th><th>Items</th><th>Fee</th></tr></thead>
          <tbody className="divide-y divide-line">
            {tiers.map((t) => (
              <tr key={t.minItems}>
                <th scope="row" className="py-2.5 text-left font-bold">{t.label}</th>
                <td className="py-2.5 text-muted">{range(t.minItems, t.maxItems)}</td>
                <td className="py-2.5 text-right font-extrabold text-lg">{money(t.feeCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {secondStoreFeeCents > 0 && (
        <section className="bg-card border border-line rounded-3xl p-5 space-y-2">
          <h2 className="text-xl font-extrabold">Adding the other store: {money(secondStoreFeeCents)}</h2>
          <p>Each order starts at one store. If you need a few things from the other one, add them for one flat {money(secondStoreFeeCents)}.</p>
        </section>
      )}

      <section className="bg-card border border-line rounded-3xl p-5 space-y-2">
        <h2 className="text-xl font-extrabold">How your card is charged</h2>
        <p>
          When you order, your card is <b>held</b> (not charged) for the estimate plus about {bufferPct}%, to cover weighed produce
          and price changes. After I shop, you&apos;re charged the real receipt total plus the fees above, and the rest of the hold is released.
        </p>
      </section>

      <section className="bg-amber-soft rounded-3xl p-5 space-y-1">
        <h2 className="text-xl font-extrabold">Tips</h2>
        <TipNote className="!text-ink text-base" />
        <p>You can add one at checkout or after your groceries arrive.</p>
      </section>
    </div>
  );
}
