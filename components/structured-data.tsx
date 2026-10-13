import { seoOrigin } from "@/lib/seo";

export function StructuredData() {
  const origin = seoOrigin();
  const data = [
    { "@context": "https://schema.org", "@type": "Organization", name: "ReachFlow", url: origin, logo: `${origin}/icon.svg`, description: "A focused workspace for discovering jobs, prospective clients, and public-web research." },
    { "@context": "https://schema.org", "@type": "WebSite", name: "ReachFlow", url: origin, description: "A workspace for discovering jobs, prospective clients, and public-web research." },
    { "@context": "https://schema.org", "@type": "SoftwareApplication", name: "ReachFlow", applicationCategory: "BusinessApplication", operatingSystem: "Web", description: "Search supported public sources for job opportunities, prospective freelance clients, and research." },
  ];
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
