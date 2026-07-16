import type { MetadataRoute } from "next";
const SITE = "https://aster-iq-in.vercel.app";
export default function robots(): MetadataRoute.Robots { return { rules: [{ userAgent: "*", allow: "/", disallow: ["/api/","/admin","/builder","/dashboard","/connections","/deployments"] }], sitemap: `${SITE}/sitemap.xml`, host: SITE }; }
