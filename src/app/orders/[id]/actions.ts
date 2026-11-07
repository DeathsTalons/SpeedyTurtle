"use server";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { chargeLaterTip, releaseHold } from "@/lib/payments";

export type TipResult = { ok?: true; error?: string };

/** Customer adds a tip after delivery. Only on their own delivered order, once. */
export async function addTipAfterDelivery(orderId: string, cents: number): Promise<TipResult> {
  const amount = Math.round(Number(cents));
  if (!Number.isFinite(amount) || amount < 100 || amount > 20000) return { error: "Pick a tip between $1 and $200." };

  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: "Sign in again." };
  // Read through the customer's own client, so the database only returns their own order.
  const { data: o } = await db.from("orders").select("id, status, customer_id").eq("id", String(orderId)).maybeSingle();
  if (!o || o.customer_id !== user.id) return { error: "Order not found." };
  if (o.status !== "delivered") return { error: "You can add a tip once your groceries are delivered." };

  const r = await chargeLaterTip(o.id, amount);
  if (!r.ok) return { error: r.error };
  revalidatePath(`/orders/${o.id}`);
  revalidatePath("/orders");
  return { ok: true };
}

/**
 * Customer cancels their own order. Allowed only until Cody starts shopping (status "placed").
 * The status change is conditional, so if Cody starts the trip at the same moment, his start wins.
 */
export async function cancelMyOrder(orderId: string): Promise<{ ok?: true; error?: string }> {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: "Sign in again." };
  const { data: o } = await db.from("orders").select("id, status, customer_id").eq("id", String(orderId)).maybeSingle();
  if (!o || o.customer_id !== user.id) return { error: "Order not found." };
  if (o.status !== "placed") return { error: "Cody has already started shopping this order, so it can't be canceled. Text him if something's wrong." };

  // Customers can't write orders directly (database rules), so the server does it after the checks above.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = supabaseAdmin() as any;
  const { data: changed } = await admin.from("orders")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("id", o.id).eq("status", "placed").select("id");
  if (!changed?.length) return { error: "Cody just started shopping this order, so it can't be canceled. Text him if something's wrong." };
  await releaseHold(o.id);
  revalidatePath(`/orders/${o.id}`);
  revalidatePath("/orders");
  revalidatePath("/admin");
  return { ok: true };
}
