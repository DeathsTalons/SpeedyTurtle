"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart";

function RedbirdMark() {
  // Cardinal (Indiana's state bird) — the brand mark. Same drawing as app/icon.svg.
  return (
    <svg viewBox="2 3 37 34" width="36" height="33" aria-hidden="true">
      <path d="M13.5 26 L3.5 33.5 L6 36 L17 30.5 Z" fill="#8e1c22" />
      <path d="M10 27 C9 19 13 13 19 11.5 L17 3.5 L23.5 9.3 C28.5 9.3 32 12.5 32.5 17 C33 24 28.5 31 20 31.5 C15 31.8 11 30.5 10 27 Z" fill="#c62a30" />
      <path d="M13 22 C16 18 22 18 25.5 21 C22.5 26 17 28 12.5 27.5 Z" fill="#9f2026" />
      <path d="M26.5 13.2 C28.5 12.6 30.5 13 31.6 14 L33 15.6 L33 20.8 C31.5 22.6 28.6 22.4 27.4 20.6 C26.2 18.6 25.9 15.4 26.5 13.2 Z" fill="#1b1b1b" />
      <path d="M31.8 14.6 L38.5 17.6 L31.8 20.6 C31.2 18.6 31.2 16.6 31.8 14.6 Z" fill="#f2a33a" />
      <circle cx="28.9" cy="15.6" r="1.15" fill="#fff" />
      <path d="M18 31 L17.2 35.5 M22 31 L22.6 35.5" stroke="#5a3a1c" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

const CUSTOMER_NAV = [
  { href: "/shop", label: "Shop" },
  { href: "/orders", label: "Orders" },
  { href: "/account", label: "Account" },
];
const ADMIN_NAV = [
  { href: "/admin", label: "Upcoming", exact: true },
  { href: "/admin/shop", label: "Shopping" },
  { href: "/admin/calendar", label: "Calendar" },
  { href: "/admin/orders", label: "History" },
  { href: "/admin/customers", label: "Customers" },
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
      <div className={`${admin ? "max-w-6xl" : "max-w-3xl"} mx-auto px-4 h-16 flex items-center gap-3`}>
        <Link href={admin ? "/admin" : "/"} className="flex items-center gap-2 mr-auto">
          <RedbirdMark />
          <span className="font-display text-xl font-extrabold text-shell-dark">Redbird <span className="text-[var(--cardinal)]">Grocery</span></span>
        </Link>
        <nav className={`hidden ${admin ? "md:flex" : "sm:flex"} items-center gap-1`} aria-label="Main">
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
      <nav className={`${admin ? "md:hidden" : "sm:hidden"} flex border-t border-line`} aria-label="Main">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href}
            className={`flex-1 text-center py-2.5 font-bold ${admin ? "text-[13px]" : ""} ${isActive(n) ? "text-shell border-b-[3px] border-amber" : "text-muted"}`}>
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
