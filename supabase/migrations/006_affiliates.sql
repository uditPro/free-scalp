begin;

-- Referral links are informational attribution only. No payout or commission
-- state is stored here. All writes happen through the server service role.
create table if not exists public.affiliate_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  code text not null unique check (code ~ '^[A-Za-z0-9_-]{12,64}$'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists affiliate_codes_code_active on public.affiliate_codes(code, active);

create table if not exists public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  affiliate_code_id uuid not null references public.affiliate_codes(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists affiliate_clicks_code_created on public.affiliate_clicks(affiliate_code_id, created_at desc);

create table if not exists public.affiliate_attributions (
  id uuid primary key default gen_random_uuid(),
  affiliate_code_id uuid not null references public.affiliate_codes(id) on delete cascade,
  referred_user_id uuid not null unique references auth.users(id) on delete cascade,
  click_id uuid references public.affiliate_clicks(id) on delete set null,
  attributed_at timestamptz not null default now()
);
create index if not exists affiliate_attributions_code_attributed on public.affiliate_attributions(affiliate_code_id, attributed_at desc);

alter table public.affiliate_codes enable row level security;
alter table public.affiliate_clicks enable row level security;
alter table public.affiliate_attributions enable row level security;
revoke all on public.affiliate_codes, public.affiliate_clicks, public.affiliate_attributions from public, anon, authenticated;
grant all on public.affiliate_codes, public.affiliate_clicks, public.affiliate_attributions to service_role;

create or replace function public.record_affiliate_click(p_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_code public.affiliate_codes%rowtype; v_click uuid;
begin
  select * into v_code from public.affiliate_codes where code = btrim(p_code) and active for share;
  if not found then return null; end if;
  insert into public.affiliate_clicks(affiliate_code_id) values(v_code.id) returning id into v_click;
  return v_click;
end;
$$;
revoke all on function public.record_affiliate_click(text) from public, anon, authenticated;
grant execute on function public.record_affiliate_click(text) to service_role;

-- The referred user is supplied by the trusted server-side auth result. The
-- unique referred_user_id makes retries safe, while the owner check blocks
-- self-referrals even if a user controls the referral cookie.
create or replace function public.attribute_affiliate_signup(p_code text, p_referred_user uuid, p_click uuid default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_code public.affiliate_codes%rowtype; v_click uuid;
begin
  select * into v_code from public.affiliate_codes where code = btrim(p_code) and active for share;
  if not found or v_code.user_id = p_referred_user then return false; end if;
  if p_click is not null then
    select id into v_click from public.affiliate_clicks where id = p_click and affiliate_code_id = v_code.id;
  end if;
  insert into public.affiliate_attributions(affiliate_code_id, referred_user_id, click_id)
    values(v_code.id, p_referred_user, v_click) on conflict (referred_user_id) do nothing;
  return found;
end;
$$;
revoke all on function public.attribute_affiliate_signup(text,uuid,uuid) from public, anon, authenticated;
grant execute on function public.attribute_affiliate_signup(text,uuid,uuid) to service_role;

commit;
