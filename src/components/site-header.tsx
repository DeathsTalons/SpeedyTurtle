"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart";

function TurtleMark() {
  // Hexagon shell — the brand mark.
  return (
    <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">
      <ellipse cx="33" cy="22" rx="5" ry="4" fill="#1f5a40" />
      <path d="M8 30 l-3 4 M28 30 l3 4 M8 14 l-3 -3" stroke="#1f5a40" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M18 7 L28 12.5 L28 26 L18 31.5 L8 26 L8 12.5 Z" fill="#d99a2b" stroke="#163f2d" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M18 14 L23 17 L23 22 L18 25 L13 22 L13 17 Z" fill="#f6e3bd" stroke="#163f2d" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

const CUSTOMER_NAV = [
  { href: "/shop", label: "Shop" },
  { href: "/orders", label: "Orders" },
  { href: "/account", label: "Account" },
];
const ADMIN_NAV = [
  { href: "/admin", label: "Orders", exact: true },
  { href: "/admin/calendar", label: "Calendar" },
  { href: "/admin/shop", label: "Shopping" },
];

export function SiteHeader() {
  const path = usePathname();
  const { items, ready } = useCart();
  const count = items.length;
  const admin = path.startsWith("/admin");
  const NAV = admin ? ADMIN_NAV : CUSTOMER_NAV;
  const isActive = (n: { href: string; exact?: boolean }) => (n.exact ? path === n.href : path.startsWith(n.href));

  return (
    <header className="sticky top-0 z-20 bg-paper/95 backdrop-blur border-b border-line">
      <div className="max-w-3xl mx-auto px-4 h-16 flex items-center gap-3">
        <Link href={admin ? "/admin" : "/"} className="flex items-center gap-2 mr-auto">
          <TurtleMark />
          <span className="font-display text-xl font-extrabold text-shell-dark">Speedy Turtle</span>
        </Link>
        <nav className="hidden sm:flex items-center gap-1" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
              className={`px-3 py-2 rounded-full font-bold ${isActive(n) ? "bg-card text-shell" : "text-muted hover:text-ink"}`}>
              {n.label}
            </Link>
          ))}
        </nav>
        {admin ? (
          <span className="text-sm font-bold bg-amber-soft px-3 py-1 rounded-full">Cody</span>
        ) : (
        <Link href="/cart" className="btn btn-primary !px-4" aria-label={`Cart, ${count} items`}>
          Cart
          <span className="min-w-6 h-6 px-1.5 rounded-full bg-amber text-ink text-sm grid place-items-center">{ready ? count : 0}</span>
        </Link>
        )}
      </div>
      {/* Phone nav */}
      <nav className="sm:hidden flex border-t border-line" aria-label="Main">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href}
            className={`flex-1 text-center py-2.5 font-bold ${isActive(n) ? "text-shell border-b-[3px] border-amber" : "text-muted"}`}>
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
