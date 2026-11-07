import Link from "next/link";
import { BUSINESS } from "@/lib/business";

/** Shared frame for Terms, Privacy and Refunds: title, date, readable text, contact at the bottom. */
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="legal max-w-2xl mx-auto">
      <h1 className="text-3xl sm:text-4xl font-extrabold text-shell-dark">{title}</h1>
      <p className="text-muted">Last updated {BUSINESS.policiesUpdated}</p>
      {children}
      <p className="mt-10 bg-card border border-line rounded-2xl p-4">
        Questions? Text or call me at <a href={`tel:${BUSINESS.phoneHref}`}>{BUSINESS.phone}</a> or email{" "}
        <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>. More on the <Link href="/contact">contact page</Link>.
      </p>
    </article>
  );
}
