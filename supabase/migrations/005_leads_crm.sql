begin;
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  canonical_key text not null, business_name text not null, domain text not null, source_url text not null, source_title text, source_domain text, description text not null,
  location text, contact_name text, industry text, need_signal text, public_contacts jsonb not null default '{}'::jsonb check (jsonb_typeof(public_contacts) = 'object'), evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence) = 'object'), confidence jsonb not null default '{}'::jsonb check (jsonb_typeof(confidence) = 'object'), quality_score integer not null default 0 check (quality_score between 0 and 100), score integer not null default 0 check (score between 0 and 100),
  score_explanation jsonb not null default '{}'::jsonb, status text not null default 'new' check (status in ('new','qualified','contacted','in_conversation','won','not_fit','snoozed')),
  notes text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id, canonical_key)
);
create table if not exists public.lead_notes (id uuid primary key default gen_random_uuid(), lead_id uuid not null references public.leads(id) on delete cascade, user_id uuid not null references public.profiles(id) on delete cascade, body text not null check (char_length(body) between 1 and 4000), created_at timestamptz not null default now());
create index if not exists leads_user_updated on public.leads(user_id, updated_at desc); create index if not exists lead_notes_lead_created on public.lead_notes(lead_id, created_at desc);
alter table public.leads enable row level security; alter table public.lead_notes enable row level security;
create policy leads_own on public.leads for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy lead_notes_own on public.lead_notes for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.leads, public.lead_notes from public, anon, authenticated; grant select,insert,update,delete on public.leads, public.lead_notes to authenticated; grant all on public.leads, public.lead_notes to service_role;
commit;

-- Safe for workspaces that applied an earlier draft of migration 005.
alter table public.leads add column if not exists source_title text;
alter table public.leads add column if not exists source_domain text;
alter table public.leads add column if not exists evidence jsonb not null default '{}'::jsonb;
alter table public.leads add column if not exists confidence jsonb not null default '{}'::jsonb;
alter table public.leads add column if not exists quality_score integer not null default 0;
