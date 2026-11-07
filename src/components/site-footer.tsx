"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BUSINESS } from "@/lib/business";

const LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
  { href: "/refunds", label: "Cancellations & Refunds" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
];

export function SiteFooter() {
  if (usePathname().startsWith("/admin")) return null; // Cody's screens have their own bottom bars
  return (
    <footer className="border-t border-line mt-8">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-2 text-sm text-muted">
        <nav aria-label="Policies" className="flex flex-wrap gap-x-4 gap-y-1 font-bold">
          {LINKS.map((l) => <Link key={l.href} href={l.href} className="hover:text-ink underline-offset-2 hover:underline">{l.label}</Link>)}
        </nav>
        <p>
          {BUSINESS.name} · {BUSINESS.owner} · <a href={`tel:${BUSINESS.phoneHref}`} className="underline">{BUSINESS.phone}</a> ·{" "}
          <a href={`mailto:${BUSINESS.email}`} className="underline break-all">{BUSINESS.email}</a>
        </p>
        <p>Independent local business. Not affiliated with Kroger or Meijer.</p>
      </div>
    </footer>
  );
}
