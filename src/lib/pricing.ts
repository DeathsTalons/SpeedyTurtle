// Flat service fee per order, tiered by number of UNIQUE items.
// 6 bananas + 2 milks = 2 unique items. Quantity never changes the fee.

export type FeeTier = {
  minItems: number;
  maxItems: number | null; // null = no upper limit
  feeCents: number;
  label: string;
};

export type CartLine = {
  chain: "kroger" | "meijer";
  productId?: string | null;
  freeText?: string | null;
  quantity: number;
  unitPriceCents?: number | null; // unknown for free-text items
};

/** Same product twice in the cart counts once. Free-text lines are matched case/space-insensitively. */
export function countUniqueItems(lines: CartLine[]): number {
  const keys = new Set<string>();
  for (const l of lines) {
    if (l.quantity <= 0) continue;
    if (l.productId) keys.add(`${l.chain}:p:${l.productId}`);
    else if (l.freeText?.trim()) keys.add(`${l.chain}:t:${l.freeText.trim().toLowerCase().replace(/\s+/g, " ")}`);
  }
  return keys.size;
}

export function findTier(uniqueItems: number, tiers: FeeTier[]): FeeTier | null {
  if (uniqueItems <= 0) return null;
  return (
    [...tiers]
      .sort((a, b) => a.minItems - b.minItems)
      .find((t) => uniqueItems >= t.minItems && (t.maxItems === null || uniqueItems <= t.maxItems)) ?? null
  );
}

export function serviceFeeCents(uniqueItems: number, tiers: FeeTier[]): number {
  const tier = findTier(uniqueItems, tiers);
  if (uniqueItems > 0 && !tier) throw new Error(`No fee tier covers ${uniqueItems} items — check fee_tiers`);
  return tier?.feeCents ?? 0;
}

export type FreeTextEstimate = { perItemCents: number };

export type OrderQuote = {
  uniqueItems: number;
  tier: FeeTier | null;
  estimatedSubtotalCents: number;
  serviceFeeCents: number;
  /** Stores in the order (1 or 2). */
  storeCount: number;
  /** Extra flat fee when an order uses both Kroger and Meijer. */
  secondStoreFeeCents: number;
  tipCents: number;
  estimatedTotalCents: number;
  /** What we place on hold on the card: total + buffer for price changes, weighed produce, subs. */
  authorizeCents: number;
};

export function quoteOrder(
  lines: CartLine[],
  tiers: FeeTier[],
  opts: {
    tipCents?: number;
    bufferPct: number;
    /** Extra hold % per store, e.g. { meijer: 10 } because Meijer prices are estimates. */
    extraBufferPct?: Partial<Record<CartLine["chain"], number>>;
    secondStoreFeeCents?: number;
    freeTextEstimate?: FreeTextEstimate;
  },
): OrderQuote {
  const freeTextCents = opts.freeTextEstimate?.perItemCents ?? 500;
  const estimatedSubtotalCents = lines.reduce((sum, l) => {
    if (l.quantity <= 0) return sum;
    const unit = l.unitPriceCents ?? freeTextCents;
    return sum + Math.round(unit * l.quantity);
  }, 0);

  const uniqueItems = countUniqueItems(lines);
  const fee = serviceFeeCents(uniqueItems, tiers);
  const tipCents = opts.tipCents ?? 0;
  const buffer = lines.reduce((sum, l) => {
    if (l.quantity <= 0) return sum;
    const line = Math.round((l.unitPriceCents ?? freeTextCents) * l.quantity);
    return sum + (line * (opts.bufferPct + (opts.extraBufferPct?.[l.chain] ?? 0))) / 100;
  }, 0);
  const bufferCents = Math.ceil(buffer);
  const storeCount = new Set(lines.filter((l) => l.quantity > 0).map((l) => l.chain)).size;
  const secondStore = storeCount > 1 ? (opts.secondStoreFeeCents ?? 0) : 0;
  const fees = fee + secondStore;

  return {
    uniqueItems,
    tier: findTier(uniqueItems, tiers),
    estimatedSubtotalCents,
    serviceFeeCents: fee,
    storeCount,
    secondStoreFeeCents: secondStore,
    tipCents,
    estimatedTotalCents: estimatedSubtotalCents + fees + tipCents,
    authorizeCents: estimatedSubtotalCents + bufferCents + fees + tipCents,
  };
}

/** After shopping: real receipt subtotal → amount to capture. Never more than what was authorized. */
export function finalCaptureCents(args: {
  receiptSubtotalCents: number;
  serviceFeeCents: number;
  secondStoreFeeCents?: number;
  tipCents: number;
  authorizedCents: number;
}): { captureCents: number; overAuthorizationCents: number } {
  const total = args.receiptSubtotalCents + args.serviceFeeCents + (args.secondStoreFeeCents ?? 0) + args.tipCents;
  const captureCents = Math.min(total, args.authorizedCents);
  return { captureCents, overAuthorizationCents: total - captureCents };
}
