import { redirect } from "next/navigation";
import { customerContext, ensureFeesSeen } from "@/lib/customer";
import { areaForHome, asapOpenFor, getAvailability, getAvailableSlots, getFeeTiers, getScheduleInput, getSettings } from "@/lib/data";
import { clockLabel } from "@/lib/format";
import { CheckoutForm, type SlotOption } from "./checkout-form";
import { paymentsEnabled } from "@/lib/stripe";
import { normalizeKrogerPhone } from "@/lib/kroger-card";

export const metadata = { title: "Checkout · Redbird Grocery" };

export default async function CheckoutPage() {
  const ctx = await customerContext();
  if (!ctx) redirect("/login?next=/checkout");
  await ensureFeesSeen(ctx, "/checkout");
  const [slots, input, tiers, settings, availability, { data: me }] = await Promise.all([
    getAvailableSlots(), getScheduleInput(), getFeeTiers(), getSettings(), getAvailability(),
    ctx.db.from("profiles").select("*").eq("id", ctx.user.id).maybeSingle(), // "*": works before migration 0017 too
  ]);
  // Same-day ASAP only for addresses in the area Cody is out in right now.
  const asapAddressIds: string[] = [];
  if (availability.open) {
    for (const ad of ctx.addresses) {
      const home = ad.latitude != null ? { latitude: ad.latitude, longitude: ad.longitude } : null;
      if (asapOpenFor(availability, await areaForHome(home))) asapAddressIds.push(ad.id);
    }
  }
  const byId = new Map(input.templates.map((t) => [t.id, t]));
  const options: SlotOption[] = slots.map((s) => {
    const t = byId.get(s.slotTemplateId)!;
    return { date: s.date, slotTemplateId: s.slotTemplateId, label: s.label, window: `${clockLabel(t.startTime)}–${clockLabel(t.endTime)}`, remaining: s.remaining };
  });
  return (
    <>
      <h1 className="text-3xl font-extrabold mb-6">Checkout</h1>
      <CheckoutForm savedKrogerPhone={normalizeKrogerPhone(me?.kroger_card_phone)} paymentsOn={paymentsEnabled()} asapUntil={availability.open ? availability.until : null} asapAddressIds={asapAddressIds} addresses={ctx.addresses} slots={options} tiers={tiers} bufferPct={settings.authBufferPct} meijerExtraBufferPct={settings.meijerExtraBufferPct} secondStoreFeeCents={settings.secondStoreFeeCents} />
    </>
  );
}
