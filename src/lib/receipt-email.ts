// The receipt email customers get once their order is charged and delivered.
// Sent through Resend from hello@redbirdgrocery.com (needs RESEND_API_KEY on the server).
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { BUSINESS } from "@/lib/business";
import { money } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { photoFiles, photosOf } from "@/lib/receipt-photos";

/* eslint-disable @typescript-eslint/no-explicit-any */
const db = () => supabaseAdmin() as any;
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const receiptEmailEnabled = () => !!process.env.RESEND_API_KEY?.trim();
const FROM = `${BUSINESS.name} <hello@redbirdgrocery.com>`;

type Line = { qty: string; name: string; status: string; refunded: number };
export type ReceiptData = {
  firstName: string; date: string; orderUrl: string;
  stores: { name: string; receiptCents: number | null; lines: Line[] }[];
  serviceFee: number; itemCount: number; secondStore: number; tip: number; laterTip: number; itemRefunds: number;
  total: number; charged: boolean; photoCount: number;
};

/** Everything the email shows, from the database. Exported so it can be previewed. */
export async function receiptData(orderId: string, siteUrl: string): Promise<{ data: ReceiptData; customerId: string; order: any } | null> {
  const { data: o } = await db().from("orders")
    .select("*, profiles(full_name), kroger:stores!orders_kroger_store_id_fkey(name), meijer:stores!orders_meijer_store_id_fkey(name), order_items(*)")
    .eq("id", orderId).maybeSingle();
  if (!o) return null;
  const items = ((o.order_items ?? []) as any[]).filter((i) => !i.removed);
  const lineOf = (i: any): Line => {
    const want = Number(i.quantity), got = i.found_quantity != null ? Number(i.found_quantity) : want;
    const status =
      i.status === "out_of_stock" ? "Out of stock (not charged)"
      : i.status === "substituted" ? `Swapped for ${i.substitute_name || "a similar item"}`
      : got < want ? `Got ${got} of ${want}` : "";
    return { qty: `${want}×`, name: i.name_snapshot, status, refunded: i.refunded_cents ?? 0 };
  };
  const stores = (["kroger", "meijer"] as const)
    .filter((c) => (c === "kroger" ? o.kroger_store_id : o.meijer_store_id))
    .map((c) => ({
      name: (one(c === "kroger" ? o.kroger : o.meijer) as any)?.name ?? (c === "kroger" ? "Kroger" : "Meijer"),
      receiptCents: c === "kroger" ? o.receipt_kroger_cents : o.receipt_meijer_cents,
      lines: items.filter((i) => i.chain === c).sort((a, b) => a.name_snapshot.localeCompare(b.name_snapshot)).map(lineOf),
    }));
  const total = (o.final_total_cents ?? 0) + (o.later_tip_cents ?? 0) - (o.item_refunds_cents ?? 0);
  return {
    customerId: o.customer_id,
    order: o,
    data: {
      firstName: ((one(o.profiles) as any)?.full_name || "there").split(" ")[0],
      date: formatDate(o.delivery_date, { weekday: "long", month: "long", day: "numeric" }),
      orderUrl: `${siteUrl.replace(/\/$/, "")}/orders/${o.id}`,
      stores,
      serviceFee: o.service_fee_cents, itemCount: o.unique_item_count, secondStore: o.second_store_fee_cents ?? 0,
      tip: o.tip_cents ?? 0, laterTip: o.later_tip_cents ?? 0, itemRefunds: o.item_refunds_cents ?? 0,
      total, charged: o.payment_status === "captured", photoCount: photosOf(o).length,
    },
  };
}

export function receiptSubject(d: ReceiptData) {
  return `Your Redbird Grocery receipt · ${d.date}`;
}

