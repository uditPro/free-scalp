# Database and service setup

1. Create a Supabase project and apply every file in `migrations/` in numeric order using the SQL editor or `supabase db push` after linking the project. Migrations 006–009 add affiliate tracking, lead provenance, rental matching, and any-location rental constraints. Migration 010 adds domain-verified employer companies, free job posts, public listings, and candidate applications. Migration 011 adds job-source provenance and posting-integrity metadata. Migration 012 adds Stripe-paid sponsored placement for verified employer jobs. Migration 013 adds the public homepage promotion auction, where a website or X username can bid without business verification. Migration 014 adds first-party anonymous visit and active-user counters. Migration 015 adds fetched website/X metadata, logos, descriptions, and repeat-bid identity keys. Migrations 009–015 must run after 008, with 011 after 010.
2. Copy `.env.example` to `.env.local` and populate real values. Set `APP_URL` to the exact public HTTPS origin (localhost HTTP for development). Use `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` for Auth; `SUPABASE_SECRET_KEY` is server-only and is required for quota/search persistence. Set `AI_BYOK_ENCRYPTION_KEY` to a random 32-byte hex or base64 value. Do not paste any secret key into the browser or source control. Legacy environment names remain supported.
3. Supabase Auth: enable email/password and email confirmations, configure production SMTP, rate limits and password policy. Set Site URL to `APP_URL`; allow `${APP_URL}/api/auth/callback` and `${APP_URL}/api/auth/callback?next=recovery` as redirect URLs. For Google, the Google Cloud Authorized redirect URI must be Supabase's provider callback (`https://<project-ref>.supabase.co/auth/v1/callback`), not the ReachFlow homepage. The homepage safely forwards legacy codes returned to `APP_URL`, but the explicit callback configuration is required for reliable production OAuth. PKCE recovery links must open in the initiating browser. The callback sends recovery users to `/reset-password`, which must POST `{action:'update-password',password}` to `/api/auth`.
4. Search defaults to the Agent-Reach-compatible keyless Exa MCP endpoint (`https://mcp.exa.ai/mcp`) when no `EXA_API_KEY` is configured. This is rate-limited and not a production SLA. For dedicated usage set `SEARCH_PROVIDER=exa-api` and supply an `EXA_API_KEY`; the direct API route is also supported by `SEARCH_PROVIDER=auto`. Jobs/clients modes modify the query; they are not job-board scraping or contact enrichment. Results are public-web matches, not verified openings or leads.
5. Create monthly recurring Stripe prices for Starter and Pro; configure their IDs. Enable the Stripe billing portal. Subscribe a webhook at `${APP_URL}/api/billing/webhook` to `customer.subscription.created`, `.updated`, `.deleted`. Set its signing secret. Local testing: `stripe listen --forward-to localhost:3000/api/billing/webhook` and use the displayed local signing secret.

## Safe project setup helper

`npm run setup:supabase` performs a read-only preview using the Supabase Management API.
It checks the project URL, schema metadata, current Auth URL configuration, email signup,
and SMTP presence without reading users or result data. `npm run setup:supabase -- --apply`
applies the checked migration and adds only these exact redirects:

- `${APP_URL}/api/auth/callback`
- `${APP_URL}/api/auth/callback?next=recovery`

It preserves existing redirect URLs and does not enable auto-confirmation, disable RLS,
disable quotas, or change signup policy. It requires a separate `SUPABASE_ACCESS_TOKEN`
with the appropriate Management API database/auth permissions. The publishable and secret
project API keys cannot administer project schema/configuration. Keep the management token
in ignored `.env.local`; never pass it on a command line or commit it. Without that token,
run the migration in the SQL editor and add the two redirects manually in Supabase.

## Authorization and accounting

Supabase `auth.getUser()` validates cookie sessions. Tenant RLS allows only own reads. Browser clients cannot insert/update/delete profiles, runs, quota or billing events. Privileged functions are revoked from public/anon/authenticated and granted only to service_role. Never expose the service role key.

Monthly UTC limits: Free 10, Starter 100, Pro 500. SQL locks a tenant profile, checks authoritative plan, increments monthly use, and creates a pending run atomically. Provider or persistence failures consume the reserved attempt; missing provider configuration does not. Failed attempts become failed runs where database connectivity permits. A process crash can leave pending runs; no background cleanup/scheduler is included. Upgrades retain current usage; downgrades do not reset quota.

Webhooks verify the raw request body before any write. They reconcile current subscriptions through Stripe and atomically deduplicate event IDs. Event creation time and reconciliation start time prevent older events/overlapping older snapshots from overwriting newer projections. Active/trialing subscriptions grant access; delinquent/incomplete/canceled subscriptions do not. Delivery failures return retryable errors. Stripe webhook delivery is eventually consistent; check delivery logs and replay failures. Multiple active subscriptions are reconciled to the highest plan. A database lease gives each tenant one checkout session for one hour; switching checkout plans during that window is rejected. Stripe's current subscriptions are also checked before checkout to cover webhook lag. Use the portal for existing subscriptions.

## Checks

Run `npx tsx tests/validation.test.ts` and `npx tsc --noEmit` after dependency installation. Unit checks cover request validation, normalized link rejection, bounded results, and quota boundaries. They do not prove RLS or concurrent SQL behavior: on a dedicated Supabase test project, verify two user tokens cannot read each other's runs, authenticated tokens cannot modify profiles or call privileged RPCs, and 11 parallel `reserve_run` service calls on a fresh Free tenant yield exactly 10 reservations plus one QUOTA_EXCEEDED. Test real signup confirmation/recovery and Stripe CLI create/update/delete/replay/out-of-order delivery before production.

No scheduler, arbitrary command execution, browser-cookie scraping, universal connector support or third-party account login is implemented. Search is bounded to ten HTTPS results. Link filtering blocks obvious local/IP URLs but does not perform DNS ownership validation; the server never fetches result URLs. Employer verification matches a confirmed account email domain to the submitted HTTPS company website; it is not legal-entity or recruiter accreditation. Add moderation, rate limiting, abuse reporting, privacy/retention controls, and real RLS/browser tests before a broad launch.
Stripe must also send `checkout.session.completed` and `checkout.session.async_payment_succeeded` to `${APP_URL}/api/billing/webhook` for one-time sponsored-job and homepage promotion payments. Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` on the server; recurring plans additionally require `STRIPE_STARTER_PRICE_ID` and `STRIPE_PRO_PRICE_ID`. The webhook activates a promotion only after Stripe reports the checkout as paid.
