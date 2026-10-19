import { redirect } from "next/navigation";
import { customerContext, secondStoreRules } from "@/lib/customer";
import { getAvailability, getSettings } from "@/lib/data";
import { AvailableBanner } from "@/components/available-banner";
import { Shop } from "./shop";

export const metadata = { title: "Shop · Speedy Turtle" };

export default async function ShopPage({ searchParams }: PageProps<"/shop">) {
  const { addon } = await searchParams;
  const ctx = await customerContext();
  if (!ctx) redirect("/login?next=/shop");
  const settings = await getSettings();
  return (
    <>
      <AvailableBanner a={await getAvailability()} />
      <h1 className="text-3xl font-extrabold mb-5">Shop</h1>
      
      <Shop startAddingOther={addon === "1"} addOnNames={{ kroger: ctx.addOnStores.kroger?.name ?? null, meijer: ctx.addOnStores.meijer?.name ?? null }} canAddOther={secondStoreRules(ctx.stores)} secondStoreFeeCents={settings.secondStoreFeeCents} hasAddress={!!ctx.address} storeNames={{ kroger: ctx.stores.kroger?.name ?? null, meijer: ctx.stores.meijer?.name ?? null }} />
    </>
  );
}
