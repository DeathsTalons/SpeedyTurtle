"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useCart, money, otherChain, CHAIN_NAME, type Chain } from "@/lib/cart";
import { QtyStepper } from "@/components/qty-stepper";
import type { SearchResult } from "../api/search/route";

const CHAINS: Chain[] = ["kroger", "meijer"];
const shortName = (name: string | null) => name?.replace(/^(Kroger|Meijer) – /, "") ?? "Nearest store";

type Props = {
  storeNames: Record<Chain, string | null>;
  /** Add-on store name for an order that starts at each chain. */
  addOnNames: Record<Chain, string | null>;
  hasAddress: boolean; secondStoreFeeCents: number; canAddOther: Record<Chain, boolean>;
  /** Open straight into adding from the other store (e.g. from the cart's "Add it" link). */
  startAddingOther?: boolean;
};

export function Shop(props: Props) {
  const cart = useCart();
  if (!cart.ready) return <p className="text-muted">Loading…</p>;
  if (!cart.primary) return <StorePicker {...props} onPick={cart.setPrimary} />;
  return <StoreSearch key={cart.primary} {...props} primary={cart.primary} />;
}

/** First step of every order: one store. */
function StorePicker({ storeNames, hasAddress, secondStoreFeeCents, canAddOther, onPick }: Props & { onPick: (c: Chain) => void }) {
  return (
    <div className="space-y-5">
      {!hasAddress && <AddressNudge />}
      <h2 className="text-2xl font-extrabold">Where are we shopping?</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        {CHAINS.map((c) => (
          <button key={c} onClick={() => onPick(c)}
            className="rounded-3xl border-2 border-line bg-card p-5 text-left hover:border-shell">
            <span className={`block font-display text-3xl font-extrabold tag-${c}`}>{CHAIN_NAME[c]}</span>
            <span className="block text-muted mt-1">{shortName(storeNames[c])}</span>
            {!canAddOther[c] && <span className="block text-sm mt-2">{CHAIN_NAME[c]} only. {CHAIN_NAME[otherChain(c)]} can&apos;t be added from this store.</span>}
          </button>
        ))}
      </div>
      <p className="text-muted">
        Each order comes from one store. Need a few things from the other one too? You can add them for {money(secondStoreFeeCents)} more.
      </p>
    </div>
  );
}

function AddressNudge() {
  return (
    <p className="bg-amber-soft rounded-2xl p-4">
      <Link href="/account" className="font-bold underline">Add your address</Link> so prices match your nearest store.
    </p>
  );
}

