begin;
create table if not exists public.ai_byok_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  provider text not null check (provider = 'openai-compatible'),
  model text not null check (char_length(model) between 1 and 200),
  base_url text not null check (char_length(base_url) between 1 and 2048),
  encrypted_key text not null,
  iv text not null,
  auth_tag text not null,
  updated_at timestamptz not null default now()
);
alter table public.ai_byok_settings enable row level security;
revoke all on public.ai_byok_settings from public, anon, authenticated;
grant all on public.ai_byok_settings to service_role;
commit;
