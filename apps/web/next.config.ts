import type { NextConfig } from "next";
import path from "path";

// Origins the app legitimately talks to. Derived from env where available so
// the CSP stays correct across environments; falls back to wildcards.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";

const connectSrc = [
  "'self'",
  supabaseUrl,
  apiUrl,
  "https://*.supabase.co",
  "wss://*.supabase.co",
  "https://accounts.google.com",
]
  .filter(Boolean)
  .join(" ");

// NOTE: script-src keeps 'unsafe-inline' because Next.js injects inline
// bootstrap scripts without a nonce. Tighten to a nonce-based policy later.
// May need tuning if a resource gets blocked in the console.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: https:",
  "font-src 'self' https://fonts.gstatic.com data:",
  `connect-src ${connectSrc}`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  env: {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
