// Push notifications to Cody's phone (new orders, cancellations, tips).
// Needs VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY on the server; without them nothing is sent.
import "server-only";
import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { BUSINESS } from "@/lib/business";
import { money } from "@/lib/money";
import { formatDate } from "@/lib/format";

/* eslint-disable @typescript-eslint/no-explicit-any */
const db = () => supabaseAdmin() as any;

export const vapidPublicKey = () => process.env.VAPID_PUBLIC_KEY?.trim() || null;
export const pushEnabled = () => !!(vapidPublicKey() && process.env.VAPID_PRIVATE_KEY?.trim());

export type PushMessage = { title: string; body: string; url?: string; tag?: string };

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(`mailto:${BUSINESS.email}`, vapidPublicKey()!, process.env.VAPID_PRIVATE_KEY!.trim());
  configured = true;
}

/** Fresh keys, shown once on the admin page so Cody can paste them into Vercel. */
export const newVapidKeys = () => webpush.generateVAPIDKeys();

/** Send to every device Cody turned alerts on for. Never throws: an alert must not break an order. */
export async function notifyAdmins(msg: PushMessage): Promise<{ sent: number; failed: number }> {
  if (!pushEnabled()) return { sent: 0, failed: 0 };
  try {
    configure();
    const { data: subs } = await db().from("push_subscriptions").select("id, endpoint, p256dh, auth");
    let sent = 0, failed = 0;
    await Promise.all((subs ?? []).map(async (s: any) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg), { TTL: 60 * 60 * 12, urgency: "high" });
        sent++;
      } catch (e: any) {
        failed++;
        // 404/410: the browser dropped this subscription (app removed, permission revoked). Forget it.
        if (e?.statusCode === 404 || e?.statusCode === 410) await db().from("push_subscriptions").delete().eq("id", s.id);
        else console.error("push failed", e?.statusCode, e?.body ?? e?.message);
      }
    }));
    return { sent, failed };
  } catch (e) {
    console.error("push error", e);
    return { sent: 0, failed: 0 };
  }
}

export async function saveSubscription(userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent: string | null) {
  const { error } = await db().from("push_subscriptions").upsert(
    { user_id: userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, user_agent: userAgent?.slice(0, 300) ?? null },
    { onConflict: "endpoint" },
  );
  if (error) throw new Error(/relation|does not exist/i.test(error.message) ? "Notifications aren't set up yet (run migration 0020)." : error.message);
}

export async function deleteSubscription(endpoint: string) {
  await db().from("push_subscriptions").delete().eq("endpoint", endpoint);
}

export async function subscriptionCount(): Promise<number> {
  const { count } = await db().from("push_subscriptions").select("id", { count: "exact", head: true });
  return count ?? 0;
}

/** One-line alerts about an order. Looks the order up itself so callers stay one line. */
export async function alertForOrder(orderId: string, kind: "new" | "canceled" | "tip", amountCents = 0) {
  if (!pushEnabled()) return;
  const { data: o } = await db().from("orders")
    .select("id, delivery_date, asap, unique_item_count, estimated_subtotal_cents, service_fee_cents, second_store_fee_cents, tip_cents, profiles(full_name), slot_templates(label), kroger_store_id, meijer_store_id")
    .eq("id", orderId).maybeSingle();
  if (!o) return;
  const p = Array.isArray(o.profiles) ? o.profiles[0] : o.profiles;
  const slot = Array.isArray(o.slot_templates) ? o.slot_templates[0] : o.slot_templates;
  const name = p?.full_name || "A customer";
  const day = formatDate(o.delivery_date, { weekday: "short", month: "short", day: "numeric" });
  const when = o.asap ? "ASAP today" : `${day}${slot?.label ? `, ${slot.label}` : ""}`;
  const stores = [o.kroger_store_id && "Kroger", o.meijer_store_id && "Meijer"].filter(Boolean).join(" + ");
  const est = o.estimated_subtotal_cents + o.service_fee_cents + (o.second_store_fee_cents ?? 0) + o.tip_cents;
  const url = `/admin/orders/${o.id}`;
  const msg: PushMessage =
    kind === "new" ? { title: `${o.asap ? "ASAP order" : "New order"}: ${name}`, body: `${o.unique_item_count} items · ${stores} · ${when} · about ${money(est)}`, url, tag: `order-${o.id}` }
    : kind === "canceled" ? { title: `Canceled: ${name}`, body: `${when} · ${o.unique_item_count} items. The card hold was released.`, url, tag: `order-${o.id}` }
    : { title: `${name} tipped ${money(amountCents)}`, body: `On their ${day} order. Nice!`, url };
  await notifyAdmins(msg);
}
