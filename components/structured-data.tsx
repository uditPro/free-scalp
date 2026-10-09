export function StructuredData() {
  const origin = process.env.APP_URL || "http://localhost:3000";
  const data = [
    { "@context": "https://schema.org", "@type": "Organization", name: "ReachFlow", url: origin, description: "A focused workspace for discovering jobs, prospective clients, and public-web research." },
    { "@context": "https://schema.org", "@type": "WebSite", name: "ReachFlow", url: origin, potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${origin}/dashboard?query={search_term_string}` }, "query-input": "required name=search_term_string" } },
    { "@context": "https://schema.org", "@type": "SoftwareApplication", name: "ReachFlow", applicationCategory: "BusinessApplication", operatingSystem: "Web", description: "Search supported public sources for job opportunities, prospective freelance clients, and research.", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: ["What exactly is ReachFlow?", "Are the results real?", "Can it search the entire internet?", "Can I save and export my discoveries?", "Will ReachFlow contact people for me?"].map(name => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text: name === "Are the results real?" ? "Workspace searches return genuine connector responses with links to original public sources. The homepage preview is illustrative sample data." : name === "Can it search the entire internet?" ? "No. Availability depends on configured supported connectors and public source access." : name === "Will ReachFlow contact people for me?" ? "No. ReachFlow helps discover information but does not send messages or submit applications automatically." : "ReachFlow is a focused workspace for discovering jobs, prospective clients, and public-web research." } })) },
  ];
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
