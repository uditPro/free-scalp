import Image from "next/image";
import Link from "next/link";
import { siteUrl } from "@/lib/blog";
import type { BlogArticle } from "@/lib/blog";

export function BlogCard({ article }: { article: BlogArticle }) {
  return <article className="blog-card"><Link href={`/blog/${article.slug}`}><Image src={article.hero.src} alt={article.hero.alt} width={article.hero.width} height={article.hero.height}/><div className="blog-card-copy"><span className="eyebrow">{article.category} · {article.readingTime}</span><h2>{article.title}</h2><p>{article.description}</p><span className="text-button">Read the guide <span aria-hidden="true">↗</span></span></div></Link></article>;
}

export function ArticleBody({ article }: { article: BlogArticle }) {
  return <>
    <div className="article-answer"><span className="eyebrow">The short answer</span><p>{article.directAnswer}</p></div>
    {article.sections.map(section => <section className="article-section" key={section.heading}><h2>{section.heading}</h2>{section.paragraphs.map(p => <p key={p}>{p}</p>)}</section>)}
    <section className="article-checklist"><h2>Action checklist</h2><ul>{article.checklist.map(item => <li key={item}><span aria-hidden="true">✓</span>{item}</li>)}</ul></section>
    <section className="article-faq" id="faq"><h2>Frequently asked questions</h2>{article.faq.map(item => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</section>
    <section className="article-sources"><h2>Sources</h2><p className="small muted">Checked October 11, 2026. Sources are provided for verification and context.</p><ul>{article.sources.map(item => <li key={item.url}><a href={item.url} target="_blank" rel="noreferrer">{item.label} ↗</a></li>)}</ul></section>
  </>;
}

export function ArticleJsonLd({ article }: { article: BlogArticle }) {
  const graph: Record<string, unknown>[] = [{ "@type": "Article", "@id": `${siteUrl}/blog/${article.slug}#article`, headline: article.title, description: article.description, datePublished: article.publishedAt, dateModified: article.updatedAt, image: [`${siteUrl}${article.hero.src}`], author: { "@type": "Organization", name: "ReachFlow", url: siteUrl }, publisher: { "@type": "Organization", name: "ReachFlow" }, mainEntityOfPage: `${siteUrl}/blog/${article.slug}` }, { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: `${siteUrl}/` }, { "@type": "ListItem", position: 2, name: "Blog", item: `${siteUrl}/blog` }, { "@type": "ListItem", position: 3, name: article.title, item: `${siteUrl}/blog/${article.slug}` }] }];
  if (article.faq.length) graph.push({ "@type": "FAQPage", mainEntity: article.faq.map(item => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })) });
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c") }}/>;
}
