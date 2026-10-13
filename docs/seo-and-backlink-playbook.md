# ReachFlow SEO and backlink playbook

This is the launch checklist for earning relevant, editorial links to ReachFlow. The codebase now supplies a stable technical foundation and two linkable public assets:

- `/resources` — a source-first opportunity research toolkit people can cite and share.
- `/editorial-policy` — clear sourcing, update, correction, and limitation standards.

External backlinks cannot be created or guaranteed by application code. They must be earned through useful resources, real relationships, and publisher review. Do not buy links, create private blog networks, spam comments, or submit mass-generated guest posts.

## 1. Technical release gate

Before outreach, deploy and verify:

1. `APP_URL` is the real application host and `SEO_CANONICAL_ORIGIN` is the final non-redirecting host, currently `https://www.reachflow.lol` if that remains the Vercel preference.
2. `https://www.reachflow.lol/robots.txt` returns 200 and declares `https://www.reachflow.lol/sitemap.xml`.
3. The sitemap contains only public pages and uses the same host as canonical tags, Open Graph URLs, and JSON-LD.
4. `/pricing`, `/resources`, `/editorial-policy`, `/blog`, and every article have a unique title, description, canonical, and server-rendered body.
5. `/login`, `/signup`, `/reset-password`, `/dashboard`, `/profile`, and `/applications/*` return `noindex` metadata or redirect to the noindex login page when unauthenticated.
6. Google Search Console URL Inspection confirms the canonical URL and live render for the home page, toolkit, blog index, and two representative articles.

## 2. Linkable assets

Build links to a specific useful page, not only the product home page:

- **Toolkit:** reference the four-step method when publishing career, freelancing, or research guidance.
- **Field guides:** cite the guide that contains the relevant source list and verification workflow.
- **Editorial policy:** use when a partner needs to understand how ReachFlow handles sources, updates, AI assistance, and uncertainty.

When a new guide is published, include at least one original contribution: a clearly defined method, a reproducible checklist, a source comparison, or a small public dataset analysis. A title change or extra keywords is not a backlink asset.

## 3. Relevant outreach targets

Research real organizations before contacting them. Prioritize:

- university and public-library career resource pages;
- workforce-development and freelancer-support organizations;
- accessibility, remote-work, and responsible-AI resource collections;
- procurement education groups that already cite SAM.gov, SBA, or USAspending resources;
- authors who have recently published a closely related guide and accept factual resource suggestions.

Do not contact a site merely because it has a high domain metric. The page's audience and editorial fit matter more than a score.

## 4. Short, human outreach template

> Subject: A source-first resource for [page topic]
>
> Hi [name] — I was reading [specific page] and noticed it helps readers with [specific task]. We published a free checklist for verifying [specific problem] at [exact ReachFlow URL]. It links to the original sources and states where the evidence is limited. If it is useful for your readers, feel free to review or cite it; no response is needed if it is not a fit.
>
> Thanks,
> [real name]

Send one relevant message, follow the publisher's submission rules, and stop after one respectful follow-up at most. Never imply an endorsement, relationship, or result that does not exist.

## 5. Measurement

Track the URL, publisher, date contacted, response, link status, destination page, and referral visits. In Search Console, review:

- impressions and average position by query and landing page;
- indexing status and duplicate/canonical-selected reasons;
- links report for referring domains and top linked pages;
- manual-action and security reports.

Evaluate qualified visits, newsletter or signup completion, and useful citations—not raw link count. A link from a relevant small organization can be more valuable than many unrelated directory links.

## 6. Ongoing maintenance

- Review source links and time-sensitive statements monthly.
- Update or redirect changed URLs rather than leaving stale assets online.
- Keep every article's visible answer, FAQ, JSON-LD, and `llms.txt` description synchronized.
- Add a contextual internal link from each new article to the toolkit and at least two related guides.
- Reclaim genuine broken links only when the replacement is materially useful; do not request links from pages that never referenced ReachFlow.

No SEO or backlink plan can guarantee Google rankings, clicks, AI citations, or customer acquisition. The repeatable advantage is a technically clear site plus resources that independent publishers would still recommend without being paid.
