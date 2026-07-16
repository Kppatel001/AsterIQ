import type { Metadata } from "next";
import { APP_NAME, APP_TAGLINE, APP_DESCRIPTION } from "@/frontend/brand";
import "./globals.css";
const SITE = "https://aster-iq-in.vercel.app";
const TITLE = `${APP_NAME} — ${APP_TAGLINE}`;
export const metadata: Metadata = {
  metadataBase: new URL(SITE), title: TITLE, description: APP_DESCRIPTION, applicationName: APP_NAME,
  alternates: { canonical: "/" }, robots: { index: true, follow: true },
  openGraph: { type: "website", url: "/", siteName: APP_NAME, title: TITLE, description: APP_DESCRIPTION, locale: "en_IN", images: [{ url: "/icon.svg", width: 512, height: 512, alt: APP_NAME }] },
  twitter: { card: "summary_large_image", title: TITLE, description: APP_DESCRIPTION, images: ["/icon.svg"] },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased min-h-screen relative">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-3 focus:left-3 focus:rounded-lg focus:bg-white focus:text-black focus:px-4 focus:py-2 focus:font-semibold">Skip to content</a>
        <div className="blob blob-1" /><div className="blob blob-2" /><div className="blob blob-3" />
        <main id="main" className="relative z-10">{children}</main>
      </body>
    </html>
  );
}
