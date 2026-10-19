// Everything that moves money. Server only, always with the master database client.
import "server-only";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

/* eslint-disable @typescript-eslint/no-explicit-any */
const db = () => supabaseAdmin() as any;
const friendly = (e: unknown) => {
  const err = e as Stripe.errors.StripeError;
  if (err?.type === "StripeCardError") return err.message ?? "The card was declined.";
  return "The card couldn't be charged right now.";
};

/** The customer's Stripe record, created the first time they pay. */
export async function ensureCustomer(userId: string, email: string | undefined, name: string | null) {
  const s = stripe()!;
  const { data: p } = await db().from("profiles").select("stripe_customer_id, full_name").eq("id", userId).single();
  if (p?.stripe_customer_id) return p.stripe_customer_id as string;
  const c = await s.customers.create({ email, name: name ?? p?.full_name ?? undefined, metadata: { user_id: userId } });
  await db().from("profiles").update({ stripe_customer_id: c.id }).eq("id", userId);
  return c.id;
}

/** Card form at checkout: saves the card for later holds and charges. */
export async function createCardSetup(userId: string, email: string | undefined) {
  const customer = await ensureCustomer(userId, email, null);
  const si = await stripe()!.setupIntents.create({ customer, usage: "off_session", automatic_payment_methods: { enabled: true, allow_redirects: "never" } });
  return si.client_secret!;
}

/** Check the saved card really belongs to this customer. */
export async function verifyPaymentMethod(userId: string, paymentMethodId: string) {
  const customer = await ensureCustomer(userId, undefined, null);
  const pm = await stripe()!.paymentMethods.retrieve(paymentMethodId);
  return pm.customer === customer ? customer : null;
}

/** Place the hold (authorize, don't charge yet). Records success or the decline on the order. */
export async function authorizeOrder(orderId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: o } = await db().from("orders").select("id, customer_id, authorized_amount_cents, stripe_payment_method_id, payment_status, profiles(stripe_customer_id)").eq("id", orderId).single();
  if (!o) return { ok: false, error: "Order not found." };
  if (o.payment_status === "authorized" || o.payment_status === "captured") return { ok: true };
  const customer = (Array.isArray(o.profiles) ? o.profiles[0] : o.profiles)?.stripe_customer_id;
  if (!customer || !o.stripe_payment_method_id) return { ok: false, error: "No card on file." };
  try {
    const pi = await stripe()!.paymentIntents.create({
      amount: o.authorized_amount_cents, currency: "usd", customer, payment_method: o.stripe_payment_method_id,
      capture_method: "manual", confirm: true, off_session: true,
      description: "Speedy Turtle grocery order (hold)", metadata: { order_id: o.id },
    }, { idempotencyKey: `hold-${o.id}-${o.stripe_payment_method_id}-${o.authorized_amount_cents}-${Math.floor(Date.now() / 60_000)}` });
    if (pi.status !== "requires_capture") throw new Error(`Unexpected status ${pi.status}`);
    await db().from("orders").update({ payment_status: "authorized", stripe_payment_intent_id: pi.id, authorized_at: new Date().toISOString(), payment_error: null }).eq("id", o.id);
    return { ok: true };
  } catch (e) {
    const error = friendly(e);
    await db().from("orders").update({ payment_status: "failed", payment_error: error }).eq("id", o.id);
    return { ok: false, error };
  }
}

/**
 * Charge the final total: capture the hold (up to its amount), refunding or flagging any difference.
 * If the hold expired (Stripe drops them after ~7 days) a fresh one is placed first.
 */
