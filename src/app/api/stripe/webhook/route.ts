// Stripe tells us here when something changes on its side that the app didn't do itself:
// a hold expiring, a refund made in the Stripe dashboard, or a customer disputing a charge.
// Keeps the order's payment columns honest. Set STRIPE_WEBHOOK_SECRET in .env.local (see README).
import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

/* eslint-disable @typescript-eslint/no-explicit-any */
const db = () => supabaseAdmin() as any;

export async function POST(req: NextRequest) {
  const s = stripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!s || !secret) return NextResponse.json({ error: "Webhooks aren't set up." }, { status: 503 });

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature." }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = s.webhooks.constructEvent(await req.text(), sig, secret);
  } catch (e) {
    console.warn("Stripe webhook rejected:", (e as Error).message);
    return NextResponse.json({ error: "Bad signature." }, { status: 400 });
  }

  // Each event is handled once, even if Stripe sends it again.
  const { error: dupe } = await db().from("stripe_events").insert({ id: event.id, type: event.type });
  if (dupe) return NextResponse.json({ received: true, duplicate: true });

  try {
    await handle(event);
  } catch (e) {
    console.error(`Stripe webhook ${event.type} failed:`, e);
    // Let Stripe retry later.
    await db().from("stripe_events").delete().eq("id", event.id);
    return NextResponse.json({ error: "Handler failed." }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}

async function handle(event: Stripe.Event) {
  switch (event.type) {
    case "payment_intent.canceled": {
      // A hold that expired (or was canceled in the dashboard). The card is still saved,
      // so the next "Save total" places a fresh hold.
      const pi = event.data.object;
      if (pi.metadata?.kind === "extra") return;
      await db().from("orders")
        .update({ payment_status: "card_saved", stripe_payment_intent_id: null, authorized_at: null, payment_error: "The card hold expired; a new one is placed when you save the total." })
        .eq("stripe_payment_intent_id", pi.id).eq("payment_status", "authorized");
      return;
    }

    case "charge.refunded": {
      // Refund made anywhere (app or dashboard): mirror the total refunded on the order.
      const ch = event.data.object;
      const piId = typeof ch.payment_intent === "string" ? ch.payment_intent : ch.payment_intent?.id;
      if (!piId) return;
      const orderId = await orderForIntent(piId);
      if (!orderId) return;
      await db().from("orders").update({ refunded_cents: await totalRefunded(orderId) }).eq("id", orderId);
      return;
    }

    case "charge.dispute.created":
    case "charge.dispute.closed": {
      const d = event.data.object;
      const piId = typeof d.payment_intent === "string" ? d.payment_intent : d.payment_intent?.id;
      if (!piId) return;
      const orderId = await orderForIntent(piId);
      if (!orderId) return;
      const open = event.type === "charge.dispute.created";
      await db().from("orders").update({
        dispute_status: open ? "open" : d.status,
        payment_error: open ? `Disputed by the customer ($${(d.amount / 100).toFixed(2)}). Respond in the Stripe dashboard.` : null,
      }).eq("id", orderId);
      return;
    }

    default:
      return;
  }
}

/** The order an intent belongs to: by metadata first, then by the columns that store it. */
async function orderForIntent(piId: string): Promise<string | null> {
  const { data } = await db().from("orders").select("id")
    .or(`stripe_payment_intent_id.eq.${piId},extra_charge_payment_intent_id.eq.${piId}`).limit(1).maybeSingle();
  return data?.id ?? null;
}

/** Sum of refunds across both of the order's charges, straight from Stripe. */
async function totalRefunded(orderId: string): Promise<number> {
  const s = stripe()!;
  const { data: o } = await db().from("orders").select("stripe_payment_intent_id, extra_charge_payment_intent_id").eq("id", orderId).single();
  let total = 0;
  for (const piId of [o?.stripe_payment_intent_id, o?.extra_charge_payment_intent_id].filter(Boolean) as string[]) {
    const pi = await s.paymentIntents.retrieve(piId, { expand: ["latest_charge"] });
    const ch = pi.latest_charge as Stripe.Charge | null;
    if (ch) total += ch.amount_refunded;
  }
  return total;
}
