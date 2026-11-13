// Public: who's shopping your groceries.
import Link from "next/link";
import { BUSINESS } from "@/lib/business";

export const metadata = {
  title: "About · Redbird Grocery",
  description: "Redbird Grocery is one local shopper with 1,200+ grocery orders of experience, serving Brownsburg, Avon and Greencastle.",
};

const FACTS = [
  { big: "1,200+", small: "grocery orders shopped" },
  { big: "100%", small: "locally owned and run" },
  { big: "1", small: "shopper on every order: me" },
];

export default function AboutPage() {
  return (
    <div className="space-y-8 max-w-xl mx-auto">
      <header className="space-y-3">
        <p className="font-bold text-lg text-[var(--cardinal)]">Hi, I&apos;m {BUSINESS.owner.split(" ")[0]}.</p>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-shell-dark">A local shopper, not a billion-dollar app.</h1>
        <p className="text-lg">
          {BUSINESS.name} is just me. I live here, I shop the same Kroger and Meijer stores you do, and I&apos;m the one who picks out every
          item and brings it to your door.
        </p>
      </header>

      <ul className="grid grid-cols-3 gap-2 sm:gap-3">
        {FACTS.map((f) => (
          <li key={f.small} className="bg-card border border-line rounded-3xl p-3 sm:p-4 text-center">
            <p className="text-2xl sm:text-3xl font-extrabold text-shell-dark">{f.big}</p>
            <p className="text-xs sm:text-sm text-muted leading-snug mt-1">{f.small}</p>
          </li>
        ))}
      </ul>

      <section className="space-y-3">
        <h2 className="text-2xl font-extrabold">Where I learned it</h2>
        <p>
          Before {BUSINESS.name}, I shopped more than 1,200 grocery orders for the big delivery apps, the ones owned by billionaires and
          giant corporations. That&apos;s a lot of avocados squeezed, dates checked and &ldquo;they&apos;re out, what now?&rdquo; texts sent.
        </p>
        <p>
          I got good at it. I also saw how much of what customers paid went to the app instead of the groceries or the person shopping
          them. So I started my own thing: the same careful shopping, with honest prices, and the money stays right here in town.
        </p>
      </section>

      <section className="bg-card border border-line rounded-3xl p-6 space-y-3">
        <h2 className="text-2xl font-extrabold">What you get with me</h2>
        <ul className="space-y-2 list-disc pl-5 marker:text-amber">
          <li><b>The store&apos;s receipt price.</b> No marked-up items, just one flat service fee. <Link href="/pricing" className="underline">See pricing</Link>.</li>
          <li><b>Produce picked like it&apos;s for my own kitchen.</b> Ripe when you want it ripe, firm when you want it to last.</li>
          <li><b>No surprise swaps.</b> You choose what happens if something&apos;s out, and I text you when it matters.</li>
          <li><b>A photo of your receipt</b> with every order, so you see exactly what you paid.</li>
          <li><b>A real person to talk to.</b> Text or call me at <a href={`tel:${BUSINESS.phoneHref}`} className="underline font-bold">{BUSINESS.phone}</a>. No support tickets, no chatbots.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-extrabold">Small and local, on purpose</h2>
        <p>
          When you order from {BUSINESS.name}, you&apos;re supporting a neighbor, not a shareholder. I deliver in Brownsburg, Avon and
          Greencastle, and every order helps a small Indiana business grow. Thank you for that. It means a lot.
        </p>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/login" className="btn btn-primary">Start an order</Link>
        <Link href="/contact" className="btn btn-ghost">Get in touch</Link>
      </div>
    </div>
  );
}