export function receiptHtml(d: ReceiptData): string {
  const green = "#1f5a40", ink = "#1d2a22", muted = "#5b6b61", line = "#dfe6dd";
  const row = (label: string, value: string, bold = false) =>
    `<tr><td style="padding:4px 0;color:${bold ? ink : muted};${bold ? "font-weight:700;font-size:17px;" : ""}">${label}</td>` +
    `<td style="padding:4px 0;text-align:right;color:${ink};${bold ? "font-weight:700;font-size:17px;" : ""}">${value}</td></tr>`;
  const storeBlocks = d.stores.map((s) => `
    <h2 style="margin:24px 0 8px;font-size:17px;color:${green}">${esc(s.name)}</h2>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:15px">
      ${s.lines.map((l) => `
        <tr><td style="padding:6px 8px 6px 0;vertical-align:top;font-weight:700;width:40px;border-top:1px solid ${line}">${esc(l.qty)}</td>
        <td style="padding:6px 0;border-top:1px solid ${line}">${esc(l.name)}${l.status ? `<br><span style="color:${muted};font-size:13px">${esc(l.status)}</span>` : ""}${l.refunded ? `<br><span style="color:${green};font-size:13px;font-weight:700">Refunded ${money(l.refunded)}</span>` : ""}</td></tr>`).join("")}
    </table>`).join("");

  return `<!doctype html><html><body style="margin:0;background:#f4f6f1;font-family:Arial,Helvetica,sans-serif;color:${ink}">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
    <tr><td style="background:${green};padding:20px 24px;color:#ffffff">
      <div style="font-size:22px;font-weight:800">Redbird <span style="color:#e8b04f">Grocery</span></div>
      <div style="font-size:15px;opacity:.9;margin-top:4px">Your receipt · ${esc(d.date)}</div>
    </td></tr>
    <tr><td style="padding:24px">
      <p style="margin:0 0 4px;font-size:16px">Hi ${esc(d.firstName)}, thanks for your order! Here&#39;s exactly what I got.</p>
      ${storeBlocks}
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;border-top:2px solid ${line};padding-top:8px;font-size:15px">
        ${d.stores.map((s) => row(`${esc(s.name)} receipt`, s.receiptCents != null ? money(s.receiptCents) : "—")).join("")}
        ${row(`Service fee (${d.itemCount} item${d.itemCount === 1 ? "" : "s"})`, money(d.serviceFee))}
        ${d.secondStore ? row("Second store", money(d.secondStore)) : ""}
        ${d.tip ? row("Tip", money(d.tip)) : ""}
        ${d.laterTip ? row("Tip after delivery", money(d.laterTip)) : ""}
        ${d.itemRefunds ? row("Refunded items", `−${money(d.itemRefunds)}`) : ""}
        ${row(d.charged ? "Total charged to your card" : "Total", money(d.total), true)}
      </table>
      <p style="margin:16px 0 0;font-size:14px;color:${muted}">You paid the store&#39;s receipt price, with no markups.${d.photoCount ? ` Photo${d.photoCount === 1 ? "" : "s"} of your store receipt${d.photoCount === 1 ? " is" : "s are"} attached.` : ""}</p>
      <p style="margin:24px 0 0"><a href="${esc(d.orderUrl)}" style="display:inline-block;background:${green};color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px">View your order</a></p>
      <p style="margin:24px 0 0;font-size:14px;color:${muted}">Something missing or damaged? Text me within 24 hours at ${esc(BUSINESS.phone)} and I&#39;ll refund it.</p>
    </td></tr>
    <tr><td style="padding:16px 24px;background:#f4f6f1;font-size:12px;color:${muted}">
      ${esc(BUSINESS.name)} · ${esc(BUSINESS.owner)} · ${esc(BUSINESS.phone)}<br>Independent local business. Not affiliated with Kroger or Meijer.
    </td></tr>
  </table></td></tr></table></body></html>`;
}

export function receiptText(d: ReceiptData): string {
  const out = [`Redbird Grocery receipt · ${d.date}`, "", `Hi ${d.firstName}, thanks for your order! Here's exactly what I got.`];
  for (const s of d.stores) {
    out.push("", s.name.toUpperCase());
    for (const l of s.lines) out.push(`  ${l.qty} ${l.name}${l.status ? `: ${l.status}` : ""}${l.refunded ? `, refunded ${money(l.refunded)}` : ""}`);
  }
  out.push("");
  for (const s of d.stores) out.push(`${s.name} receipt: ${s.receiptCents != null ? money(s.receiptCents) : "-"}`);
  out.push(`Service fee (${d.itemCount} items): ${money(d.serviceFee)}`);
  if (d.secondStore) out.push(`Second store: ${money(d.secondStore)}`);
  if (d.tip) out.push(`Tip: ${money(d.tip)}`);
  if (d.laterTip) out.push(`Tip after delivery: ${money(d.laterTip)}`);
  if (d.itemRefunds) out.push(`Refunded items: -${money(d.itemRefunds)}`);
  out.push(`${d.charged ? "Total charged to your card" : "Total"}: ${money(d.total)}`, "");
  if (d.photoCount) out.push("Photos of your store receipts are attached.");
  out.push(`View your order: ${d.orderUrl}`, "", `Something missing or damaged? Text me within 24 hours at ${BUSINESS.phone} and I'll refund it.`);
  return out.join("\n");
}

/** Send (or re-send) the receipt email. Records when it went out. */
export async function sendReceiptEmail(orderId: string, siteUrl: string): Promise<{ ok: true; to: string } | { ok: false; error: string }> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return { ok: false, error: "Receipt emails aren't set up yet: add RESEND_API_KEY in Vercel." };
  const r = await receiptData(orderId, siteUrl);
  if (!r) return { ok: false, error: "Order not found." };
  if (r.order.final_total_cents == null) return { ok: false, error: "Save the receipt total first." };
  const { data: u } = await db().auth.admin.getUserById(r.customerId);
  const to = u?.user?.email;
  if (!to) return { ok: false, error: "This customer has no email address on file." };

  const attachments = await photoFiles(photosOf(r.order));
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM, to: [to], reply_to: BUSINESS.email,
      subject: receiptSubject(r.data), html: receiptHtml(r.data), text: receiptText(r.data),
      attachments: attachments.length ? attachments : undefined,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, error: `Email didn't send (${res.status}). ${body.slice(0, 200)}` };
  }
  await db().from("orders").update({ receipt_emailed_at: new Date().toISOString() }).eq("id", orderId);
  return { ok: true, to };
}
