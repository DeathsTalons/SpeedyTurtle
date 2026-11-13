import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Every page here is personal (cart, orders, live prices), so pages render per request.
  cacheComponents: false,
  // Receipt photos are resized on the phone (a few hundred KB), but leave room for a big one.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  // The service worker (push notifications) must always be fresh.
  async headers() {
    return [{
      source: "/sw.js",
      headers: [
        { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
      ],
    }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
