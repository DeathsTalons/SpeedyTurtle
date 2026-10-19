"use client";
// The shopping cart lives in the customer's browser until checkout.
// Prices here are for display only — checkout re-prices everything on the server.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CartLine } from "@/lib/pricing";
import type { ApprovedSub, SubChoice } from "@/lib/shopping";

export type Chain = "kroger" | "meijer";

export type CartItem = {
  key: string;              // unique per line
  chain: Chain;
  externalId?: string;      // Kroger productId
  productId?: string;       // Meijer catalog row id
  freeText?: string;        // "anything else" requests
  name: string;
  size?: string | null;
  imageUrl?: string | null;
  unitPriceCents?: number | null;
  quantity: number;
  /** Notes for Cody, including approved substitutions. */
  note?: string;
  /** What to do if it's out. Defaults to Cody's pick. */
  subChoice?: SubChoice;
  /** Specific products OK as swaps (when subChoice is "approved"). */
  approvedSubs?: ApprovedSub[];
};

type CartCtx = {
  items: CartItem[];
  ready: boolean;
  /** The store this order is from. The other one is an add-on with an extra fee. */
  primary: Chain | null;
  setPrimary: (c: Chain | null) => void;
  /** The other store, if the cart has items from it. */
  addOn: Chain | null;
  add: (item: Omit<CartItem, "key" | "quantity"> & { quantity?: number }) => void;
  setQuantity: (key: string, quantity: number) => void;
  setNote: (key: string, note: string) => void;
  setSubChoice: (key: string, choice: SubChoice) => void;
  setApprovedSubs: (key: string, subs: ApprovedSub[]) => void;
  remove: (key: string) => void;
  clear: () => void;
  quantityOf: (chain: Chain, id: string) => number;
};

const Ctx = createContext<CartCtx | null>(null);
const STORAGE_KEY = "speedy-turtle-cart-v1";
const PRIMARY_KEY = "speedy-turtle-store-v1";
export const otherChain = (c: Chain): Chain => (c === "kroger" ? "meijer" : "kroger");
export const CHAIN_NAME: Record<Chain, string> = { kroger: "Kroger", meijer: "Meijer" };

export const itemIdentity = (i: Pick<CartItem, "chain" | "externalId" | "productId" | "freeText">) =>
  i.externalId ? `${i.chain}:k:${i.externalId}` : i.productId ? `${i.chain}:p:${i.productId}` : `${i.chain}:t:${(i.freeText ?? "").trim().toLowerCase()}`;

/** Shape the pricing module understands (used for the fee-tier preview). */
export const toCartLines = (items: CartItem[]): CartLine[] =>
  items.map((i) => ({
    chain: i.chain,
    productId: i.externalId ?? i.productId ?? null,
    freeText: i.freeText ?? null,
    quantity: i.quantity,
    unitPriceCents: i.unitPriceCents ?? null,
  }));

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [chosen, setChosen] = useState<Chain | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from storage
      if (saved) setItems(JSON.parse(saved));
      const p = localStorage.getItem(PRIMARY_KEY);
      if (p === "kroger" || p === "meijer") setChosen(p);
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      if (chosen) localStorage.setItem(PRIMARY_KEY, chosen); else localStorage.removeItem(PRIMARY_KEY);
    } catch {}
  }, [items, chosen, ready]);

  // If the cart only has items from one store, that store is the order's store.
  const present = new Set(items.map((i) => i.chain));
  const primary: Chain | null =
    present.size === 1 ? [...present][0] : chosen && (present.size === 0 || present.has(chosen)) ? chosen : present.size ? "kroger" : chosen;
  const addOn: Chain | null = primary && present.has(otherChain(primary)) ? otherChain(primary) : null;

  const add: CartCtx["add"] = useCallback((item) => {
    setItems((prev) => {
      const id = itemIdentity(item);
      const existing = prev.find((p) => itemIdentity(p) === id);
      if (existing) return prev.map((p) => (p === existing ? { ...p, quantity: p.quantity + (item.quantity ?? 1) } : p));
      return [...prev, { ...item, quantity: item.quantity ?? 1, key: `${id}:${Date.now()}` }];
    });
  }, []);

  const setQuantity = useCallback((key: string, quantity: number) => {
    setItems((prev) => (quantity <= 0 ? prev.filter((p) => p.key !== key) : prev.map((p) => (p.key === key ? { ...p, quantity } : p))));
  }, []);
  const setNote = useCallback((key: string, note: string) => setItems((prev) => prev.map((p) => (p.key === key ? { ...p, note } : p))), []);
  const setSubChoice = useCallback((key: string, subChoice: SubChoice) => setItems((prev) => prev.map((p) => (p.key === key ? { ...p, subChoice } : p))), []);
  const setApprovedSubs = useCallback((key: string, approvedSubs: ApprovedSub[]) => setItems((prev) => prev.map((p) => (p.key === key ? { ...p, approvedSubs } : p))), []);
  const remove = useCallback((key: string) => setItems((prev) => prev.filter((p) => p.key !== key)), []);
  const clear = useCallback(() => { setItems([]); setChosen(null); }, []);
  const quantityOf = useCallback(
    (chain: Chain, id: string) => items.find((i) => i.chain === chain && (i.externalId === id || i.productId === id))?.quantity ?? 0,
    [items],
  );

  const value = useMemo(
    () => ({ items, ready, primary, setPrimary: setChosen, addOn, add, setQuantity, setNote, setSubChoice, setApprovedSubs, remove, clear, quantityOf }),
    [items, ready, primary, addOn, add, setQuantity, setNote, setSubChoice, setApprovedSubs, remove, clear, quantityOf],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be used inside CartProvider");
  return c;
}

export { money } from "@/lib/money";
