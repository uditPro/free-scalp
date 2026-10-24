import type { MetadataRoute } from "next";
import { blogArticles } from "@/lib/blog";
import { seoOrigin } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = seoOrigin();
  return [
    { url: `${base}/`, changeFrequency: "weekly" as const, priority: 1 },
    { url: `${base}/blog`, changeFrequency: "weekly" as const, priority: 0.8 },
    { url: `${base}/resources`, changeFrequency: "monthly" as const, priority: 0.7 },
    { url: `${base}/editorial-policy`, changeFrequency: "yearly" as const, priority: 0.4 },
    { url: `${base}/jobs`, changeFrequency: "daily" as const, priority: 0.8 },
    ...blogArticles.map(article => ({
      url: `${base}/blog/${article.slug}`,
      lastModified: article.updatedAt,
      images: [`${base}/blog/${article.slug}/opengraph-image`],
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${base}/pricing`, changeFrequency: "monthly" as const, priority: 0.5 },
    { url: `${base}/affiliate`, changeFrequency: "monthly" as const, priority: 0.5 },
  ];
}
