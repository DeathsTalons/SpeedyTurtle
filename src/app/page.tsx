import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/supabase/server";
import { getAvailability } from "@/lib/data";
import { AvailableBanner } from "@/components/available-banner";

export default async function Home() {
  if (await currentUser()) redirect("/shop");
  return (
    <div className="pt-6 space-y-8">
      <AvailableBanner a={await getAvailability()} />
      <section className="space-y-4">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-shell-dark max-w-xl">Kroger or Meijer, shopped by Cody.</h1>
        <p className="text-lg max-w-lg">
          Pick your store and fill your cart. Cody shops it himself, texts you before swapping anything,
          and drops it at your door in Brownsburg, Avon and Greencastle.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/login" className="btn btn-primary">Create an account or sign in</Link>
        </div>
      </section>
      <section aria-labelledby="how" className="bg-card border border-line rounded-3xl p-6">
        <h2 id="how" className="text-2xl font-extrabold mb-4">How it works</h2>
        <ol className="space-y-3 list-decimal pl-5 marker:font-bold marker:text-amber">
          <li>Choose Kroger or Meijer and fill your cart. Can&apos;t find something? Type it in and Cody will grab it. Need a few things from the other store? Add them for a small extra fee.</li>
          <li>Pick a morning or afternoon window.</li>
          <li>Pay a flat fee based on how many different items you order, not how many of each.</li>
        </ol>
      </section>
    </div>
  );
}
