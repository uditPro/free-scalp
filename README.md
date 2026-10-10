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

1. Create a Supabase project. Apply `supabase/migrations/001_initial.sql` once. If the first migration is already applied, also apply `supabase/migrations/002_paid_search_results_and_filters.sql` once; it expands paid result storage to 100 and adds the filtered-search audit fields.
2. Configure email confirmation, SMTP and the allowed `/api/auth/callback` URL.
3. Provide `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` for signup/login.
   `SUPABASE_SECRET_KEY` is server-only and required for search/billing, not authentication.
   Legacy anonymous/service-role environment names remain supported.
4. Search defaults to the Agent-Reach-compatible keyless Exa MCP endpoint
   (`https://mcp.exa.ai/mcp`) when no `EXA_API_KEY` is configured. This is rate-limited
   and not a production SLA. For dedicated usage set `SEARCH_PROVIDER=exa-api` and
   provide an `EXA_API_KEY`; `SEARCH_PROVIDER=auto` chooses the dedicated API when the
   key exists. Searches save only normalized source-linked results in Supabase.
5. Configure Stripe recurring Starter/Pro prices, customer portal and signed webhook endpoint.
6. Set `APP_URL` to the exact canonical origin, including port locally; use HTTPS in production.
   Use the same host that Vercel does not redirect (for example, if Vercel redirects the apex
   to `www`, set `APP_URL=https://www.reachflow.lol`). This keeps the Supabase PKCE cookie on
   the host that receives the OAuth callback.
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
social account cookies, arbitrary website extraction, AI workflow builder, recurring scheduling,
email alerts or background worker is included. A search runs synchronously within its request.
Client discovery means relevant public search results, not verified leads or enriched contacts.
Failed attempts consume quota; interrupted requests may remain pending and need reconciliation.
Password recovery uses PKCE and should open in the initiating browser.
Checkout prices are shown by Stripe; set and publish your commercial prices before launch.

## Checks

```sh
npm test
npm run typecheck
npm run build
npm audit --omit=dev
```

Unit checks cover auth states/callbacks, environment aliases, profile-setup behavior,
validation, quota helper boundaries, and unsafe result URLs. They do not prove
database concurrency, RLS, real email delivery, payment processing or browser interaction.

## Deploy and release gate

Deploy this directory to a Next.js-compatible Node host (for example Vercel), set environment variables,
apply the database migration, update redirect URLs, and register the production Stripe webhook.
Use `npm run build` and `npm start` for a Node deployment. No live deployment has been performed.

Before accepting customers: test email signup/recovery in-browser, two-user tenant isolation,
parallel quota exhaustion, real search/history, Stripe test checkout/cancellation/replayed webhooks,
and mobile accessibility. Add infrastructure rate limits and bot protection for auth endpoints,
monitoring, backups, retention/deletion policies, terms and privacy notices. Review provider terms
and data-processing arrangements. Do not market universal access or guaranteed client leads.