function StoreSearch({ storeNames, addOnNames, hasAddress, secondStoreFeeCents, canAddOther, startAddingOther, primary }: Props & { primary: Chain }) {
  const cart = useCart();
  const other = otherChain(primary);
  const [addingOther, setAddingOther] = useState(!!startAddingOther && canAddOther[primary]);
  const chain: Chain = addingOther ? other : primary;
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [request, setRequest] = useState("");
  const reqId = useRef(0);

  useEffect(() => {
    const term = q.trim();
    const id = ++reqId.current;
    if (term.length < 2) return;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?chain=${chain}&primary=${primary}&q=${encodeURIComponent(term)}`);
        const json = await res.json();
        if (id !== reqId.current) return;
        if (!res.ok) throw new Error(json.error ?? "Search failed.");
        setResults(json.results);
        setStatus("done");
      } catch (e) {
        if (id !== reqId.current) return;
        setError((e as Error).message);
        setStatus("error");
      }
    }, 350);
    return () => clearTimeout(t);
  }, [q, chain, primary]);

  const active = q.trim().length >= 2;
  const shown = active ? results : [];
  const onSearch = (v: string) => { setQ(v); if (v.trim().length >= 2) setStatus("loading"); };
  const switchTo = (toOther: boolean) => { setAddingOther(toOther); if (active) setStatus("loading"); };
  const otherCount = cart.items.filter((i) => i.chain === other).length;

  const addRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const text = request.trim();
    if (!text) return;
    cart.add({ chain, freeText: text, name: text });
    setRequest("");
  };

  return (
    <div className="space-y-5">
      {!hasAddress && <AddressNudge />}

      {addingOther ? (
        <div className="rounded-3xl bg-amber-soft border-2 border-amber p-4 flex flex-wrap items-center gap-3">
          <p className="flex-1 min-w-48">
            <b>Adding from {CHAIN_NAME[other]}</b> ({shortName(addOnNames[primary])}).<br />
            Second-store fee: <b>{money(secondStoreFeeCents)}</b>, once per order.
          </p>
          <button className="btn btn-ghost" onClick={() => switchTo(false)}>Back to {CHAIN_NAME[primary]}</button>
        </div>
      ) : (
        <div className="rounded-3xl bg-card border border-line p-4 flex flex-wrap items-center gap-3">
          <p className="flex-1 min-w-48">
            Shopping <b className={`tag-${primary}`}>{CHAIN_NAME[primary]}</b>
            <span className="text-muted"> · {shortName(storeNames[primary])}</span>
          </p>
          {cart.items.length === 0 ? (
            <button className="btn btn-ghost" onClick={() => cart.setPrimary(null)}>Switch store</button>
          ) : canAddOther[primary] ? (
            <button className="btn btn-ghost flex-col !gap-0 !py-1.5 leading-tight" onClick={() => switchTo(true)}>
              <span>Add from {CHAIN_NAME[other]}</span>
              <span className="text-xs font-normal text-muted">{otherCount > 0 ? `${money(secondStoreFeeCents)} fee added` : `+${money(secondStoreFeeCents)} fee`}</span>
            </button>
          ) : null}
        </div>
      )}

      <div>
        <label htmlFor="search" className="sr-only">Search {CHAIN_NAME[chain]}</label>
        <input id="search" type="search" value={q} onChange={(e) => onSearch(e.target.value)} autoComplete="off"
          placeholder={`Search ${CHAIN_NAME[chain]}: milk, bananas, paper towels…`}
          className="field !text-lg !rounded-full !px-5" />
      </div>

      <div aria-live="polite" className="text-muted">
        {active && status === "loading" && "Searching…"}
        {active && status === "error" && <span className="text-danger font-bold">{error}</span>}
        {active && status === "done" && chain === "meijer" && results.length > 0 && "Meijer prices are estimates and vary a little by store. You're charged the receipt price."}
        {active && status === "done" && results.length === 0 && `Nothing matched “${q.trim()}” at ${CHAIN_NAME[chain]}. Add it as a request below and Cody will find it.`}
      </div>

      <ul className={`divide-y divide-line bg-card border border-line rounded-3xl overflow-hidden ${active ? "" : "hidden"}`}>
        {shown.map((r) => <ResultRow key={r.externalId ?? r.productId} r={r} />)}
        {active && shown.length === 0 && status !== "loading" && <li className="p-6 text-center text-muted">No results yet.</li>}
      </ul>

      {!active && <Suggestions chain={chain} primary={primary} onSearch={onSearch} />}

      <form onSubmit={addRequest} className="bg-card border-2 border-dashed border-line rounded-3xl p-4 space-y-3">
        <label htmlFor="request" className="label">Can&apos;t find it? Ask for it</label>
        <div className="flex gap-2">
          <input id="request" className="field" value={request} onChange={(e) => setRequest(e.target.value)}
            placeholder={`Anything from ${CHAIN_NAME[chain]}: “bakery sourdough, sliced”`} />
          <button className="btn btn-primary shrink-0">Add</button>
        </div>
        <p className="text-sm text-muted">Cody picks it up at shelf price. It counts as one item.</p>
      </form>

      {!canAddOther[primary] && (
        <p className="text-muted border-t border-line pt-5">
          Orders from {storeNames[primary] ?? CHAIN_NAME[primary]} can&apos;t add {CHAIN_NAME[other]} items, since there&apos;s no {CHAIN_NAME[other]} nearby.
        </p>
      )}

    </div>
  );
}

function ResultRow({ r }: { r: SearchResult }) {
  const cart = useCart();
  const id = r.externalId ?? r.productId!;
  const qty = cart.quantityOf(r.chain, id);
  const line = cart.items.find((i) => i.chain === r.chain && (i.externalId === id || i.productId === id));
  const price = r.salePriceCents ?? r.priceCents;
  return (
    <li className="flex gap-3 p-3 items-center">
      <div className="w-16 h-16 shrink-0 rounded-xl bg-white grid place-items-center overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {r.imageUrl ? <img src={r.imageUrl} alt="" className="max-w-full max-h-full object-contain" loading="lazy" /> : <span className="text-2xl" aria-hidden>🛒</span>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold leading-snug">{r.name}</p>
        <p className="text-sm text-muted">{[r.size, r.brand].filter(Boolean).join(" · ")}</p>
        <p className="mt-0.5">
          {r.estimated && price != null && <span className="text-muted">about </span>}
          <b>{price != null ? money(price) : "Price at store"}</b>
          {r.inStock === false && <span className="ml-2 text-sm font-bold text-danger">Out of stock online</span>}
          {r.salePriceCents != null && <s className="text-muted text-sm ml-2">{money(r.priceCents)}</s>}
        </p>
      </div>
      {qty > 0 && line ? (
        <QtyStepper value={qty} onChange={(n) => cart.setQuantity(line.key, n)} label={r.name} />
      ) : (
        <button className="btn btn-ghost !px-4" onClick={() => cart.add({
          chain: r.chain, externalId: r.externalId, productId: r.productId, name: r.name,
          size: r.size, imageUrl: r.imageUrl, unitPriceCents: price,
        })}>Add</button>
      )}
    </li>
  );
}

const STARTERS = ["Milk", "Eggs", "Bread", "Bananas", "Chicken breast", "Coffee", "Paper towels", "Cereal"];

/** Shown before the customer types: what they've ordered before, then what's popular. */
function Suggestions({ chain, primary, onSearch }: { chain: Chain; primary: Chain; onSearch: (q: string) => void }) {
  const [data, setData] = useState<{ chain: Chain; buyAgain: SearchResult[]; popular: SearchResult[] } | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/suggestions?chain=${chain}&primary=${primary}`)
      .then((r) => (r.ok ? r.json() : { buyAgain: [], popular: [] }))
      .then((j) => { if (live) setData({ chain, buyAgain: j.buyAgain ?? [], popular: j.popular ?? [] }); })
      .catch(() => { if (live) setData({ chain, buyAgain: [], popular: [] }); });
    return () => { live = false; };
  }, [chain, primary]);

  const ready = data?.chain === chain;
  const section = (title: string, items: SearchResult[]) => items.length > 0 && (
    <section className="space-y-2">
      <h2 className="text-xl font-extrabold">{title}</h2>
      <ul className="divide-y divide-line bg-card border border-line rounded-3xl overflow-hidden">
        {items.map((r) => <ResultRow key={r.externalId ?? r.productId} r={r} />)}
      </ul>
    </section>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2" aria-label="Quick searches">
        {STARTERS.map((t) => (
          <button key={t} className="rounded-full border-[1.5px] border-line bg-card px-4 py-2 font-bold hover:border-shell" onClick={() => onSearch(t)}>{t}</button>
        ))}
      </div>
      {!ready && <p className="text-muted">Loading your usuals…</p>}
      {ready && section("Buy again", data.buyAgain)}
      {ready && section(data.buyAgain.length ? `Popular at ${CHAIN_NAME[chain]}` : `Popular with Speedy Turtle customers`, data.popular)}
    </div>
  );
}
