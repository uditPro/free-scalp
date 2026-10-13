import type { MetadataRoute } from "next";
import { seoOrigin } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const base = seoOrigin();
  // Private routes return noindex metadata or redirect to the noindex login
  // page. Keep them crawlable enough for Google to observe those directives;
  // API endpoints remain out of the crawl surface entirely.
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }], sitemap: `${base}/sitemap.xml` };
}
