// Shown once, right after creating an account: every fee, up front. Also reachable from Account.
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { getFeeTiers, getSettings } from "@/lib/data";
import { PricingDetails } from "@/components/pricing-details";
import { acknowledgeFees } from "./actions";

export const metadata = { title: "How pricing works · Redbird Grocery" };

export default async function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  await connection(); // fees can change; read them fresh
  const { next, review } = await searchParams;
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login?next=/welcome");

  const [tiers, settings, { data: profile }] = await Promise.all([
    getFeeTiers(),
    getSettings(),
    db.from("profiles").select("full_name, fees_seen_at").eq("id", user.id).maybeSingle(),
  ]);
  const firstName = profile?.full_name?.split(" ")[0];
  const reviewing = review === "1" || !!profile?.fees_seen_at;

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <header className="space-y-2">
        {!reviewing && <p className="font-bold text-amber">Welcome{firstName ? `, ${firstName}` : ""}!</p>}
        <h1 className="text-3xl sm:text-4xl font-extrabold text-shell-dark">Here&apos;s exactly what you&apos;ll pay</h1>
        <p className="text-lg">No surprises. This is every fee, before you shop.</p>
      </header>

      <PricingDetails tiers={tiers} secondStoreFeeCents={settings.secondStoreFeeCents} bufferPct={settings.authBufferPct} />

      {reviewing ? (
        <Link href="/account" className="btn btn-ghost">Back to account</Link>
      ) : (
        <form action={acknowledgeFees}>
          <input type="hidden" name="next" value={typeof next === "string" ? next : "/shop"} />
          <button className="btn btn-primary w-full text-lg">Got it, let&apos;s get started</button>
        </form>
      )}
    </div>
  );
}
