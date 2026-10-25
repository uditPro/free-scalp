begin;

alter table public.saved_jobs add column if not exists employment_type text;
alter table public.saved_jobs add column if not exists requirements text;
alter table public.saved_jobs add column if not exists source_type text not null default 'unknown' check (source_type in ('employer','ats','job-board','social','search-index','unknown'));
alter table public.saved_jobs add column if not exists fetched_at timestamptz;
alter table public.saved_jobs add column if not exists posted_at timestamptz;
alter table public.saved_jobs add column if not exists provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance) = 'object');
alter table public.saved_jobs add column if not exists integrity_status text not null default 'clear' check (integrity_status in ('clear','review'));
alter table public.saved_jobs add column if not exists integrity_flags jsonb not null default '[]'::jsonb check (jsonb_typeof(integrity_flags) = 'array');

create index if not exists saved_jobs_user_posted on public.saved_jobs(user_id, posted_at desc nulls last);
create index if not exists saved_jobs_integrity on public.saved_jobs(user_id, integrity_status);

commit;
