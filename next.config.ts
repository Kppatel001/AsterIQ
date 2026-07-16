import type { NextConfig } from "next";
const cspEnforced = ["default-src 'self'","base-uri 'self'","object-src 'none'","frame-ancestors 'self'","form-action 'self'","img-src 'self' data: blob: https:","font-src 'self' data: https:","style-src 'self' 'unsafe-inline' https:","script-src 'self' 'unsafe-inline' 'unsafe-eval' https: blob:","connect-src 'self' https: wss:","frame-src 'self' https: blob: data:","worker-src 'self' blob:"].join("; ");
const cspRO = ["default-src 'self'","base-uri 'self'","object-src 'none'","frame-ancestors 'self'","form-action 'self'","script-src 'self' 'unsafe-inline'","style-src 'self' 'unsafe-inline' https://fonts.googleapis.com","img-src 'self' data: blob: https:","font-src 'self' https://fonts.gstatic.com","connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://integrate.api.nvidia.com https://api.github.com","frame-src 'self' https://*.firebaseapp.com https://accounts.google.com","worker-src 'self' blob:","report-uri /api/csp-report","report-to csp-endpoint"].join("; ");
const securityHeaders = [
  { key: "Content-Security-Policy", value: cspEnforced },
  { key: "Content-Security-Policy-Report-Only", value: cspRO },
  { key: "Reporting-Endpoints", value: 'csp-endpoint="/api/csp-report"' },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-XSS-Protection", value: "0" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=(), browsing-topics=()" },
];
const nextConfig: NextConfig = { reactStrictMode: true, eslint: { ignoreDuringBuilds: true }, async headers() { return [{ source: "/:path*", headers: securityHeaders }]; } };
export default nextConfig;
