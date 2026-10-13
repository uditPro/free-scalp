import type { Metadata } from "next";
import { Header, Footer } from "@/components/brand";
import { BlogCard, BlogCollectionJsonLd } from "@/components/blog";
import { blogArticles, siteUrl } from "@/lib/blog";

export const metadata: Metadata = { title: "The ReachFlow field guide", description: "Practical guides for finding jobs, freelance clients, and trustworthy public signals.", alternates: { canonical: `${siteUrl}/blog` }, openGraph: { title: "The ReachFlow field guide", description: "Practical guides for finding jobs, freelance clients, and trustworthy public signals.", url: `${siteUrl}/blog`, type: "website", images: [{ url: `${siteUrl}/opengraph-image`, width: 1200, height: 630, alt: "ReachFlow field guide" }] }, twitter: { card: "summary_large_image", title: "The ReachFlow field guide", description: "Practical guides for finding jobs, freelance clients, and trustworthy public signals.", images: [`${siteUrl}/opengraph-image`] } };

export default function BlogPage() { return <><Header/><main id="main" className="blog-index"><BlogCollectionJsonLd articles={blogArticles}/><section className="blog-index-hero container"><span className="eyebrow">REACHFLOW FIELD GUIDE</span><h1>Find the signal.<br/><em>Make your move.</em></h1><p>Useful, source-backed ways to research opportunities without losing your judgment.</p></section><section className="container blog-grid" aria-label="Articles">{blogArticles.map(article => <BlogCard key={article.slug} article={article}/>)}</section></main><Footer/></>; }
