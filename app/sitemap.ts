import type { MetadataRoute } from "next";
const SITE = "https://aster-iq-in.vercel.app";
export default function sitemap(): MetadataRoute.Sitemap { const now = new Date(); return ["","/login","/signup","/plans","/prompts"].map((p) => ({ url: `${SITE}${p}`, lastModified: now, changeFrequency: "weekly", priority: p === "" ? 1 : 0.7 })); }
