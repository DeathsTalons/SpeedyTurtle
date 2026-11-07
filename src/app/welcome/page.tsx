// Shown once, right after creating an account: every fee, up front. Also reachable from Account.
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { getFeeTiers, getSettings } from "@/lib/data";
import { money } from "@/lib/money";
import { TipNote } from "@/components/tip-note";
import { acknowledgeFees } from "./actions";

export const metadata = { title: "How pricing works · Redbird Grocery" };

const range = (min: number, max: number | null) =>
  max == null ? `${min}+ items` : min <= 1 ? `Up to ${max} items` : `${min}–${max} items`;

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

      <section className="bg-card border border-line rounded-3xl p-5 space-y-2">
        <h2 className="text-xl font-extrabold">Groceries at receipt price</h2>
        <p>You pay exactly what&apos;s on the Kroger or Meijer receipt. Cody doesn&apos;t mark up a single item.</p>
      </section>

      <section className="bg-card border border-line rounded-3xl p-5 space-y-3" aria-labelledby="fee-h">
        <h2 id="fee-h" className="text-xl font-extrabold">One flat service fee per order</h2>
        <p>The fee depends on how many <b>different</b> items you order, not how many of each. Six bananas and two gallons of milk count as 2 items.</p>
        <table className="w-full">
          <caption className="sr-only">Service fee by number of different items</caption>
          <thead className="sr-only"><tr><th>Size</th><th>Items</th><th>Fee</th></tr></thead>
          <tbody className="divide-y divide-line">
            {tiers.map((t) => (
              <tr key={t.minItems}>
                <th scope="row" className="py-2.5 text-left font-bold">{t.label}</th>
                <td className="py-2.5 text-muted">{range(t.minItems, t.maxItems)}</td>
                <td className="py-2.5 text-right font-extrabold text-lg">{money(t.feeCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {settings.secondStoreFeeCents > 0 && (
        <section className="bg-card border border-line rounded-3xl p-5 space-y-2">
          <h2 className="text-xl font-extrabold">Adding the other store: {money(settings.secondStoreFeeCents)}</h2>
          <p>Each order starts at one store. If you need a few things from the other one, add them for one flat {money(settings.secondStoreFeeCents)}.</p>
        </section>
      )}

      <section className="bg-card border border-line rounded-3xl p-5 space-y-2">
        <h2 className="text-xl font-extrabold">How your card is charged</h2>
        <p>
          When you order, your card is <b>held</b> (not charged) for the estimate plus about {settings.authBufferPct}%, to cover weighed produce
          and price changes. After Cody shops, you&apos;re charged the real receipt total plus the fees above, and the rest of the hold is released.
        </p>
      </section>

      <section className="bg-amber-soft rounded-3xl p-5 space-y-1">
        <h2 className="text-xl font-extrabold">Tips</h2>
        <TipNote className="!text-ink text-base" />
        <p>You can add one at checkout or after your groceries arrive.</p>
      </section>

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
