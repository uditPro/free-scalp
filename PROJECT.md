# ReachFlow

Independent Next.js SaaS for discovering jobs, clients, and research from supported internet sources.
Inspired by Agent-Reach's upstream connector architecture; not a fork or a claim of universal access.

## Shared implementation contract
- Next.js App Router, TypeScript, React, lucide-react; plain CSS.
- Frontend owns app pages, layout, globals.css, components, package.json, tsconfig.json, next.config.ts.
- Backend owns app/api/**, lib/**, supabase/**, tests/**, .env.example.
- API JSON errors: { error: string }; no fabricated live results.
- GET /api/status -> { configured: boolean, auth: boolean, search: boolean, billing: boolean }.
- GET /api/session -> { user: { email: string } | null, plan: string }.
- POST /api/auth { action: 'login'|'signup'|'reset'|'logout', email?, password? }.
- GET /api/auth/callback handles email verification callback.
- POST /api/search { query: string, kind: 'jobs'|'clients'|'research' } -> { results: [{ id, title, url, description, source }], runId?: string }.
- GET /api/runs -> { runs: [{ id, query, kind, created_at, result_count }] }.
- POST /api/billing/checkout { plan: 'starter'|'pro' } -> { url }.
- POST /api/billing/portal -> { url }.
- Frontend must handle missing configuration and unauthenticated API responses gracefully.
- Paid plan authorization and quotas enforced on the server, never by browser claims.
- No recurring scheduler or arbitrary shell execution in this initial build.

## Acceptance
Attractive responsive marketing site, auth screens, searchable dashboard with genuine connector responses,
explicit empty/error/setup states, pricing/checkout and billing portal wiring, tenant-isolated persistence,
tested quota/validation boundaries, deployable build and honest setup documentation.
