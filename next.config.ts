import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Every page here is personal (cart, orders, live prices), so pages render per request.
  cacheComponents: false,
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
