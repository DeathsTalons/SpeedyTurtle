import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Every page here is personal (cart, orders, live prices), so pages render per request.
  cacheComponents: false,
  // Receipt photos are resized on the phone (a few hundred KB), but leave room for a big one.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
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
