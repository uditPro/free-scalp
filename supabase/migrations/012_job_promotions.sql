begin;

create table if not exists public.employer_job_promotions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.employer_jobs(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  current_bid_cents bigint not null default 0 check (current_bid_cents >= 0),
  status text not null default 'inactive' check (status in ('inactive','active','paused','expired')),
  last_payment_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employer_job_promotion_payments (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.employer_job_promotions(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text unique,
  amount_cents bigint not null check (amount_cents > 0),
  status text not null default 'paid' check (status in ('paid','refunded')),
  created_at timestamptz not null default now()
);

create index if not exists employer_job_promotions_rank
  on public.employer_job_promotions(status, current_bid_cents desc, last_payment_at asc);
create index if not exists employer_job_promotion_payments_owner
  on public.employer_job_promotion_payments(owner_user_id, created_at desc);

alter table public.employer_job_promotions enable row level security;
alter table public.employer_job_promotion_payments enable row level security;

create policy employer_job_promotions_owner on public.employer_job_promotions
  for all to authenticated using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id);
create policy employer_job_promotion_payments_owner on public.employer_job_promotion_payments
  for select to authenticated using ((select auth.uid()) = owner_user_id);

revoke all on public.employer_job_promotions, public.employer_job_promotion_payments from public, anon, authenticated;
grant select, insert, update on public.employer_job_promotions to authenticated;
grant select on public.employer_job_promotion_payments to authenticated;
grant all on public.employer_job_promotions, public.employer_job_promotion_payments to service_role;

create or replace function public.apply_job_promotion_payment(
  p_session_id text,
  p_payment_intent_id text,
  p_promotion_id uuid,
  p_owner_user_id uuid,
  p_amount_cents bigint
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_promotion public.employer_job_promotions;
  v_payment public.employer_job_promotion_payments;
begin
  if p_amount_cents <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  select * into v_promotion from public.employer_job_promotions where id = p_promotion_id for update;
  if not found or v_promotion.owner_user_id <> p_owner_user_id then raise exception 'PROMOTION_NOT_FOUND'; end if;
  if exists (select 1 from public.employer_job_promotion_payments where stripe_checkout_session_id = p_session_id) then
    return jsonb_build_object('applied', false, 'current_bid_cents', v_promotion.current_bid_cents);
  end if;
  insert into public.employer_job_promotion_payments (promotion_id, owner_user_id, stripe_checkout_session_id, stripe_payment_intent_id, amount_cents)
  values (p_promotion_id, p_owner_user_id, p_session_id, nullif(p_payment_intent_id, ''), p_amount_cents)
  returning * into v_payment;
  update public.employer_job_promotions
    set current_bid_cents = current_bid_cents + p_amount_cents, status = 'active', last_payment_at = now(), updated_at = now()
    where id = p_promotion_id;
  return jsonb_build_object('applied', true, 'payment_id', v_payment.id, 'current_bid_cents', v_promotion.current_bid_cents + p_amount_cents);
end;
$$;

revoke all on function public.apply_job_promotion_payment(text,text,uuid,uuid,bigint) from public, anon, authenticated;
grant execute on function public.apply_job_promotion_payment(text,text,uuid,uuid,bigint) to service_role;

commit;