export async function chargeFinal(orderId: string, totalCents: number, depth = 0): Promise<{ chargedCents: number; overCents: number; note?: string }> {
  const { data: o } = await db().from("orders").select("payment_status, stripe_payment_intent_id, authorized_amount_cents, captured_cents, refunded_cents").eq("id", orderId).single();
  const s = stripe();
  if (!s || !o || o.payment_status === "none") return { chargedCents: 0, overCents: 0, note: "Card payments aren't on for this order." };
  if (depth > 2) return { chargedCents: 0, overCents: totalCents, note: "Couldn't charge the card after several tries." };

  if (o.payment_status === "card_saved" || o.payment_status === "failed" || o.payment_status === "canceled") {
    const r = await authorizeOrder(orderId);
    if (!r.ok) return { chargedCents: 0, overCents: totalCents, note: `Couldn't place the hold: ${r.error}` };
    return chargeFinal(orderId, totalCents, depth + 1);
  }

  if (o.payment_status === "authorized") {
    // Make sure the hold is still live before trying to capture it.
    const pi = await s.paymentIntents.retrieve(o.stripe_payment_intent_id);
    if (pi.status !== "requires_capture") {
      // Expired or canceled: place a new hold and try again.
      await db().from("orders").update({ payment_status: "card_saved", stripe_payment_intent_id: null, authorized_at: null }).eq("id", orderId);
      return chargeFinal(orderId, totalCents, depth + 1);
    }
    const capture = Math.min(totalCents, o.authorized_amount_cents);
    // Key includes the amount so a corrected total can be retried instead of being rejected for 24h.
    await s.paymentIntents.capture(o.stripe_payment_intent_id, { amount_to_capture: capture }, { idempotencyKey: `capture-${orderId}-${capture}` });
    await db().from("orders").update({ payment_status: "captured", captured_cents: capture }).eq("id", orderId);
    return { chargedCents: capture, overCents: Math.max(0, totalCents - capture) };
  }

  // Already charged: lower total → refund the difference; higher → report it for an extra charge.
  const net = (o.captured_cents ?? 0) - (o.refunded_cents ?? 0);
  if (totalCents < net) {
    const refund = net - totalCents;
    await refundOrder(orderId, refund);
    return { chargedCents: totalCents, overCents: 0, note: `Refunded $${(refund / 100).toFixed(2)} of the earlier charge.` };
  }
  return { chargedCents: net, overCents: totalCents - net };
}

/** Refund across the main charge and any extra charge, whichever still has money on it. */
async function refundOrder(orderId: string, cents: number) {
  const s = stripe()!;
  const { data: o } = await db().from("orders").select("stripe_payment_intent_id, extra_charge_payment_intent_id, refunded_cents").eq("id", orderId).single();
  const targets = [o.extra_charge_payment_intent_id, o.stripe_payment_intent_id].filter(Boolean) as string[];
  let left = cents;
  for (const piId of targets) {
    if (left <= 0) break;
    const pi = await s.paymentIntents.retrieve(piId, { expand: ["latest_charge"] });
    const ch = pi.latest_charge as Stripe.Charge | null;
    if (!ch || ch.status !== "succeeded") continue;
    const available = ch.amount_captured - ch.amount_refunded;
    const amount = Math.min(left, available);
    if (amount <= 0) continue;
    await s.refunds.create({ payment_intent: piId, amount }, { idempotencyKey: `refund-${orderId}-${piId}-${ch.amount_refunded}-${amount}` });
    left -= amount;
  }
  const done = cents - left;
  if (done > 0) await db().from("orders").update({ refunded_cents: (o.refunded_cents ?? 0) + done }).eq("id", orderId);
  if (left > 0) throw new Error(`Could only refund $${(done / 100).toFixed(2)} of $${(cents / 100).toFixed(2)}.`);
}

/** Charge an amount above the hold (customer agreed by text). */
export async function chargeExtra(orderId: string, cents: number) {
  const { data: o } = await db().from("orders").select("id, stripe_payment_method_id, captured_cents, extra_charge_payment_intent_id, profiles(stripe_customer_id)").eq("id", orderId).single();
  const customer = (Array.isArray(o?.profiles) ? o.profiles[0] : o?.profiles)?.stripe_customer_id;
  if (!o || !customer || !o.stripe_payment_method_id) throw new Error("No card on file.");
  if (o.extra_charge_payment_intent_id) throw new Error("An extra charge was already made on this order. Refund it first if it was wrong.");
  let pi: Stripe.PaymentIntent;
  try {
    pi = await stripe()!.paymentIntents.create({
      amount: cents, currency: "usd", customer, payment_method: o.stripe_payment_method_id, confirm: true, off_session: true,
      description: "Speedy Turtle grocery order (difference over the hold)", metadata: { order_id: o.id, kind: "extra" },
    }, { idempotencyKey: `extra-${o.id}-${cents}-${Date.now()}` });
  } catch (e) {
    throw new Error(friendly(e));
  }
  if (pi.status !== "succeeded") throw new Error(`The extra charge didn't go through (${pi.status}).`);
  await db().from("orders").update({ extra_charge_payment_intent_id: pi.id, captured_cents: (o.captured_cents ?? 0) + cents }).eq("id", o.id);
}

/** Release the hold when an order is canceled. */
export async function releaseHold(orderId: string) {
  const { data: o } = await db().from("orders").select("payment_status, stripe_payment_intent_id").eq("id", orderId).single();
  if (o?.payment_status === "authorized" && o.stripe_payment_intent_id) {
    await stripe()?.paymentIntents.cancel(o.stripe_payment_intent_id).catch(() => {});
  }
  if (o && o.payment_status !== "captured") await db().from("orders").update({ payment_status: "canceled" }).eq("id", orderId);
}
