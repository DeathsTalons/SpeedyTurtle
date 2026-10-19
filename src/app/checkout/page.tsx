import { redirect } from "next/navigation";
import { customerContext } from "@/lib/customer";
import { getAvailability, getAvailableSlots, getFeeTiers, getScheduleInput, getSettings } from "@/lib/data";
import { clockLabel } from "@/lib/format";
import { CheckoutForm, type SlotOption } from "./checkout-form";
import { paymentsEnabled } from "@/lib/stripe";

export const metadata = { title: "Checkout · Speedy Turtle" };

export default async function CheckoutPage() {
  const ctx = await customerContext();
  if (!ctx) redirect("/login?next=/checkout");
  const [slots, input, tiers, settings, availability] = await Promise.all([getAvailableSlots(), getScheduleInput(), getFeeTiers(), getSettings(), getAvailability()]);
  const byId = new Map(input.templates.map((t) => [t.id, t]));
  const options: SlotOption[] = slots.map((s) => {
    const t = byId.get(s.slotTemplateId)!;
    return { date: s.date, slotTemplateId: s.slotTemplateId, label: s.label, window: `${clockLabel(t.startTime)}–${clockLabel(t.endTime)}`, remaining: s.remaining };
  });
  return (
    <>
      <h1 className="text-3xl font-extrabold mb-6">Checkout</h1>
      <CheckoutForm paymentsOn={paymentsEnabled()} asapUntil={availability.open ? availability.until : null} addresses={ctx.addresses} slots={options} tiers={tiers} bufferPct={settings.authBufferPct} meijerExtraBufferPct={settings.meijerExtraBufferPct} secondStoreFeeCents={settings.secondStoreFeeCents} />
    </>
  );
}
