import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource/atkinson-hyperlegible/latin-400.css";
import "@fontsource/atkinson-hyperlegible/latin-700.css";
import "./globals.css";
import { CartProvider } from "@/lib/cart";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Speedy Turtle",
  description: "Kroger and Meijer groceries, shopped and delivered by Cody.",
  appleWebApp: { capable: true, title: "Speedy Turtle", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#1f5a40", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <CartProvider>
          <SiteHeader />
          <main className="flex-1 w-full max-w-3xl mx-auto px-4 pb-24 pt-4">{children}</main>
        </CartProvider>
      </body>
    </html>
  );
}
