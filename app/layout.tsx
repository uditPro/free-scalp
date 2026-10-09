import type { Metadata } from "next";
import "./globals.css";
import { StructuredData } from "@/components/structured-data";

export const metadata: Metadata = {
  title: { default: "ReachFlow — Find your next opening.", template: "%s · ReachFlow" },
  description: "Discover job opportunities, prospective clients, and research across supported internet sources. Less tab-hopping. More possibility.",
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  applicationName: "ReachFlow",
  keywords: ["job discovery", "freelance clients", "public web research", "remote jobs", "opportunity search"],
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: "ReachFlow", title: "ReachFlow — Find your next opening.", description: "Search supported public sources for jobs, prospective clients, and research.", url: "/" },
  twitter: { card: "summary_large_image", title: "ReachFlow — Find your next opening.", description: "A focused workspace for discovering jobs, potential clients, and research." },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><StructuredData/><a className="skip-link" href="#main">Skip to content</a>{children}</body></html>;
}
