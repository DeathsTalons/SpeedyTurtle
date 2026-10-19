"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addOrdersToBatch } from "../../actions";

export function AddOrders({ batchId, options }: { batchId: string; options: { id: string; label: string }[] }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const router = useRouter();
  if (options.length === 0) return <p className="text-sm text-muted">No other orders waiting to add.</p>;
  return (
    <details className="bg-card border border-line rounded-2xl p-3">
      <summary className="font-bold cursor-pointer">+ Add {options.length === 1 ? "an order" : "orders"} to this trip ({options.length} waiting)</summary>
      <div className="pt-3 space-y-2">
        {options.map((o) => (
          <label key={o.id} className="flex items-center gap-2">
            <input type="checkbox" className="w-5 h-5" checked={picked.includes(o.id)}
              onChange={(e) => setPicked((p) => (e.target.checked ? [...p, o.id] : p.filter((x) => x !== o.id)))} />
            {o.label}
          </label>
        ))}
        <button className="btn btn-primary" disabled={!picked.length || pending}
          onClick={() => start(async () => { await addOrdersToBatch(batchId, picked); setPicked([]); router.refresh(); })}>
          Add {picked.length || ""} to trip
        </button>
      </div>
    </details>
  );
}
