"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelMyOrder } from "./actions";

export function CancelOrder({ orderId, held }: { orderId: string; held: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const cancel = () => {
    if (!window.confirm(`Cancel this order?${held ? " The hold on your card will be released." : ""} This can't be undone.`)) return;
    setError("");
    start(async () => {
      const r = await cancelMyOrder(orderId);
      if (r.error) setError(r.error);
      else router.refresh();
    });
  };
  return (
    <div className="space-y-1">
      <button className="btn btn-ghost !text-danger" onClick={cancel} disabled={pending}>{pending ? "Canceling…" : "Cancel order"}</button>
      <p className="text-sm text-muted">Free to cancel until I start shopping.</p>
      {error && <p role="alert" className="text-danger font-bold">{error}</p>}
    </div>
  );
}
