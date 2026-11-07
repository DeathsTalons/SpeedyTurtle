// Public: every fee, no sign-in needed (customers and Stripe's reviewers both look for this).
import Link from "next/link";
import { connection } from "next/server";
import { getFeeTiers, getSettings } from "@/lib/data";
import { PricingDetails } from "@/components/pricing-details";

export const metadata = { title: "Pricing · Redbird Grocery", description: "Groceries at receipt price plus one flat service fee per order." };

export default async function PricingPage() {
  await connection(); // fees can change; read them fresh
  const [tiers, settings] = await Promise.all([getFeeTiers(), getSettings()]);
  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <header className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-shell-dark">Pricing</h1>
        <p className="text-lg">No markups, no surprise fees. Here&apos;s everything you&apos;ll pay.</p>
      </header>
      <PricingDetails tiers={tiers} secondStoreFeeCents={settings.secondStoreFeeCents} bufferPct={settings.authBufferPct} />
      <p className="text-sm text-muted">
        Changed your mind? You can cancel for free until I start shopping. See the <Link href="/refunds" className="underline">refund policy</Link>.
      </p>
      <Link href="/login" className="btn btn-primary">Create an account</Link>
    </div>
  );
}
