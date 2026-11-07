import Link from "next/link";
import { BUSINESS } from "@/lib/business";

export const metadata = { title: "Contact · Redbird Grocery" };

export default function ContactPage() {
  return (
    <div className="max-w-xl mx-auto space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-shell-dark">Get in touch</h1>
        <p className="text-lg">
          {BUSINESS.name} is just me, Cody. I shop every order myself, so you&apos;ll always reach the person handling your groceries.
        </p>
      </header>

      <section className="bg-card border border-line rounded-3xl p-5 space-y-4">
        <div>
          <p className="text-sm font-bold text-muted">Text or call</p>
          <a href={`sms:${BUSINESS.phoneHref}`} className="font-display text-2xl font-extrabold underline">{BUSINESS.phone}</a>
          <p className="text-sm text-muted">Texting is fastest, especially while I&apos;m shopping.</p>
        </div>
        <div>
          <p className="text-sm font-bold text-muted">Email</p>
          <a href={`mailto:${BUSINESS.email}`} className="text-lg font-bold underline break-all">{BUSINESS.email}</a>
        </div>
        <div>
          <p className="text-sm font-bold text-muted">Delivery area</p>
          <p>{BUSINESS.area}</p>
        </div>
      </section>

      <section className="bg-amber-soft rounded-3xl p-5 space-y-1">
        <h2 className="text-xl font-extrabold">Problem with an order?</h2>
        <p>
          Text me within 24 hours of delivery with what was missing or damaged (a photo helps) and I&apos;ll refund it. See the{" "}
          <Link href="/refunds" className="underline font-bold">refund policy</Link>.
        </p>
      </section>
    </div>
  );
}
