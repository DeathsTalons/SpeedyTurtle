import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { orderDetail } from "@/lib/admin-records";
import { money } from "@/lib/money";
import { formatStamp } from "@/lib/format";
import { PAYMENT } from "@/lib/order-status";
import { subLabel } from "@/lib/shopping";
import { stripeDashboard } from "@/lib/stripe";
import { StatusPill, when } from "../../records-ui";
import { RefundItem } from "./refund-item";

export const metadata = { title: "Order · Admin" };

/* eslint-disable @typescript-eslint/no-explicit-any */
const ITEM_STATUS: Record<string, string> = { pending: "Not shopped", found: "Found", substituted: "Swapped", out_of_stock: "Out of stock" };

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return <div className={`flex justify-between gap-4 ${strong ? "font-bold text-lg border-t border-line pt-2" : ""}`}><span className={strong ? "" : "text-muted"}>{label}</span><span className="text-right">{value}</span></div>;
}

/** What a refund for this item would probably be: its price × how many you got, minus anything already refunded. */
function suggestedRefund(i: any): number | null {
  const each = i.actual_price_cents ?? i.unit_price_cents_snapshot;
  if (each == null) return null;
  const qty = Number(i.found_quantity ?? i.quantity);
  const left = Math.round(each * qty) - (i.refunded_cents ?? 0);
  return left > 0 ? left : null;
}

function StripeLink({ id, label }: { id: string | null; label: string }) {
  if (!id) return null;
  return <a className="underline" href={stripeDashboard(`payments/${id}`)} target="_blank" rel="noreferrer">{label}</a>;
}

