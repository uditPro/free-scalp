# ReachFlow

Independent Next.js application for job, potential-client, and research discovery.
Inspired by [Agent-Reach](https://github.com/Panniantong/Agent-Reach)'s connector approach;
not a fork, not affiliated, and not a universal internet scraper. No upstream source code is bundled.

## Run locally

Requires Node.js 20.9+ and npm. From this folder:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Marketing pages and dashboard configuration states work without credentials.
Create `.env.local` using `.env.example` and supply your own service values privately. Never commit keys.

## Configure live services

1. Create a Supabase project. Apply the migrations in `supabase/migrations/` in numeric order. `008_housing.sql` adds the rental matching tables and RLS policies; `009_housing_any_location.sql` expands the pilot from Ahmedabad to any city, metro, or town; `010_employer_jobs.sql` adds verified-employer job posting and in-platform applications; `011_job_provenance_and_integrity.sql` adds source provenance and posting-integrity metadata for AI job search; `012_job_promotions.sql` adds transparent, Stripe-paid sponsored job placement; `013_homepage_promotions.sql` adds the public homepage auction for a business website or X username without business verification; `014_site_presence.sql` adds anonymous first-party visit and active-user metrics; `015_homepage_promotion_metadata.sql` stores fetched website/X descriptions, logos, and repeat-bid identity keys; `016_gtm_outreach_agent.sql` adds company context, briefs, campaigns, approval queues, and agent runs; `017_gtm_credits.sql` adds $30 welcome outreach credits and plan-linked email credits.
2. Configure email confirmation, SMTP and the allowed `/api/auth/callback` URL.
3. Provide `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` for signup/login.
   `SUPABASE_SECRET_KEY` is server-only and required for search/billing, not authentication.
   Legacy anonymous/service-role environment names remain supported.
4. Search defaults to the Agent-Reach-compatible keyless Exa MCP endpoint
   (`https://mcp.exa.ai/mcp`) when no `EXA_API_KEY` is configured. This is rate-limited
   and not a production SLA. For dedicated usage set `SEARCH_PROVIDER=exa-api` and
   provide an `EXA_API_KEY`; `SEARCH_PROVIDER=auto` chooses the dedicated API when the
     key exists. Searches save only normalized source-linked results in Supabase.
   Rental matching refreshes public indexed web sources and publicly indexed Facebook pages/groups for the requested location. Private or login-only groups are not scraped, and every result remains explicitly source-only until verified.
5. Configure Stripe recurring Starter/Pro prices, customer portal and signed webhook endpoint.
6. Set `APP_URL` to the exact canonical origin, including port locally; use HTTPS in production.
   Use the same host that Vercel does not redirect (for example, if Vercel redirects the apex
    to `www`, set `APP_URL=https://www.reachflow.lol`). This keeps the Supabase PKCE cookie on
    the host that receives the OAuth callback. Set `SEO_CANONICAL_ORIGIN` to that same final
    host when both apex and `www` aliases are active; it keeps canonical tags, JSON-LD, robots,
    and the sitemap on one non-redirecting origin.
7. For Google sign-in, enable Google under Supabase **Authentication → Providers → Google**.
   In Google Cloud OAuth credentials, add the Supabase callback URL shown by Supabase
   (normally `https://<project-ref>.supabase.co/auth/v1/callback`) as an authorized redirect URI,
   then add the Google client ID and secret to the Supabase provider settings.

See `supabase/README.md` for the detailed database/auth/billing checklist.

### Search connector and Agent-Reach

ReachFlow uses the hosted Exa MCP search path recommended by Agent-Reach, but does not
execute Agent-Reach shell commands, install its CLI, read cookies, or copy its
platform-specific connectors. Agent-Reach is MIT-licensed, but its individual channels
still have separate platform terms, login requirements, and account-risk considerations;
this app only adopts the documented Exa search transport. Keyless MCP is suitable for
smoke tests, not a guaranteed production service.

### Optional Windows Agent-Reach worker

For local, user-authorized Agent-Reach channels, run PowerShell from the project root:

```powershell
.\worker\setup-worker.ps1
.\worker\start-worker.ps1
```

The setup creates a private worker token, installs the upstream MIT Agent-Reach package
inside `worker/.venv`, and writes the loopback worker settings to ignored `.env.local`.
The worker binds only to `127.0.0.1:8787`, accepts a fixed read-only search API, and never
accepts arbitrary shell commands. It can use locally installed `gh`, `yt-dlp`, `bili`,
`opencli`, and `rdt` when available. Login-backed tools require you to configure and
control those sessions yourself; ReachFlow never receives your cookies or passwords.

After changing `.env.local`, restart ReachFlow. Without the worker, public Exa MCP search
continues to work normally. The worker is intended for the local Windows deployment; a
hosted ReachFlow server cannot reach `127.0.0.1` on your PC without a separately secured
outbound relay.

### Safe Supabase setup helper

Run `npm run setup:supabase` for a read-only preview. With a Supabase Management API token
stored privately as `SUPABASE_ACCESS_TOKEN` in `.env.local`, run
`npm run setup:supabase -- --apply` to apply the migration and add the exact callback URLs.
The helper refuses to use project API keys as admin credentials, stops on partial schemas,
preserves existing redirects, and verifies the result. Without a Management API token,
run `supabase/migrations/001_initial.sql` in the Supabase SQL editor and add the two
callback URLs manually. Never share management or secret keys in chat.

### Complete signup/login setup

1. In Supabase **Authentication → URL Configuration**, set Site URL to the exact
   `APP_URL`. For local development this is `http://localhost:3000`.
2. Add both redirect URLs:
   - `http://localhost:3000/api/auth/callback`
   - `http://localhost:3000/api/auth/callback?next=recovery`
   Add the equivalent HTTPS URLs before deploying; do not use broad production wildcards.
   If both apex and `www` domains are active, add both production callbacks:
   `https://reachflow.lol/api/auth/callback` and
   `https://www.reachflow.lol/api/auth/callback`.
3. Keep email confirmation enabled. Configure custom SMTP to deliver mail to your
   users; Supabase's default mail sender may restrict recipients and sending rates.
4. Apply `supabase/migrations/001_initial.sql` in the Supabase SQL editor. The
   migration provisions profiles, tenant policies, history and quota functions.
   Without it, Auth can sign users in but search/billing remain unavailable; the
   dashboard explicitly reports the database setup issue rather than logging users out.
5. Restart the application after updating `.env.local`. A running production
   server needs a rebuild/restart after code changes: `npm run build`, then `npm start`.
6. Open `/signup`, use an email you control, and follow the confirmation link in
   the **same browser** (the default flow uses PKCE). Check `/dashboard`, sign out,
   log in again, then verify the password-reset email and new-password flow.
   `/login` and `/signup` offer a confirmation-email resend action.
   Those screens also offer **Continue with Google**; the callback uses the exact Supabase
   allow-list URL so the PKCE cookie remains available.

For email links that must work across browsers, Supabase email templates can use
the supported token-hash callback instead of the default PKCE confirmation URL:

```html
<!-- Confirm signup -->
<a href="{{ .SiteURL }}/api/auth/callback?token_hash={{ .TokenHash }}&type=signup">Confirm email</a>
<!-- Reset password -->
<a href="{{ .SiteURL }}/api/auth/callback?token_hash={{ .TokenHash }}&type=recovery">Reset password</a>
```

Use the correct Site URL for these templates. Do not share the resulting links,
passwords, session cookies, or secret keys. Rotate any secret key exposed in chat.
`SUPABASE_JWKS_URL` is not required by this app: the Supabase SDK's `getUser()`
verifies the session with the Auth service rather than trusting browser claims.

## Implemented

- Responsive marketing website, sample preview explicitly labeled, pricing and FAQs.
- Signup/login, verification callback, recovery and password update screens.
- Search dashboard, source links, history and CSV export.
- Private candidate profile, explainable job-fit analysis, tailored resume/cover-letter drafts,
  interview questions, and application tracking. Managed AI is optional; deterministic drafts are
  used when no AI server is configured.
- Seven-day software-engineer job sprint at `/job-hunt`: set a target, save progress in the
  tenant-owned candidate profile, and follow a daily discover → verify → prepare → apply →
  follow-up loop. It reuses the existing search and application workflow; it does not promise a
  job in seven days or submit applications/messages automatically.
- Verified employer portal at `/employer` and public job board at `/jobs`: a signed-in employer
  must use a non-consumer business email whose domain matches the company website before the
  portal unlocks free job posting. Candidates can browse published roles, apply with their
  ReachFlow profile/resume, and see employer status updates in `/applications`.
- Lead finder and lightweight CRM: customize niche, geography, business type, need, sources, and
  contact preference; save public business records, score them deterministically, add notes, manage
  statuses, and export tenant-owned leads. Apply `005_leads_crm.sql` before using saved leads.
- Outreach agent at `/outreach`: company context, lead briefs, public-source discovery, evidence-backed
  drafts, campaigns, human approval, protected hourly autopilot, Resend delivery, run history, and a
  tenant-isolated credit wallet. New accounts receive $30 welcome outreach credits; Starter adds $10
  monthly credits and Pro adds $20 monthly credits. Sending costs $0.04 per confirmed email.
- Real Exa API adapter with jobs/clients/research query modes; no fabricated live results.
- Agent-Reach-compatible hosted Exa MCP connector with keyless smoke-test mode and dedicated API-key mode.
- Safe Supabase setup preview/apply helper that verifies schema and exact callback redirects.
- Tenant-scoped database reads and atomic server-only monthly quota reservation.
- Stripe checkout/portal handlers and signature-verified webhook reconciliation.
- Free: 10, Starter: 100, Pro: 500 search attempts per UTC calendar month.
- Per-search results: Free up to 10, Starter up to 50, Pro up to 100 when the provider has that many matching sources. Paid searches support publication date/time, location preference, country, source presets, allowlisted websites, and blocked websites.

## Important limitations

This is a launch foundation, not a verified production service. Live services have not been tested
without account configuration. Exa MCP/API is the implemented search connector: no LinkedIn login,
 social account cookies, arbitrary website extraction, email alerts, resume
  binary upload/parser, or background worker is included. Candidate workflow currently stores
  structured profile/resume text and uses deterministic generation unless managed AI is configured.
Employer verification is domain matching, not legal incorporation or recruiter identity
accreditation; review company details and add moderation, rate limits, abuse reporting, and
retention policies before opening the board broadly.
Client discovery means relevant public search results, not verified leads or enriched contacts.
The outreach agent only uses public-source lead evidence, never sends a draft before approval, and
requires `RESEND_API_KEY`, a verified `OUTREACH_FROM_EMAIL` (plus optional `OUTREACH_REPLY_TO`), and the protected scheduler secret for
automated sending. Reply handling and meeting booking require an inbound mail/calendar integration.
Failed attempts consume quota; interrupted requests may remain pending and need reconciliation.
Password recovery uses PKCE and should open in the initiating browser.
Checkout prices are shown by Stripe; set and publish your commercial prices before launch.

## Checks

```sh
npm test
npm run typecheck
npm run build
npm run check:seo
npm audit --omit=dev
```

Unit checks cover auth states/callbacks, environment aliases, profile-setup behavior,
validation, quota helper boundaries, and unsafe result URLs. They do not prove
database concurrency, RLS, real email delivery, payment processing or browser interaction.

## Deploy and release gate

Deploy this directory to a Next.js-compatible Node host (for example Vercel), set environment variables,
apply migrations 001 through 010 in order, update redirect URLs, and register the production Stripe webhook.
Use `npm run build` and `npm start` for a Node deployment. No live deployment has been performed.

After deployment, run `npm run check:seo` against the final public host. It checks the sitemap, robots,
llms.txt, canonical host, metadata, JSON-LD, article images, auth noindex directives, and private-route
redirects. Submit the final non-redirecting sitemap URL (`https://www.reachflow.lol/sitemap.xml` for the
current deployment) in Google Search Console, then use URL Inspection to request indexing for the home,
resources, blog index, and newly changed articles. Search Console may take days or weeks to crawl and
choose canonical URLs; a valid sitemap cannot guarantee impressions, clicks, rankings, or AI citations.

Before accepting customers: test email signup/recovery in-browser, two-user tenant isolation,
parallel quota exhaustion, real search/history, Stripe test checkout/cancellation/replayed webhooks,
and mobile accessibility. Add infrastructure rate limits and bot protection for auth endpoints,
monitoring, backups, retention/deletion policies, terms and privacy notices. Review provider terms
and data-processing arrangements. Do not market universal access or guaranteed client leads.
### Sponsored job placement

Verified employers can purchase transparent sponsored placement for published jobs. Separately, anyone can enter the homepage promotion auction with a public business website or X username, accept the placement terms, and open Stripe checkout without business verification. Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` on the server, then send `checkout.session.completed` and `checkout.session.async_payment_succeeded` to `/api/billing/webhook`; a placement becomes active only after a paid checkout is reconciled. Sponsored ranking changes visibility only, is labeled to candidates, and does not change verification or fit scoring.
