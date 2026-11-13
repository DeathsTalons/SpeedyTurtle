"use client";
import { useState, useTransition } from "react";
import { emailReceipt } from "../../actions";

export function EmailReceiptButton({ orderId, sentAt, enabled }: { orderId: string; sentAt: string | null; enabled: boolean }) {
  // sentAt arrives already formatted (Indiana time) from the server.
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  if (!enabled) return <p className="text-sm text-muted">Receipt emails are off until RESEND_API_KEY is added in Vercel.</p>;
  return (
    <>
      <button className="btn btn-ghost" disabled={pending} onClick={() => start(async () => {
        const r = await emailReceipt(orderId);
        setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: `Receipt emailed to ${r.to}.` });
      })}>{pending ? "Sending…" : sentAt ? "Email receipt again" : "Email receipt"}</button>
      {sentAt && !msg && <span className="text-sm text-muted">Last emailed {sentAt}</span>}
      {msg && <span role="status" className={`text-sm font-bold ${msg.ok ? "text-shell" : "text-danger"}`}>{msg.text}</span>}
    </>
  );
}
