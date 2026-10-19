"use client";
// Customer picks specific products that are OK if their item is out.
import { useEffect, useRef, useState } from "react";
import { money, type Chain } from "@/lib/cart";
import { MAX_APPROVED_SUBS, type ApprovedSub } from "@/lib/shopping";
import type { SearchResult } from "@/app/api/search/route";

export function SubPicker({ itemName, chain, primary, initial, onSave, onClose }: {
  itemName: string; chain: Chain; primary: Chain; initial: ApprovedSub[];
  onSave: (subs: ApprovedSub[]) => void; onClose: () => void;
}) {
  const [picked, setPicked] = useState<ApprovedSub[]>(initial);
  const [q, setQ] = useState(itemName.split(",")[0].slice(0, 40));
  const [results, setResults] = useState<SearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    const term = q.trim();
    const id = ++reqId.current;
    if (term.length < 2) return;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await fetch(`/api/search?chain=${chain}&primary=${primary}&q=${encodeURIComponent(term)}`);
        const json = await res.json();
        if (id === reqId.current) setResults(res.ok ? json.results : []);
      } finally { if (id === reqId.current) setBusy(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [q, chain, primary]);

  const has = (r: SearchResult) => picked.some((p) => p.externalId === r.externalId);
  const toggle = (r: SearchResult) =>
    setPicked((ps) => has(r) ? ps.filter((p) => p.externalId !== r.externalId)
      : ps.length >= MAX_APPROVED_SUBS ? ps
      : [...ps, { name: r.name, externalId: r.externalId, upc: r.upc ?? null, priceCents: r.salePriceCents ?? r.priceCents }]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-3" role="dialog" aria-modal="true" aria-label="Pick OK substitutes" onClick={onClose}>
      <div className="bg-card rounded-3xl p-5 w-full max-w-lg max-h-[90vh] flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-extrabold">OK substitutes for {itemName}</h2>
        <p className="text-sm text-muted">Pick up to {MAX_APPROVED_SUBS}. If yours is out, Cody grabs the first one he finds.</p>
        {picked.length > 0 && (
          <ol className="flex flex-wrap gap-2">
            {picked.map((p, i) => (
              <li key={p.externalId ?? p.name} className="bg-amber-soft rounded-full pl-3 pr-1 py-1 flex items-center gap-1 text-sm font-bold">
                {i + 1}. {p.name}
                <button className="w-7 h-7 rounded-full hover:bg-white" aria-label={`Remove ${p.name}`} onClick={() => setPicked((ps) => ps.filter((x) => x !== p))}>×</button>
              </li>
            ))}
          </ol>
        )}
        <label htmlFor="sub-search" className="sr-only">Search substitutes</label>
        <input id="sub-search" className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search for a substitute" autoFocus />
        <ul className="overflow-y-auto divide-y divide-line border border-line rounded-2xl min-h-24">
          {busy && results.length === 0 && <li className="p-3 text-muted">Searching…</li>}
          {results.map((r) => (
            <li key={r.externalId ?? r.productId} className="flex items-center gap-3 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {r.imageUrl ? <img src={r.imageUrl} alt="" className="w-12 h-12 object-contain bg-white rounded-lg" /> : <div className="w-12 h-12 bg-paper rounded-lg" />}
              <div className="flex-1 min-w-0">
                <p className="font-bold leading-snug text-sm">{r.name}</p>
                <p className="text-sm text-muted">{r.estimated ? "about " : ""}{money(r.salePriceCents ?? r.priceCents)}</p>
              </div>
              <button className={`btn !px-4 !min-h-10 ${has(r) ? "btn-primary" : "btn-ghost"}`} onClick={() => toggle(r)}
                disabled={!has(r) && picked.length >= MAX_APPROVED_SUBS}>
                {has(r) ? "✓ OK" : "OK"}
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <button className="btn btn-ghost flex-1" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary flex-1" onClick={() => onSave(picked)}>Save {picked.length ? `${picked.length} ` : ""}substitute{picked.length === 1 ? "" : "s"}</button>
        </div>
      </div>
    </div>
  );
}
