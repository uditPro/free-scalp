import type { Metadata } from "next";
import Link from "next/link";
import { Header, Footer } from "@/components/brand";
import { blogArticles, siteUrl } from "@/lib/blog";
import "../resources.css";

export const metadata: Metadata = {
  title: "Opportunity research toolkit",
  description:
    "A practical, source-first toolkit for researching jobs, freelance clients, and public opportunities with less noise and more evidence.",
  alternates: { canonical: `${siteUrl}/resources` },
  openGraph: {
    type: "website",
    title: "Opportunity research toolkit",
    description:
      "A practical, source-first toolkit for researching jobs, freelance clients, and public opportunities.",
    url: `${siteUrl}/resources`,
  },
  twitter: {
    card: "summary_large_image",
    title: "Opportunity research toolkit",
    description:
      "A practical, source-first toolkit for researching jobs, freelance clients, and public opportunities.",
  },
};

const steps = [
  [
    "1",
    "Write the decision",
    "Define the role, service, location, timeframe, and evidence that would change your next action.",
  ],
  [
    "2",
    "Find the primary source",
    "Prefer the employer, agency, publisher, or dataset that created the information over a repost or summary.",
  ],
  [
    "3",
    "Record what you can prove",
    "Save the URL, date checked, relevant passage or field, and the uncertainty that remains.",
  ],
  [
    "4",
    "Choose a low-risk next step",
    "Apply, ask one clear question, monitor the source, partner, or pass. A lead without a next action becomes noise.",
  ],
] as const;

const checklist = [
  "What exactly am I trying to decide?",
  "What is the oldest or most direct source I can inspect?",
  "What date, location, eligibility, or deadline could change the answer?",
  "Which claim is confirmed, unclear, or contradicted?",
  "What is the next action—and when will I stop?",
] as const;

const templateFields = [
  [
    "Claim or question",
    "The decision-relevant statement you are checking, written narrowly enough to verify.",
  ],
  [
    "Source and date",
    "The page or dataset you inspected and the date you actually checked it.",
  ],
  [
    "Evidence",
    "A short quote, field name, or location in the source—not a summary detached from it.",
  ],
  [
    "Status and next action",
    "Mark the claim confirmed, unclear, or contradicted, then record what happens next.",
  ],
] as const;

export default function ResourcesPage() {
  return (
    <>
      <Header />
      <main id="main" className="resources-page">
        <section
          className="container resources-hero"
          aria-labelledby="resources-heading"
        >
          <div className="resources-hero-copy">
            <span className="eyebrow">REACHFLOW RESOURCES</span>
            <h1 id="resources-heading">
              Research with
              <br />
              <em>receipts.</em>
            </h1>
            <p>
              A free, reusable starting point for finding opportunities,
              checking claims, and deciding what deserves your attention.
            </p>
          </div>
          <aside className="resources-hero-note" aria-label="Toolkit scope">
            <span className="eyebrow">USE IT FOR</span>
            <p>
              Jobs, potential freelance clients, public procurement research,
              and any lead where a source and a next action matter.
            </p>
            <span className="resource-note-rule" aria-hidden="true" />
            <p className="small muted">
              Published <time dateTime="2026-10-13">October 13, 2026</time> ·
              ReachFlow
            </p>
          </aside>
        </section>

        <section
          className="container resource-section resource-method"
          aria-labelledby="method-heading"
        >
          <div className="resource-section-heading">
            <div>
              <span className="eyebrow">THE SOURCE-FIRST METHOD</span>
              <h2 id="method-heading">
                A simple loop for
                <br />
                <em>better decisions.</em>
              </h2>
            </div>
            <p>
              Search is discovery. Evidence is what lets you act without
              overclaiming.
            </p>
          </div>
          <div className="resource-step-grid">
            {steps.map(([number, title, text]) => (
              <article className="resource-step" key={number}>
                <span className="resource-step-number" aria-hidden="true">
                  {number}
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          className="container resource-template"
          id="evidence-log"
          aria-labelledby="template-heading"
        >
          <div className="resource-template-copy">
            <span className="eyebrow">DOWNLOADABLE WORKSHEET</span>
            <h2 id="template-heading">
              Keep the evidence
              <br />
              <em>close at hand.</em>
            </h2>
            <p>
              Use the CSV as a small evidence log for a search session or a
              client research brief. Start with a question, preserve what the
              source actually supports, and leave unknown fields blank.
            </p>
            <a
              className="button resource-download"
              href="/resources/opportunity-research-template.csv"
              download="opportunity-research-template.csv"
              aria-describedby="template-note"
            >
              Download the CSV template
              <span aria-hidden="true">↓</span>
            </a>
            <p id="template-note" className="resource-disclaimer">
              <strong>Before you use it:</strong> the included row is clearly
              marked as a fictional example, not a live job, client, or
              opportunity. Replace or remove it before recording real research.
            </p>
          </div>
          <div className="resource-template-card">
            <div className="resource-template-card-heading">
              <span className="resource-file-type">CSV</span>
              <span>Blank-first evidence log</span>
            </div>
            <dl className="resource-field-list">
              {templateFields.map(([label, description]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{description}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section
          className="container resource-checklist"
          aria-labelledby="checklist-heading"
        >
          <div className="resource-checklist-heading">
            <span className="eyebrow">COPY-PASTE CHECKLIST</span>
            <h2 id="checklist-heading">
              Keep every lead
              <br />
              <em>auditable.</em>
            </h2>
          </div>
          <ul className="resource-checklist-list">
            {checklist.map((item) => (
              <li key={item}>
                <span aria-hidden="true">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section
          className="container resource-section resource-guides"
          aria-labelledby="guides-heading"
        >
          <div className="resource-section-heading">
            <div>
              <span className="eyebrow">GO DEEPER</span>
              <h2 id="guides-heading">
                Practical
                <br />
                <em>field guides.</em>
              </h2>
            </div>
            <p>
              Each guide gives a direct answer, a practical workflow, source
              links, and boundaries worth keeping visible.
            </p>
          </div>
          <div className="resource-guide-list">
            {blogArticles.map((article) => (
              <Link
                className="resource-guide-link"
                key={article.slug}
                href={`/blog/${article.slug}`}
              >
                <span>
                  <strong>{article.title}</strong>
                  <small>
                    {article.category} · {article.readingTime}
                  </small>
                </span>
                <span aria-hidden="true">↗</span>
              </Link>
            ))}
          </div>
        </section>

        <section
          className="container resource-citation"
          aria-labelledby="citation-heading"
        >
          <span className="eyebrow">SHARE OR CITE THIS PAGE</span>
          <h2 id="citation-heading">
            Useful resources travel
            <br />
            <em>further.</em>
          </h2>
          <p>
            You may link to this toolkit or any ReachFlow guide as a starting
            point for responsible opportunity research. Verify time-sensitive
            claims against the original sources linked on each page before
            acting.
          </p>
          <p className="small muted">
            Published <time dateTime="2026-10-13">October 13, 2026</time> ·
            ReachFlow
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
