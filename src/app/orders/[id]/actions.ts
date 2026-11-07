"use server";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { chargeLaterTip } from "@/lib/payments";

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
