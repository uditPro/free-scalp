-- Run once in the Supabase SQL editor or through `supabase db push`.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','starter','pro')),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  billing_event_created bigint not null default 0,
  billing_observed_at timestamptz not null default '-infinity',
  created_at timestamptz not null default now()
);
create table public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  query text not null check (char_length(query) between 3 and 500),
  kind text not null check (kind in ('jobs','clients','research')),
  status text not null default 'pending' check (status in ('pending','completed','failed')),
  result_count integer not null default 0 check (result_count between 0 and 10),
  results jsonb not null default '[]' check (jsonb_typeof(results) = 'array' and jsonb_array_length(results) <= 10),
  created_at timestamptz not null default now()
);
create index runs_user_created on public.runs(user_id, created_at desc);
create table public.monthly_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  month date not null,
  used integer not null default 0 check (used >= 0),
  primary key(user_id, month)
);
create table public.billing_events (
  event_id text primary key,
  user_id uuid references public.profiles(id) on delete set null,
  event_created bigint not null,
  received_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
alter table public.runs enable row level security;
alter table public.monthly_usage enable row level security;
alter table public.billing_events enable row level security;
create policy profiles_read_own on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy runs_read_own on public.runs for select to authenticated using ((select auth.uid()) = user_id);
create policy usage_read_own on public.monthly_usage for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.profiles, public.runs, public.monthly_usage, public.billing_events from public, anon, authenticated;
grant select on public.profiles, public.runs, public.monthly_usage to authenticated;
grant all on public.profiles, public.runs, public.monthly_usage, public.billing_events to service_role;

create function public.create_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
revoke all on function public.create_profile() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.create_profile();
insert into public.profiles(id) select id from auth.users on conflict do nothing;

-- All requests for a tenant lock the same profile row. Quota increment and
-- pending run creation commit together. Failed attempts are deliberately charged.
create function public.reserve_run(p_user uuid, p_query text, p_kind text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_plan text; v_limit integer; v_used integer; v_id uuid;
  v_month date := date_trunc('month', now() at time zone 'UTC')::date;
begin
  if char_length(btrim(p_query)) not between 3 and 500 or p_kind not in ('jobs','clients','research') or p_query is null or p_kind is null then
    raise exception 'INVALID_INPUT';
  end if;
  select plan into v_plan from public.profiles where id = p_user for update;
  if not found then raise exception 'ACCOUNT_NOT_READY'; end if;
  v_limit := case v_plan when 'pro' then 500 when 'starter' then 100 else 10 end;
  insert into public.monthly_usage(user_id, month, used) values(p_user, v_month, 0) on conflict do nothing;
  select used into v_used from public.monthly_usage where user_id = p_user and month = v_month for update;
  if v_used >= v_limit then raise exception 'QUOTA_EXCEEDED'; end if;
  update public.monthly_usage set used = used + 1 where user_id = p_user and month = v_month;
  insert into public.runs(user_id, query, kind) values(p_user, btrim(p_query), p_kind) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.reserve_run(uuid,text,text) from public, anon, authenticated;
grant execute on function public.reserve_run(uuid,text,text) to service_role;

-- Record deduplication and projection in one transaction. Old events and older
-- overlapping reconciliation snapshots cannot overwrite a newer projection.
create function public.apply_billing_event(p_event_id text, p_event_created bigint, p_observed_at timestamptz, p_user uuid, p_customer text, p_subscription text, p_plan text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_profile public.profiles%rowtype; v_inserted integer;
begin
  if p_plan not in ('free','starter','pro') then raise exception 'INVALID_PLAN'; end if;
  select * into v_profile from public.profiles where id = p_user for update;
  if not found or v_profile.stripe_customer_id is distinct from p_customer then raise exception 'CUSTOMER_MISMATCH'; end if;
  insert into public.billing_events(event_id,user_id,event_created) values(p_event_id,p_user,p_event_created) on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return false; end if;
  if p_event_created < v_profile.billing_event_created or p_observed_at < v_profile.billing_observed_at then return false; end if;
  update public.profiles set plan = p_plan, stripe_subscription_id = p_subscription,
    billing_event_created = p_event_created, billing_observed_at = p_observed_at where id = p_user;
  return true;
end;
$$;
revoke all on function public.apply_billing_event(text,bigint,timestamptz,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.apply_billing_event(text,bigint,timestamptz,uuid,text,text,text) to service_role;

create table public.checkout_leases (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  slot uuid not null default gen_random_uuid(),
  plan text not null check (plan in ('starter','pro')),
  expires_at bigint not null
);
alter table public.checkout_leases enable row level security;
revoke all on public.checkout_leases from public, anon, authenticated;
grant all on public.checkout_leases to service_role;
create function public.reserve_checkout(p_user uuid, p_plan text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_lease public.checkout_leases%rowtype; v_subscription text;
begin
  if p_plan not in ('starter','pro') then raise exception 'INVALID_PLAN'; end if;
  select stripe_subscription_id into v_subscription from public.profiles where id = p_user for update;
  if not found then raise exception 'ACCOUNT_NOT_READY'; end if;
  if v_subscription is not null then raise exception 'SUBSCRIPTION_EXISTS'; end if;
  select * into v_lease from public.checkout_leases where user_id = p_user;
  if found and v_lease.expires_at > extract(epoch from now()) then
    if v_lease.plan <> p_plan then raise exception 'CHECKOUT_IN_PROGRESS'; end if;
    return jsonb_build_object('slot',v_lease.slot,'expires_at',v_lease.expires_at);
  end if;
  insert into public.checkout_leases(user_id,plan,expires_at)
    values(p_user,p_plan,floor(extract(epoch from now()))::bigint + 3600)
    on conflict(user_id) do update set slot = gen_random_uuid(), plan = excluded.plan, expires_at = excluded.expires_at
    returning * into v_lease;
  return jsonb_build_object('slot',v_lease.slot,'expires_at',v_lease.expires_at);
end;
$$;
revoke all on function public.reserve_checkout(uuid,text) from public, anon, authenticated;
grant execute on function public.reserve_checkout(uuid,text) to service_role;
