"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/cart";
import { sameUpc, sortForWalk, subLabel } from "@/lib/shopping";
import type { BatchLine, BatchOrder } from "@/lib/admin-data";
import { addItem, finishBatch, removeOrderFromBatch, setAisle, updateItem } from "../../actions";
import { Scanner } from "../scanner";

type Line = BatchLine;
type Dialog =
  | { kind: "swap"; line: Line; upc?: string }
  | { kind: "add"; order: BatchOrder; chain: "kroger" | "meijer" }
  | { kind: "aisle"; line: Line }
  | { kind: "choose"; code: string; matches: Line[] }
  | { kind: "mismatch"; line: Line; code: string }
  | { kind: "learn"; line: Line; code: string }
  | null;

const smsLink = (phone: string | null, body: string) => (phone ? `sms:${phone}?&body=${encodeURIComponent(body)}` : null);
const done = (l: Line) => l.removed || l.status !== "pending";

export function ShoppingList({ batchId, orders, initialLines }: { batchId: string; orders: BatchOrder[]; initialLines: Line[] }) {
  const router = useRouter();
  const [lines, setLines] = useState(initialLines);
  const stores = useMemo(() => [...new Map(lines.map((l) => [l.storeName, l.storeId])).entries()], [lines]);
  const [store, setStore] = useState(stores[0]?.[0] ?? "");
  const [hideDone, setHideDone] = useState(false);
  const [scan, setScan] = useState<{ target: Line | null } | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [toast, setToast] = useState("");
  const [pending, start] = useTransition();

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3500); };

  /** Update one line on screen right away, then save. Puts it back if saving fails. */
  const save = (line: Line, patch: Partial<Line>, server: Parameters<typeof updateItem>[1]) => {
    const before = lines.find((l) => l.id === line.id)!;
    setLines((ls) => ls.map((l) => (l.id === line.id ? { ...l, ...patch } : l)));
    start(async () => {
      try { await updateItem(line.id, server); }
      catch (e) { setLines((ls) => ls.map((l) => (l.id === line.id ? before : l))); flash(`Didn't save: ${(e as Error).message}`); }
    });
  };

  const markFound = (l: Line, code?: string) =>
    save(l, { status: "found", foundQuantity: l.quantity, scannedUpc: code ?? l.scannedUpc, upc: l.upc ?? code ?? null },
      { status: "found", foundQuantity: l.quantity, ...(code ? { scannedUpc: code } : {}) });
  const markOut = (l: Line) => save(l, { status: "out_of_stock", foundQuantity: 0 }, { status: "out_of_stock", foundQuantity: 0 });
  const undo = (l: Line) => save(l, { status: "pending", foundQuantity: null, substituteName: null, scannedUpc: null, removed: false },
    { status: "pending", foundQuantity: null, substituteName: null, scannedUpc: null, removed: false });
  const remove = (l: Line) => { if (window.confirm(`Remove ${l.name} from ${l.firstName}'s order?`)) save(l, { removed: true }, { removed: true }); };
  const setFoundQty = (l: Line, n: number) => save(l, { foundQuantity: n }, { foundQuantity: n });

  // ── Scanning ──
  const onScan = (code: string) => {
    const target = scan?.target ?? null;
    setScan(null);
    const pool = lines.filter((l) => l.storeName === store && !done(l));
    const approvedMatch = (l: Line) => l.approvedSubs.find((a) => sameUpc(a.upc, code));
    const swapTo = (l: Line, a: Line["approvedSubs"][number]) => {
      save(l, { status: "substituted", substituteName: a.name, scannedUpc: code }, { status: "substituted", substituteName: a.name, scannedUpc: code, actualPrice: a.priceCents != null ? (a.priceCents / 100).toFixed(2) : null });
      flash(`↔ ${a.name} for ${l.firstName} (approved swap)`);
    };
    if (target) {
      if (sameUpc(target.upc, code)) { markFound(target, code); flash(`✓ ${target.name} for ${target.firstName}`); return; }
      const ok = approvedMatch(target);
      if (ok) { swapTo(target, ok); return; }
      if (!target.upc) { setDialog({ kind: "learn", line: target, code }); return; }
      setDialog({ kind: "mismatch", line: target, code });
      return;
    }
    const matches = pool.filter((l) => sameUpc(l.upc, code));
    if (matches.length === 0) {
      const subFor = pool.find((l) => approvedMatch(l));
      if (subFor) { swapTo(subFor, approvedMatch(subFor)!); return; }
    }
    if (matches.length === 1) { markFound(matches[0], code); flash(`✓ ${matches[0].name} for ${matches[0].firstName}`); }
    else if (matches.length > 1) setDialog({ kind: "choose", code, matches });
    else flash(`That barcode (${code}) isn't on anyone's list here. Scan from an item's own Scan button to match it by hand.`);
  };

  // ── What's on screen ──
  const storeLines = lines.filter((l) => l.storeName === store);
  const visible = sortForWalk(storeLines.filter((l) => !(hideDone && done(l))).map((l) => ({ ...l, sortKey: l.aisleSort, bay: l.aisleBay })));
  const groups: [string, Line[]][] = [];
  for (const l of visible) {
    const key = l.aisle ?? "No aisle yet";
    const last = groups[groups.length - 1];
    if (last && last[0] === key) last[1].push(l); else groups.push([key, [l]]);
  }
  const doneCount = storeLines.filter(done).length;
  const remaining = lines.filter((l) => !done(l)).length;
  const storeIdFor = (l: Line) => l.storeId;

  return (
    <div className="space-y-4 pb-28">
      {/* Customers in this batch */}
      <div className="flex flex-wrap gap-2">
        {orders.map((o) => {
          const mine = lines.filter((l) => l.orderId === o.id);
          return (
            <div key={o.id} className="rounded-2xl border-2 bg-card px-3 py-2 flex items-center gap-2" style={{ borderColor: o.color }}>
              <span className="w-3 h-3 rounded-full" style={{ background: o.color }} aria-hidden />
              <span className="font-bold">{o.customer}</span>
              <span className="text-sm text-muted">{mine.filter(done).length}/{mine.length}</span>
              <details className="relative">
                <summary className="cursor-pointer text-sm font-bold underline list-none">More</summary>
                <div className="absolute z-30 mt-2 right-0 w-64 bg-card border border-line rounded-2xl p-3 shadow-lg space-y-2 text-sm">
                  {o.customerNotes && <p><b>Order note:</b> {o.customerNotes}</p>}
                  {o.phone && <a className="block underline font-bold" href={`sms:${o.phone}`}>Text {o.customer.split(" ")[0]}</a>}
                  {o.krogerStoreId && <button className="block underline font-bold" onClick={() => setDialog({ kind: "add", order: o, chain: "kroger" })}>Add Kroger item</button>}
                  {o.meijerStoreId && <button className="block underline font-bold" onClick={() => setDialog({ kind: "add", order: o, chain: "meijer" })}>Add Meijer item</button>}
                  <button className="block underline text-danger" onClick={() => { if (window.confirm(`Take ${o.customer}'s order out of this trip?`)) start(async () => { await removeOrderFromBatch(batchId, o.id); router.refresh(); }); }}>
                    Take out of this trip
                  </button>
                </div>
              </details>
            </div>
          );
        })}
      </div>

      {stores.length > 1 && (
        <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Store">
          {stores.map(([name]) => {
            const left = lines.filter((l) => l.storeName === name && !done(l)).length;
            return (
              <button key={name} role="tab" aria-selected={store === name} onClick={() => setStore(name)}
                className={`rounded-2xl border-2 p-3 font-bold text-left ${store === name ? "border-shell bg-card" : "border-line text-muted"}`}>
                {name}<span className="block text-sm font-normal">{left} left</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="flex-1 h-3 rounded-full bg-line overflow-hidden" aria-hidden>
          <div className="h-full bg-shell" style={{ width: `${storeLines.length ? (doneCount / storeLines.length) * 100 : 0}%` }} />
        </div>
        <span className="text-sm font-bold">{doneCount}/{storeLines.length}</span>
        <label className="text-sm flex items-center gap-1"><input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} /> Hide done</label>
      </div>

      {groups.map(([aisle, items]) => (
        <section key={aisle + items[0].id}>
          <h2 className="sticky top-16 z-10 bg-paper/95 py-1 font-extrabold text-lg">{aisle}</h2>
          <ul className="space-y-2">
            {items.map((l) => (
              <li key={l.id} className={`bg-card rounded-2xl border border-line border-l-[6px] p-3 ${done(l) ? "opacity-60" : ""}`} style={{ borderLeftColor: l.color }}>
                <div className="flex gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {l.imageUrl ? <img src={l.imageUrl} alt="" className="w-14 h-14 object-contain bg-white rounded-lg shrink-0" /> : <div className="w-14 h-14 rounded-lg bg-paper shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold" style={{ color: l.color }}>{l.firstName}{l.addedByShopper && " · added by you"}</p>
                    <p className={`font-bold leading-snug ${l.removed ? "line-through" : ""}`}>
                      <span className="text-xl mr-1">{l.quantity}×</span>{l.name}
                      {l.freeText && !l.addedByShopper && <span className="ml-2 text-xs bg-amber-soft px-2 py-0.5 rounded-full align-middle">Request</span>}
                    </p>
                    <p className="text-sm text-muted">
                      {l.priceCents != null ? `${money(l.priceCents)} ea` : "Shelf price"} · If out: <b className="text-ink">{subLabel(l.subChoice)}</b>
                    </p>
                    {l.approvedSubs.length > 0 && <p className="text-sm mt-1">OK swaps: {l.approvedSubs.map((a, n) => `${n + 1}. ${a.name}`).join("  ")}</p>}
                    {l.note && <p className="text-sm bg-amber-soft rounded-lg px-2 py-1 mt-1">“{l.note}”</p>}
                    <button className="text-sm underline mt-1" onClick={() => setDialog({ kind: "aisle", line: l })}>
                      {l.aisle ? `${l.aisle}${l.aisleDetail ? ` · ${l.aisleDetail}` : ""}${l.aisleSource === "kroger" ? " (Kroger)" : l.aisleSource === "meijer" ? " (Meijer)" : ""} · change` : "Set aisle"}
                    </button>
                  </div>
                </div>

                {done(l) ? (
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span className="font-bold">
                      {l.removed ? "Removed" : l.status === "found" ? `✓ Found${l.scannedUpc ? " (scanned)" : ""}` : l.status === "substituted" ? `Swapped → ${l.substituteName}` : "Out of stock"}
                    </span>
                    {l.status === "found" && l.quantity > 1 && (
                      <label className="text-sm">Got
                        <input type="number" min={0} max={l.quantity} value={l.foundQuantity ?? l.quantity} className="field !inline-block !w-16 !min-h-0 !py-1 mx-1"
                          onChange={(e) => setFoundQty(l, Math.max(0, Math.min(l.quantity, Number(e.target.value))))} />
                        of {l.quantity}
                      </label>
                    )}
                    <button className="underline text-sm ml-auto" onClick={() => undo(l)}>Undo</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2 mt-3">
                    <button className="btn btn-primary !px-2" onClick={() => setScan({ target: l })}>Scan</button>
                    <button className="btn btn-ghost !px-2" onClick={() => markFound(l)}>Found</button>
                    <button className="btn btn-ghost !px-2" onClick={() => setDialog({ kind: "swap", line: l })}>Swap</button>
                    <button className="btn btn-ghost !px-2" onClick={() => markOut(l)}>Out</button>
                    <button className="col-span-4 text-sm underline text-muted justify-self-end" onClick={() => remove(l)}>Remove from order</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {/* Bottom bar */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-card/95 border-t border-line p-3">
        <div className="max-w-3xl mx-auto flex gap-2">
          <button className="btn btn-primary flex-1 text-lg" onClick={() => setScan({ target: null })}>Scan an item</button>
          <button className="btn btn-ghost" disabled={pending}
            onClick={() => { if (remaining === 0 || window.confirm(`${remaining} ${remaining === 1 ? "item hasn't" : "items haven't"} been checked off. Finish anyway?`)) start(() => finishBatch(batchId)); }}>
            Done shopping
          </button>
        </div>
      </div>

      {toast && <div role="status" className="fixed bottom-24 inset-x-4 z-40 mx-auto max-w-md bg-ink text-white rounded-2xl p-3 text-center font-bold">{toast}</div>}

      {scan && <Scanner title={scan.target ? `Scan ${scan.target.name}` : "Scan any item on the list"} onCode={onScan} onClose={() => setScan(null)} />}

      {dialog && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-3" role="dialog" aria-modal="true" onClick={() => setDialog(null)}>
          <div className="bg-card rounded-3xl p-5 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            {dialog.kind === "swap" && <SwapForm line={dialog.line} upc={dialog.upc} onCancel={() => setDialog(null)}
              onSave={(name, price) => { const l = dialog.line; setDialog(null); save(l, { status: "substituted", substituteName: name, scannedUpc: dialog.upc ?? null }, { status: "substituted", substituteName: name, actualPrice: price, scannedUpc: dialog.upc ?? null }); }} />}

            {dialog.kind === "add" && <AddForm order={dialog.order} chain={dialog.chain} onCancel={() => setDialog(null)}
              onSave={(f) => { const o = dialog.order; setDialog(null); start(async () => { try { await addItem(o.id, { chain: dialog.chain, ...f }); router.refresh(); flash(`Added ${f.name} for ${o.customer.split(" ")[0]}`); } catch (e) { flash((e as Error).message); } }); }} />}

            {dialog.kind === "aisle" && <AisleForm line={dialog.line} onCancel={() => setDialog(null)}
              onSave={(aisle, detail) => {
                const l = dialog.line; setDialog(null);
                // Same product for other customers in this store gets the aisle too.
                setLines((ls) => ls.map((x) => (x.id === l.id || (l.productId && x.productId === l.productId && x.storeId === l.storeId) ? { ...x, aisle: aisle || null, aisleDetail: detail || null, aisleSort: null, aisleBay: null, aisleSource: aisle ? "cody" : null } : x)));
                start(async () => { try { await setAisle(l.id, storeIdFor(l), aisle, detail); } catch (e) { flash((e as Error).message); } });
              }} />}

            {dialog.kind === "choose" && (
              <>
                <h2 className="text-xl font-extrabold">Who is this for?</h2>
                <p className="text-muted">{dialog.matches[0].name} is on {dialog.matches.length} lists.</p>
                <div className="grid gap-2">
                  {dialog.matches.map((m) => (
                    <button key={m.id} className="btn btn-ghost justify-start" style={{ borderColor: m.color }} onClick={() => { setDialog(null); markFound(m, dialog.code); }}>
                      {m.customer} · {m.quantity}×
                    </button>
                  ))}
                </div>
              </>
            )}

            {dialog.kind === "mismatch" && (
              <>
                <h2 className="text-xl font-extrabold text-danger">That&apos;s not {dialog.line.name}</h2>
                <p>The barcode doesn&apos;t match what {dialog.line.firstName} ordered.</p>
                <div className="grid gap-2">
                  <button className="btn btn-primary" onClick={() => setDialog({ kind: "swap", line: dialog.line, upc: dialog.code })}>Use it as a swap</button>
                  <button className="btn btn-ghost" onClick={() => { const l = dialog.line; setDialog(null); setScan({ target: l }); }}>Scan again</button>
                  <button className="btn btn-ghost" onClick={() => { const { line, code } = dialog; setDialog(null); markFound(line, code); }}>It&apos;s the right item (save this barcode)</button>
                </div>
              </>
            )}

            {dialog.kind === "learn" && (
              <>
                <h2 className="text-xl font-extrabold">No barcode on file yet</h2>
                <p>Is this {dialog.line.name}? The app will remember this barcode for next time.</p>
                <div className="grid gap-2">
                  <button className="btn btn-primary" onClick={() => { const { line, code } = dialog; setDialog(null); markFound(line, code); }}>Yes, mark found</button>
                  <button className="btn btn-ghost" onClick={() => setDialog({ kind: "swap", line: dialog.line, upc: dialog.code })}>No, it&apos;s a swap</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SwapForm({ line, upc, onSave, onCancel }: { line: Line; upc?: string; onSave: (name: string, price: string) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const ask = smsLink(line.phone, `Hi ${line.firstName}, it's Cody from Speedy Turtle. ${line.name} is out. ${name ? `Is ${name} OK instead?` : "Want me to grab something similar?"}`);
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSave(name.trim(), price); }}>
      <h2 className="text-xl font-extrabold">Swap {line.name}</h2>
      <p className="text-sm bg-paper rounded-xl p-2">
        {line.firstName} said: <b>{subLabel(line.subChoice)}</b>{line.note ? ` · “${line.note}”` : ""}
      </p>
      {upc && <p className="text-sm text-muted">Scanned barcode {upc}</p>}
      {line.approvedSubs.length > 0 && (
        <div className="space-y-2">
          <p className="label">{line.firstName} approved</p>
          {line.approvedSubs.map((a) => (
            <button type="button" key={a.externalId ?? a.name} className="btn btn-ghost w-full justify-between"
              onClick={() => onSave(a.name, a.priceCents != null ? (a.priceCents / 100).toFixed(2) : "")}>
              <span className="text-left">{a.name}</span><span>{a.priceCents != null ? money(a.priceCents) : ""}</span>
            </button>
          ))}
          <p className="text-sm text-muted">Or type something else:</p>
        </div>
      )}
      <div><label className="label" htmlFor="sub-name">What you&apos;re getting instead</label>
        <input id="sub-name" className="field" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Kroger 2% Milk, Gallon" /></div>
      <div><label className="label" htmlFor="sub-price">Shelf price <span className="font-normal text-muted">(optional)</span></label>
        <input id="sub-price" className="field" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="3.49" /></div>
      {ask && <a className="btn btn-ghost w-full" href={ask}>Text {line.firstName} to ask first</a>}
      <div className="flex gap-2"><button type="button" className="btn btn-ghost flex-1" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary flex-1" disabled={!name.trim()}>Save swap</button></div>
    </form>
  );
}

function AddForm({ order, chain, onSave, onCancel }: { order: BatchOrder; chain: "kroger" | "meijer"; onSave: (f: { name: string; quantity: number; price: string; note: string }) => void; onCancel: () => void }) {
  const [f, setF] = useState({ name: "", quantity: 1, price: "", note: "" });
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (f.name.trim()) onSave(f); }}>
      <h2 className="text-xl font-extrabold">Add a {chain === "kroger" ? "Kroger" : "Meijer"} item for {order.customer}</h2>
      <div><label className="label" htmlFor="add-name">Item</label>
        <input id="add-name" className="field" value={f.name} autoFocus onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label" htmlFor="add-qty">Qty</label>
          <input id="add-qty" className="field" type="number" min={1} max={99} value={f.quantity} onChange={(e) => setF({ ...f, quantity: Number(e.target.value) })} /></div>
        <div><label className="label" htmlFor="add-price">Price ea.</label>
          <input id="add-price" className="field" inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} placeholder="2.99" /></div>
      </div>
      <div><label className="label" htmlFor="add-note">Note <span className="font-normal text-muted">(optional)</span></label>
        <input id="add-note" className="field" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Asked by text" /></div>
      <div className="flex gap-2"><button type="button" className="btn btn-ghost flex-1" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary flex-1" disabled={!f.name.trim()}>Add item</button></div>
    </form>
  );
}

function AisleForm({ line, onSave, onCancel }: { line: Line; onSave: (aisle: string, detail: string) => void; onCancel: () => void }) {
  const [v, setV] = useState(line.aisle ?? "");
  const [detail, setDetail] = useState(line.aisleDetail ?? "");
  const quick = ["Produce", "Bakery", "Deli", "Meat", "Dairy", "Frozen"];
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSave(v.trim(), detail.trim()); }}>
      <h2 className="text-xl font-extrabold">Where is {line.name}?</h2>
      <p className="text-sm text-muted">Saved for {line.storeName}{line.freeText ? " (this order only, since it's a typed-in request)" : ", so next time it's already sorted"}.</p>
      <input className="field" value={v} onChange={(e) => setV(e.target.value)} autoFocus placeholder="Aisle 12" aria-label="Aisle" />
      <div className="flex flex-wrap gap-2">
        {quick.map((q) => <button type="button" key={q} className="rounded-full border border-line px-3 py-1" onClick={() => setV(q)}>{q}</button>)}
      </div>
      <input className="field" value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Shelf / spot (optional): left, top shelf, by the endcap" aria-label="Shelf or spot" />
      <div className="flex gap-2"><button type="button" className="btn btn-ghost flex-1" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary flex-1">Save</button></div>
    </form>
  );
}
