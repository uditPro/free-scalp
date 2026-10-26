begin;

create table if not exists public.site_visitor_sessions (
  visitor_id text primary key check (visitor_id ~ '^[A-Za-z0-9_-]{16,80}$'),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_path text not null default '/'
);

create table if not exists public.site_visit_events (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null references public.site_visitor_sessions(visitor_id) on delete cascade,
  visit_date date not null,
  path text not null,
  created_at timestamptz not null default now(),
  unique(visitor_id, visit_date)
);

create index if not exists site_visitor_sessions_active on public.site_visitor_sessions(last_seen_at desc);
create index if not exists site_visit_events_date on public.site_visit_events(visit_date desc);

alter table public.site_visitor_sessions enable row level security;
alter table public.site_visit_events enable row level security;
revoke all on public.site_visitor_sessions, public.site_visit_events from public, anon, authenticated;
grant all on public.site_visitor_sessions, public.site_visit_events to service_role;

commit;
