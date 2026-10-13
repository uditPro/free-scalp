import type { Metadata } from "next";
import Link from "next/link";
import { Header, Footer } from "@/components/brand";
import { siteUrl } from "@/lib/blog";
import "../resources.css";

export const metadata: Metadata = {
  title: "ReachFlow editorial policy",
  description:
    "How ReachFlow describes its published research methods, sources, limitations, and updates.",
  alternates: { canonical: `${siteUrl}/editorial-policy` },
  openGraph: {
    type: "website",
    title: "ReachFlow editorial policy",
    description:
      "How ReachFlow describes its published research methods, sources, limitations, and updates.",
    url: `${siteUrl}/editorial-policy`,
  },
};

const principles = [
  {
    id: "source-before-summary",
    heading: "Source before summary",
    text: "For consequential claims, ReachFlow prioritizes original employer, government, publisher, and dataset pages. Search snippets and AI summaries can help with discovery, but they are not treated as proof.",
  },
  {
    id: "facts-before-confidence",
    heading: "Facts before confidence",
    text: "Articles separate what a source says from ReachFlow's interpretation. Unknown, stale, or conflicting information is described as a limitation rather than filled with invented certainty.",
  },
  {
    id: "freshness-is-visible",
    heading: "Freshness is visible",
    text: "Guides carry publication or update dates. Time-sensitive advice points readers back to the source and encourages a fresh check before acting; a page date is not a promise that every source was rechecked on that date.",
  },
  {
    id: "human-judgment",
    heading: "Human judgment stays in the loop",
    text: "AI may assist with organizing research, but it does not replace source inspection, privacy review, or a person's decision about an application, outreach, or other consequential action.",
  },
] as const;

export default function EditorialPolicyPage() {
  return (
    <>
      <Header />
      <main id="main" className="article-page">
        <div className="container article-wrap">
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Editorial policy</span>
          </nav>

          <header className="article-header">
            <span className="eyebrow">ABOUT THE FIELD GUIDE</span>
            <h1>
              Useful answers.
              <br />
              <em>Honest edges.</em>
            </h1>
            <p className="article-description">
              ReachFlow publishes practical guidance for finding jobs,
              potential freelance clients, and public-web signals without
              pretending that a search result is a guarantee.
            </p>
            <p className="article-byline">
              <span>ReachFlow</span>
              <span aria-hidden="true">·</span>
              <time dateTime="2026-10-13">Published October 13, 2026</time>
            </p>
          </header>

          <div className="article-layout">
            <article>
              <section className="article-answer" id="promise">
                <span className="eyebrow">OUR PROMISE</span>
                <p>
                  We aim to make each guide useful without making it sound more
                  certain than its evidence. That means direct answers, visible
                  sources, clear dates, and an explicit next step for verifying
                  anything consequential.
                </p>
              </section>

              <section className="article-section" id="method">
                <h2>How the guides are prepared</h2>
                <p>
                  ReachFlow turns public research questions into bounded
                  explanations, checklists, and next actions. The published
                  method favors source links, specific evidence fields, and
                  explicit uncertainty over a larger list of unsupported
                  claims.
                </p>
                <p>
                  A linked source is a place for readers to begin checking a
                  claim. It does not mean the source is complete, current, or
                  independently verified by ReachFlow. Readers should inspect
                  the original page when timing, eligibility, price, safety,
                  legal status, or another important condition could change the
                  decision.
                </p>
              </section>

              {principles.map(({ id, heading, text }) => (
                <section className="article-section" id={id} key={id}>
                  <h2>{heading}</h2>
                  <p>{text}</p>
                </section>
              ))}

              <section className="article-section" id="review-scope">
                <h2>Authorship and review scope</h2>
                <p>
                  This material is authored by ReachFlow. No named independent
                  expert review is claimed for this policy or the field guide.
                  For legal, financial, procurement, or safety-critical
                  decisions, use the relevant primary materials and seek
                  qualified advice for your circumstances.
                </p>
              </section>

              <section className="article-section" id="updates">
                <h2>Corrections and updates</h2>
                <p>
                  When ReachFlow identifies a factual error, broken link, or
                  material change, a page may be edited and its date may be
                  changed. This describes the intended handling of issues; it
                  is not a promise of continuous monitoring, a response time,
                  or that every issue has already been found.
                </p>
                <p>
                  Readers should use the original linked source for current
                  eligibility, deadlines, pricing, legal requirements, and
                  hiring status. ReachFlow does not promise that an opportunity
                  is open, safe, suitable, or available to every reader.
                </p>
              </section>

              <section className="article-section" id="boundaries">
                <h2>What we do not publish</h2>
                <p>
                  We do not sell personal contact lists, fabricate job or
                  client results, present historical procurement awards as live
                  leads, or claim that an SEO file guarantees Google rankings
                  or AI citations. We do not ask readers to pay to apply for a
                  job or share sensitive information through an unverified
                  channel.
                </p>
              </section>

              <section className="article-sources" id="start">
                <h2>Start with the toolkit</h2>
                <p>
                  Use the <Link href="/resources">Opportunity research toolkit</Link>{" "}
                  for a compact method, then open the sources in each{" "}
                  <Link href="/blog">field guide</Link> before acting.
                </p>
              </section>
            </article>

            <aside className="article-aside">
              <span className="eyebrow">IN THIS POLICY</span>
              <nav aria-label="Editorial policy sections">
                <ul>
                  <li>
                    <a href="#method">Published method</a>
                  </li>
                  <li>
                    <a href="#source-before-summary">Sources and evidence</a>
                  </li>
                  <li>
                    <a href="#review-scope">Authorship and review</a>
                  </li>
                  <li>
                    <a href="#updates">Updates and limits</a>
                  </li>
                </ul>
              </nav>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
