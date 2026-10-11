export function StructuredData() {
  const origin = process.env.APP_URL || "http://localhost:3000";
  const data = [
    { "@context": "https://schema.org", "@type": "Organization", name: "ReachFlow", url: origin, description: "A focused workspace for discovering jobs, prospective clients, and public-web research." },
    { "@context": "https://schema.org", "@type": "WebSite", name: "ReachFlow", url: origin, potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${origin}/dashboard?query={search_term_string}` }, "query-input": "required name=search_term_string" } },
    { "@context": "https://schema.org", "@type": "SoftwareApplication", name: "ReachFlow", applicationCategory: "BusinessApplication", operatingSystem: "Web", description: "Search supported public sources for job opportunities, prospective freelance clients, and research.", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } },
  ];
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
