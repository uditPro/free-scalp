begin;

create table if not exists public.gtm_credit_wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  welcome_credits_cents bigint not null default 3000 check (welcome_credits_cents >= 0),
  plan_credits_cents bigint not null default 0 check (plan_credits_cents >= 0),
  plan_credits_month date not null default date_trunc('month', now() at time zone 'UTC')::date,
  plan_credits_plan text not null default 'free' check (plan_credits_plan in ('free', 'starter', 'pro')),
  used_cents bigint not null default 0 check (used_cents >= 0),
  updated_at timestamptz not null default now()
);

insert into public.gtm_credit_wallets(user_id)
select id from public.profiles on conflict (user_id) do nothing;

alter table public.gtm_credit_wallets enable row level security;
create policy gtm_credit_wallets_own on public.gtm_credit_wallets for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.gtm_credit_wallets from public, anon, authenticated;
grant select on public.gtm_credit_wallets to authenticated;
grant all on public.gtm_credit_wallets to service_role;

create or replace function public.refresh_gtm_plan_credits(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.gtm_credit_wallets;
  v_plan text;
  v_plan_credit bigint;
  v_month date := date_trunc('month', now() at time zone 'UTC')::date;
begin
  select plan into v_plan from public.profiles where id = p_user for update;
  if not found then raise exception 'ACCOUNT_NOT_READY'; end if;
  insert into public.gtm_credit_wallets(user_id) values (p_user) on conflict (user_id) do nothing;
  select * into v_wallet from public.gtm_credit_wallets where user_id = p_user for update;
  v_plan_credit := case v_plan when 'pro' then 2000 when 'starter' then 1000 else 0 end;
  if v_wallet.plan_credits_month < v_month or v_wallet.plan_credits_plan is distinct from v_plan then
    update public.gtm_credit_wallets
      set plan_credits_cents = v_plan_credit,
          plan_credits_month = v_month,
          plan_credits_plan = v_plan,
          updated_at = now()
      where user_id = p_user
      returning * into v_wallet;
  end if;
  return to_jsonb(v_wallet);
end;
$$;

revoke all on function public.refresh_gtm_plan_credits(uuid) from public, anon, authenticated;
grant execute on function public.refresh_gtm_plan_credits(uuid) to service_role;

create or replace function public.reserve_gtm_email_credit(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.gtm_credit_wallets;
  v_plan text;
  v_cost bigint := 4;
  v_bonus bigint;
  v_plan_credit bigint;
  v_month date := date_trunc('month', now() at time zone 'UTC')::date;
begin
  select plan into v_plan from public.profiles where id = p_user for update;
  if not found then raise exception 'ACCOUNT_NOT_READY'; end if;
  insert into public.gtm_credit_wallets(user_id) values (p_user) on conflict (user_id) do nothing;
  select * into v_wallet from public.gtm_credit_wallets where user_id = p_user for update;
  v_plan_credit := case v_plan when 'pro' then 2000 when 'starter' then 1000 else 0 end;
  if v_wallet.plan_credits_month < v_month or v_wallet.plan_credits_plan is distinct from v_plan then
    update public.gtm_credit_wallets
      set plan_credits_cents = v_plan_credit,
          plan_credits_month = v_month,
          plan_credits_plan = v_plan,
          updated_at = now()
      where user_id = p_user
      returning * into v_wallet;
  end if;
  if v_wallet.welcome_credits_cents + v_wallet.plan_credits_cents < v_cost then raise exception 'GTM_CREDITS_EXHAUSTED'; end if;
  v_bonus := least(v_wallet.welcome_credits_cents, v_cost);
  update public.gtm_credit_wallets
    set welcome_credits_cents = welcome_credits_cents - v_bonus,
        plan_credits_cents = plan_credits_cents - (v_cost - v_bonus),
        used_cents = used_cents + v_cost,
        updated_at = now()
    where user_id = p_user;
  return jsonb_build_object(
    'cost_cents', v_cost,
    'welcome_cents', v_bonus,
    'plan_cents', v_cost - v_bonus,
    'remaining_cents', v_wallet.welcome_credits_cents + v_wallet.plan_credits_cents - v_cost
  );
end;
$$;

revoke all on function public.reserve_gtm_email_credit(uuid) from public, anon, authenticated;
grant execute on function public.reserve_gtm_email_credit(uuid) to service_role;

create or replace function public.refund_gtm_email_credit(p_user uuid, p_welcome_cents bigint default 0, p_plan_cents bigint default 0)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_wallet public.gtm_credit_wallets; v_refund bigint;
begin
  select * into v_wallet from public.gtm_credit_wallets where user_id = p_user for update;
  if not found then return; end if;
  v_refund := least(v_wallet.used_cents, greatest(0, p_welcome_cents) + greatest(0, p_plan_cents));
  update public.gtm_credit_wallets
    set used_cents = used_cents - v_refund,
        welcome_credits_cents = welcome_credits_cents + least(v_refund, greatest(0, p_welcome_cents)),
        plan_credits_cents = plan_credits_cents + greatest(0, v_refund - least(v_refund, greatest(0, p_welcome_cents))),
        updated_at = now()
    where user_id = p_user;
end;
$$;
revoke all on function public.refund_gtm_email_credit(uuid,bigint,bigint) from public, anon, authenticated;
grant execute on function public.refund_gtm_email_credit(uuid,bigint,bigint) to service_role;

commit;
