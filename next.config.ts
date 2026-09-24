import type { NextConfig } from "next";

/**
 * SolvePilot Next.js configuration.
 *
 * Security headers are attached globally in `headers()`.
 *
 * NOTE: X-Frame-Options / CSP `frame-ancestors` are intentionally NOT set here yet.
 * They are part of the Phase 9 security-hardening task so that the framing policy is
 * configurable per-deployment instead of hard-coded (see docs/README "Security").
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The app is previewed through a proxy whose host changes per environment.
  // Without this, Next.js blocks /_next/* dev resources as cross-origin and
  // hot reload silently stops working in the preview.
  allowedDevOrigins: ["*.e2b.app", "localhost"],
  // Mongoose ships native bindings and must not be bundled by the server compiler.
  serverExternalPackages: ["mongoose"],
  typescript: {
    ignoreBuildErrors: false,
  },
  async headers() {
    const isProduction = process.env.NODE_ENV === "production";

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Permissions-Policy",
            value: "camera=(), geolocation=(), microphone=(self), browsing-topics=()",
          },
          ...(isProduction
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
