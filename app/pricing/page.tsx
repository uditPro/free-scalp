import type { Metadata } from "next";
import { Header, Footer } from "@/components/brand";
import Pricing from "@/components/pricing";
import { siteUrl } from "@/lib/blog";

export const metadata: Metadata = {
  title: "ReachFlow pricing",
  description: "Compare ReachFlow search allowances for discovering jobs, prospective clients, and public-web research.",
  alternates: { canonical: `${siteUrl}/pricing` },
  openGraph: { type: "website", title: "ReachFlow pricing", description: "Compare ReachFlow search allowances for jobs, clients, and research.", url: `${siteUrl}/pricing` },
  twitter: { card: "summary_large_image", title: "ReachFlow pricing", description: "Compare ReachFlow search allowances for jobs, clients, and research." },
};

export default function PricingPage() { return <><Header/><main id="main" className="container pricing-page"><div className="page-intro"><span className="eyebrow">INVEST IN WHAT’S NEXT</span><h1>A little more room<br/>for <em>possibility.</em></h1><p>Choose the pace that works for you.<br/>Keep your discoveries in one thoughtful workspace.</p></div><Pricing/></main><Footer/></>; }
