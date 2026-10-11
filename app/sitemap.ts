import type { MetadataRoute } from "next";
import { blogArticles } from "@/lib/blog";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APP_URL || "http://localhost:3000";
  return [{ url: `${base}/`, changeFrequency: "weekly" as const, priority: 1 }, { url: `${base}/blog`, changeFrequency: "weekly" as const, priority: 0.8 }, ...blogArticles.map(article => ({ url: `${base}/blog/${article.slug}`, lastModified: article.updatedAt, images: [`${base}${article.hero.src}`], changeFrequency: "monthly" as const, priority: 0.7 })), { url: `${base}/pricing`, changeFrequency: "monthly" as const, priority: 0.5 }];
}
