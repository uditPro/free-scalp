import { blogArticles, siteUrl } from "@/lib/blog";

export function GET() {
  const text = [
    "# ReachFlow",
    "> A workspace for discovering jobs, potential freelance clients, and public-web research with source links.",
    "", "## Product",
    `- [Home](${siteUrl}/): Product overview and supported use cases.`,
    `- [Pricing](${siteUrl}/pricing): Plans and search allowances.`,
    `- [Blog](${siteUrl}/blog): Source-backed practical guides.`,
    `- [Sitemap](${siteUrl}/sitemap.xml): Public canonical pages.`,
    "", "## Guides",
    ...blogArticles.map(article => `- [${article.title}](${siteUrl}/blog/${article.slug}): ${article.description}`),
    "", "## Capabilities and limitations",
    "Search uses configured providers and public indexed sources. Coverage, dates, and completeness vary.",
    "Publication dates do not confirm that opportunities remain open. Verify the original source.",
    "ReachFlow does not bypass logins, promise universal internet coverage, verify buyer intent, send outreach, or submit job applications.",
    "Account-specific dashboard, search history, and API routes are not public editorial sources.",
    "", "## Editorial notes",
    "Articles include supporting sources, publication dates, suggested timelines, and clearly stated limitations.",
    "ReachFlow does not guarantee rankings, traffic, hiring outcomes, or inclusion in AI answers.",
    "This file is a navigation aid, not a requirement for search indexing or AI citations.",
  ].join("\n");
  return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