export default async function AdminOrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  const { db } = await requireAdmin();
  const { id } = await params;
  const d = await orderDetail(db, id);
  if (!d) notFound();
  const { o, customer, address, slot, kroger, meijer, items, money: m } = d;
  const pay = PAYMENT[o.payment_status ?? "none"] ?? { label: o.payment_status, tone: "" };
  const net = (o.captured_cents ?? 0) - (o.refunded_cents ?? 0);
  const active = items.filter((i: any) => !i.removed);
  // Item refunds open up once the receipt total is saved (the order is charged).
  const canRefund = m.final && o.status !== "canceled";
  const removed = items.filter((i: any) => i.removed);

  return (
    <div className="space-y-6">
      <Link href="/admin/orders" className="text-sm font-bold underline">← All orders</Link>

      <header className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-60">
          <h1 className="text-3xl font-extrabold">{when({ date: o.delivery_date, start: slot?.start_time ?? null, end: slot?.end_time ?? null, asap: o.asap })}</h1>
          <p className="text-lg">
            <Link href={`/admin/customers/${o.customer_id}`} className="font-bold underline">{customer?.full_name || "Customer"}</Link>
            {customer?.phone && <> · <a href={`sms:${customer.phone}`} className="underline">{customer.phone}</a></>}
          </p>
          <p className="text-xs text-muted">Order {o.id.slice(0, 8)} · placed {formatStamp(o.created_at)}</p>
        </div>
        <StatusPill status={o.status} />
      </header>

      {o.payment_error && <p role="alert" className="bg-amber-soft rounded-2xl p-4 font-bold text-danger">{o.payment_error}</p>}

      <section className="grid md:grid-cols-2 gap-3">
        <div className="bg-card border border-line rounded-3xl p-5 space-y-1">
          <h2 className="text-xl font-extrabold mb-1">Delivery</h2>
          {address ? (
            <>
              <p className="font-bold">{address.line1}{address.line2 ? `, ${address.line2}` : ""}</p>
              <p className="text-muted">{address.city}, IN {address.zip}</p>
              {address.delivery_notes && <p>“{address.delivery_notes}”</p>}
            </>
          ) : <p className="text-muted">No address</p>}
          <p className="pt-2"><span className="text-muted">Stores:</span> {[kroger?.name, meijer?.name].filter(Boolean).join(" + ") || "—"}</p>
          {o.store_reassigned_at && <p className="text-sm text-muted">Store changed by hand {formatStamp(o.store_reassigned_at)}</p>}
          {o.customer_notes && <p className="pt-2"><span className="text-muted">Customer note:</span> “{o.customer_notes}”</p>}
        </div>

        <div className="bg-card border border-line rounded-3xl p-5 space-y-1.5">
          <h2 className="text-xl font-extrabold mb-1">Money</h2>
          <Row label={o.final_subtotal_cents == null ? "Groceries (estimate)" : "Groceries (receipts)"} value={money(m.groceries)} />
          {o.final_subtotal_cents != null && <Row label="Estimate was" value={money(o.estimated_subtotal_cents)} />}
          {o.receipt_kroger_cents != null && <Row label="Kroger receipt" value={money(o.receipt_kroger_cents)} />}
          {o.receipt_meijer_cents != null && <Row label="Meijer receipt" value={money(o.receipt_meijer_cents)} />}
          <Row label={`Service fee · ${o.unique_item_count} items`} value={money(o.service_fee_cents)} />
          {o.second_store_fee_cents > 0 && <Row label="Second store" value={money(o.second_store_fee_cents)} />}
          <Row label="Tip at checkout" value={money(o.tip_cents)} />
          {o.later_tip_cents > 0 && <Row label={`Tip after delivery (${formatStamp(o.later_tip_at)})`} value={money(o.later_tip_cents)} />}
          {o.item_refunds_cents > 0 && <Row label="Refunded items" value={<span className="text-danger">−{money(o.item_refunds_cents)}</span>} />}
          <Row strong label={m.final ? "Total" : "Estimated total"} value={money(m.total)} />
          <Row label="You made (fees + tips)" value={<b className="text-shell">{m.final && o.status !== "canceled" ? money(m.earned) : "—"}</b>} />
        </div>
      </section>

      <section className="bg-card border border-line rounded-3xl p-5 space-y-1.5">
        <h2 className="text-xl font-extrabold mb-1">Card</h2>
        <Row label="Status" value={<b className={pay.tone}>{pay.label}</b>} />
        <Row label="Hold amount" value={money(o.authorized_amount_cents)} />
        {o.authorized_at && <Row label="Hold placed" value={formatStamp(o.authorized_at)} />}
        {o.captured_cents != null && <Row label="Charged" value={money(o.captured_cents)} />}
        {o.refunded_cents > 0 && <Row label="Refunded" value={money(o.refunded_cents)} />}
        {o.captured_cents != null && <Row label="Net for groceries + fees" value={money(net)} />}
        {o.dispute_status && <Row label="Dispute" value={<b className="text-danger">{o.dispute_status}</b>} />}
        <div className="flex flex-wrap gap-4 pt-2 text-sm font-bold">
          <StripeLink id={o.stripe_payment_intent_id} label="Main charge in Stripe" />
          <StripeLink id={o.extra_charge_payment_intent_id} label="Extra charge in Stripe" />
          <StripeLink id={o.later_tip_payment_intent_id} label="Tip charge in Stripe" />
          {customer?.stripe_customer_id && <a className="underline" href={stripeDashboard(`customers/${customer.stripe_customer_id}`)} target="_blank" rel="noreferrer">Customer in Stripe</a>}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-extrabold">Items <span className="text-muted text-base font-normal">· {active.length}</span></h2>
        <ul className="bg-card border border-line rounded-3xl divide-y divide-line">
          {active.map((i: any) => (
            <li key={i.id} className="p-3 flex gap-3">
              <span className="font-bold w-14 shrink-0">
                {Number(i.quantity)}×
                {i.found_quantity != null && Number(i.found_quantity) !== Number(i.quantity) && <span className="block text-xs text-danger">got {Number(i.found_quantity)}</span>}
              </span>
              <div className="flex-1 min-w-0">
                <span className={`text-xs font-bold uppercase tag-${i.chain}`}>{i.chain}</span>{i.added_by_shopper && <span className="text-xs font-bold text-amber"> · added by you</span>}
                <span className="block font-bold">{i.name_snapshot}</span>
                <span className="block text-sm text-muted">If out: {subLabel(i.sub_choice)}{i.approved_subs?.length ? ` (${i.approved_subs.map((x: any) => x.name).join(", ")})` : ""}</span>
                {i.item_note && <span className="block text-sm">Customer: “{i.item_note}”</span>}
                {i.substitute_name && <span className="block text-sm">Swapped for <b>{i.substitute_name}</b></span>}
                {i.shopper_note && <span className="block text-sm">Your note: {i.shopper_note}</span>}
                {i.refunded_cents > 0 && (
                  <span className="block text-sm font-bold text-danger">Refunded {money(i.refunded_cents)}{i.refund_note ? ` · ${i.refund_note}` : ""}</span>
                )}
                {canRefund && i.status !== "out_of_stock" && (
                  <RefundItem orderId={o.id} itemId={i.id} name={i.substitute_name || i.name_snapshot} suggestedCents={suggestedRefund(i)} />
                )}
              </div>
              <span className="text-sm text-right shrink-0">
                <span className="block font-bold">{ITEM_STATUS[i.status] ?? i.status}</span>
                {i.unit_price_cents_snapshot != null ? money(i.unit_price_cents_snapshot * Number(i.quantity)) : "Shelf price"}
                {i.actual_price_cents != null && <span className="block text-muted">swap {money(i.actual_price_cents)} ea</span>}
              </span>
            </li>
          ))}
        </ul>
        {removed.length > 0 && (
          <details className="bg-card border border-line rounded-2xl p-3">
            <summary className="font-bold cursor-pointer">{removed.length} removed {removed.length === 1 ? "item" : "items"}</summary>
            <ul className="pt-2 text-sm text-muted">{removed.map((i: any) => <li key={i.id}>{Number(i.quantity)}× {i.name_snapshot}</li>)}</ul>
          </details>
        )}
      </section>

      <p className="text-xs text-muted">
        Last updated {formatStamp(o.updated_at)}{o.finalized_at ? ` · receipt saved ${formatStamp(o.finalized_at)}` : ""}
        {o.batch_id && <> · <Link href={`/admin/shop/${o.batch_id}`} className="underline">shopping trip</Link></>}
      </p>
    </div>
  );
}
