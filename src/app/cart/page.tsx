import { connection } from "next/server";
import { redirect } from "next/navigation";
import { customerContext, secondStoreRules } from "@/lib/customer";
import { getFeeTiers, getSettings } from "@/lib/data";
import { CartView } from "./cart-view";

export const metadata = { title: "Cart · Speedy Turtle" };

export default async function CartPage() {
  await connection(); // fees can change; read them fresh
  const ctx = await customerContext();
  if (!ctx) redirect("/login?next=/cart");
  const [tiers, settings] = await Promise.all([getFeeTiers(), getSettings()]);
  return (
    <>
      <h1 className="text-3xl font-extrabold mb-5">Cart</h1>
      <CartView tiers={tiers} bufferPct={settings.authBufferPct} secondStoreFeeCents={settings.secondStoreFeeCents} canAddOther={secondStoreRules(ctx.stores)} primaryStoreNames={{ kroger: ctx.stores.kroger?.name ?? null, meijer: ctx.stores.meijer?.name ?? null }} />
    </>
  );
}
