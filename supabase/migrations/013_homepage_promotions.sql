begin;

create table if not exists public.homepage_promotions (
  id uuid primary key default gen_random_uuid(),
  website_url text,
  x_username text,
  current_bid_cents bigint not null default 0 check (current_bid_cents >= 0),
  status text not null default 'inactive' check (status in ('inactive','active','paused','expired')),
  terms_version text not null default 'homepage-promotion-v1',
  terms_accepted_at timestamptz,
  last_payment_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint homepage_promotions_identity_check check ((website_url is not null) <> (x_username is not null))
);

create table if not exists public.homepage_promotion_payments (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.homepage_promotions(id) on delete cascade,
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text unique,
  amount_cents bigint not null check (amount_cents > 0),
  target_cents bigint not null check (target_cents > 0),
  status text not null default 'paid' check (status in ('paid','refunded')),
  created_at timestamptz not null default now()
);

create index if not exists homepage_promotions_rank
  on public.homepage_promotions(status, current_bid_cents desc, last_payment_at asc);
create index if not exists homepage_promotion_payments_promotion
  on public.homepage_promotion_payments(promotion_id, created_at desc);

alter table public.homepage_promotions enable row level security;
alter table public.homepage_promotion_payments enable row level security;
revoke all on public.homepage_promotions, public.homepage_promotion_payments from public, anon, authenticated;
grant all on public.homepage_promotions, public.homepage_promotion_payments to service_role;

create or replace function public.apply_homepage_promotion_payment(
  p_session_id text,
  p_payment_intent_id text,
  p_promotion_id uuid,
  p_amount_cents bigint,
  p_target_cents bigint
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_promotion public.homepage_promotions;
  v_payment public.homepage_promotion_payments;
begin
  if p_amount_cents <= 0 or p_target_cents <= 0 or p_amount_cents <> p_target_cents then raise exception 'INVALID_AMOUNT'; end if;
  select * into v_promotion from public.homepage_promotions where id = p_promotion_id for update;
  if not found then raise exception 'PROMOTION_NOT_FOUND'; end if;
  if exists (select 1 from public.homepage_promotion_payments where stripe_checkout_session_id = p_session_id) then
    return jsonb_build_object('applied', false, 'current_bid_cents', v_promotion.current_bid_cents);
  end if;
  insert into public.homepage_promotion_payments (promotion_id, stripe_checkout_session_id, stripe_payment_intent_id, amount_cents, target_cents)
  values (p_promotion_id, p_session_id, nullif(p_payment_intent_id, ''), p_amount_cents, p_target_cents)
  returning * into v_payment;
  update public.homepage_promotions
    set current_bid_cents = p_target_cents, status = 'active', last_payment_at = now(), updated_at = now()
    where id = p_promotion_id;
  return jsonb_build_object('applied', true, 'payment_id', v_payment.id, 'current_bid_cents', p_target_cents);
end;
$$;

revoke all on function public.apply_homepage_promotion_payment(text,text,uuid,bigint,bigint) from public, anon, authenticated;
grant execute on function public.apply_homepage_promotion_payment(text,text,uuid,bigint,bigint) to service_role;

commit;
