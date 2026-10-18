begin;
alter table public.leads add column if not exists provenance jsonb not null default '[]'::jsonb;
alter table public.leads drop constraint if exists leads_provenance_check;
alter table public.leads add constraint leads_provenance_check check (jsonb_typeof(provenance) = 'array');
commit;
