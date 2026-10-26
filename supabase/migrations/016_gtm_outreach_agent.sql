begin;

create table if not exists public.gtm_agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  company_name text not null default '',
  company_website text not null default '',
  company_description text not null default '',
  target_audience text not null default '',
  system_enabled boolean not null default true,
  autopilot_enabled boolean not null default false,
  min_fit_score integer not null default 70 check (min_fit_score between 0 and 100),
  daily_limit integer not null default 5 check (daily_limit between 0 and 100),
  from_email text not null default '',
  reply_to text not null default '',
  last_discovery_at timestamptz,
  last_autopilot_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gtm_briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  audience text not null,
  problem text not null default '',
  location text not null default '',
  sources jsonb not null default '[]'::jsonb check (jsonb_typeof(sources) = 'array'),
  active boolean not null default true,
  run_mode text not null default 'queue' check (run_mode in ('queue','run_now')),
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gtm_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  status text not null default 'draft' check (status in ('draft','ready','active','paused','completed')),
  subject_template text not null,
  body_template text not null,
  followup_subject text not null default '',
  followup_body text not null default '',
  followup_delay_days integer not null default 3 check (followup_delay_days between 1 and 30),
  daily_limit integer not null default 10 check (daily_limit between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gtm_outreach_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  campaign_id uuid not null references public.gtm_campaigns(id) on delete cascade,
  step integer not null default 0 check (step between 0 and 2),
  recipient_email text not null,
  subject text not null,
  body text not null,
  status text not null default 'draft' check (status in ('draft','approved','queued','sent','failed','replied','skipped')),
  scheduled_at timestamptz,
  approved_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(lead_id, campaign_id, step)
);

create table if not exists public.gtm_agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  trigger text not null check (trigger in ('manual','cron','autopilot')),
  status text not null default 'running' check (status in ('running','completed','failed')),
  leads_found integer not null default 0,
  drafts_created integer not null default 0,
  messages_sent integer not null default 0,
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists gtm_briefs_user_active on public.gtm_briefs(user_id, active, updated_at desc);
create index if not exists gtm_campaigns_user_status on public.gtm_campaigns(user_id, status, updated_at desc);
create index if not exists gtm_messages_user_status on public.gtm_outreach_messages(user_id, status, scheduled_at);
create index if not exists gtm_runs_user_started on public.gtm_agent_runs(user_id, started_at desc);

alter table public.gtm_agents enable row level security;
alter table public.gtm_briefs enable row level security;
alter table public.gtm_campaigns enable row level security;
alter table public.gtm_outreach_messages enable row level security;
alter table public.gtm_agent_runs enable row level security;

create policy gtm_agents_own on public.gtm_agents for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy gtm_briefs_own on public.gtm_briefs for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy gtm_campaigns_own on public.gtm_campaigns for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy gtm_messages_own on public.gtm_outreach_messages for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy gtm_runs_own on public.gtm_agent_runs for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.gtm_agents, public.gtm_briefs, public.gtm_campaigns, public.gtm_outreach_messages, public.gtm_agent_runs from public, anon, authenticated;
grant select, insert, update, delete on public.gtm_agents, public.gtm_briefs, public.gtm_campaigns, public.gtm_outreach_messages, public.gtm_agent_runs to authenticated;
grant all on public.gtm_agents, public.gtm_briefs, public.gtm_campaigns, public.gtm_outreach_messages, public.gtm_agent_runs to service_role;

commit;
