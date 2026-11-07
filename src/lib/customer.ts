import "server-only";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { orderStores, storesFor } from "@/lib/data";

/** The signed-in customer, their default address, and the stores nearest to it. */
export async function customerContext() {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data: addresses } = await db.from("addresses").select("*").eq("user_id", user.id).order("created_at");
  const address = addresses?.find((a) => a.is_default) ?? addresses?.[0] ?? null;
  const home = address?.latitude != null ? { latitude: address.latitude, longitude: address.longitude } : null;
  const [stores, krogerOrder, meijerOrder] = await Promise.all([storesFor(home), orderStores(home, "kroger"), orderStores(home, "meijer")]);
  // Which store the add-on would come from, for an order starting at each chain.
  const addOnStores = { kroger: krogerOrder.meijer, meijer: meijerOrder.kroger };
  return { db, user, address, addresses: addresses ?? [], home, stores, addOnStores };
}

/**
 * New accounts see the fee breakdown once before shopping. Sends them to /welcome until they have.
 * If the column doesn't exist yet (migration 0015 not run), this quietly does nothing.
 */
export async function ensureFeesSeen(ctx: { db: Awaited<ReturnType<typeof supabaseServer>>; user: { id: string } }, next: string) {
  const { data } = await ctx.db.from("profiles").select("fees_seen_at, role").eq("id", ctx.user.id).maybeSingle();
  if (data && !data.fees_seen_at && data.role !== "admin") redirect(`/welcome?next=${encodeURIComponent(next)}`);
}

/** For each chain: if an order starts there, may the customer add the other chain? */
export function secondStoreRules(stores: { kroger?: { allowSecondStore: boolean }; meijer?: { allowSecondStore: boolean } }) {
  return { kroger: stores.kroger?.allowSecondStore ?? true, meijer: stores.meijer?.allowSecondStore ?? true };
}
