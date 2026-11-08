import type { NextConfig } from "next";

// Development fixtures must never reach a production build (see docs/TECHNICAL_DECISIONS.md, D7).
if (process.env.NODE_ENV === "production" && process.env.PORTFOLIO_PREVIEW) {
  throw new Error(
    "PORTFOLIO_PREVIEW is set during a production build. Unset it: development fixtures must never be exported.",
  );
}

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  poweredByHeader: false,
  reactStrictMode: true,
  // Lets the dev server accept http://127.0.0.1:3000 as well as localhost (development only).
  allowedDevOrigins: ["127.0.0.1"],
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
