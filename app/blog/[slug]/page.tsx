import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header, Footer } from "@/components/brand";
import { ArticleBody, ArticleJsonLd } from "@/components/blog";
import { blogArticles, blogBySlug, siteUrl } from "@/lib/blog";
import Link from "next/link";
import Image from "next/image";

export function generateStaticParams() { return blogArticles.map(article => ({ slug: article.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = blogBySlug.get(slug);
  if (!article) notFound();
  const image = {
    url: `${siteUrl}/blog/${article.slug}/opengraph-image`,
    width: 1200,
    height: 630,
    alt: `${article.title} — ReachFlow field guide`,
    type: "image/png",
  };
  return {
    title: article.title,
    description: article.description,
    alternates: { canonical: `${siteUrl}/blog/${article.slug}` },
    openGraph: {
      type: "article",
      title: article.title,
      description: article.description,
      url: `${siteUrl}/blog/${article.slug}`,
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      authors: ["ReachFlow"],
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.description,
      images: [image],
    },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const article = blogBySlug.get(slug); if (!article) notFound(); const related = article.related.map(item => blogBySlug.get(item)).filter(Boolean); return <><Header/><main id="main" className="article-page"><ArticleJsonLd article={article}/><div className="container article-wrap"><nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><Link href="/blog">Blog</Link><span>/</span><span>{article.category}</span></nav><header className="article-header"><span className="eyebrow">{article.category} · {article.readingTime}</span><h1>{article.title}</h1><p className="article-description">{article.description}</p><p className="article-date">Published October 11, 2026 · Updated October 11, 2026</p></header><Image className="article-hero" src={article.hero.src} alt={article.hero.alt} width={article.hero.width} height={article.hero.height} priority/><div className="article-layout"><article><ArticleBody article={article}/></article><aside className="article-aside"><span className="eyebrow">Keep exploring</span><ul>{related.map(item => item && <li key={item.slug}><Link href={`/blog/${item.slug}`}>{item.title} <span aria-hidden="true">↗</span></Link></li>)}</ul><div className="article-cta"><h3>Turn research into momentum.</h3><p>ReachFlow helps you search with a little less tab-hopping.</p><Link className="button button-small" href="/signup">Try ReachFlow ↗</Link></div></aside></div></div></main><Footer/></>; }
