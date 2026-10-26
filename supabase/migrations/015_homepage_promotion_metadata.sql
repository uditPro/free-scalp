begin;

alter table public.homepage_promotions add column if not exists normalized_key text;
alter table public.homepage_promotions add column if not exists destination_url text;
alter table public.homepage_promotions add column if not exists display_name text;
alter table public.homepage_promotions add column if not exists description text;
alter table public.homepage_promotions add column if not exists logo_url text;
alter table public.homepage_promotions add column if not exists metadata_status text not null default 'fallback' check (metadata_status in ('fetched','fallback'));
alter table public.homepage_promotions add column if not exists metadata_fetched_at timestamptz;

create unique index if not exists homepage_promotions_normalized_key_unique
  on public.homepage_promotions(normalized_key)
  where normalized_key is not null;

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
  v_current_bid bigint;
begin
  if p_amount_cents <= 0 or p_target_cents <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  select * into v_promotion from public.homepage_promotions where id = p_promotion_id for update;
  if not found then raise exception 'PROMOTION_NOT_FOUND'; end if;
  if exists (select 1 from public.homepage_promotion_payments where stripe_checkout_session_id = p_session_id) then
    return jsonb_build_object('applied', false, 'current_bid_cents', v_promotion.current_bid_cents);
  end if;
  v_current_bid := greatest(v_promotion.current_bid_cents, p_target_cents);
  insert into public.homepage_promotion_payments (promotion_id, stripe_checkout_session_id, stripe_payment_intent_id, amount_cents, target_cents)
  values (p_promotion_id, p_session_id, nullif(p_payment_intent_id, ''), p_amount_cents, p_target_cents)
  returning * into v_payment;
  update public.homepage_promotions
    set current_bid_cents = v_current_bid, status = 'active', last_payment_at = now(), updated_at = now()
    where id = p_promotion_id;
  return jsonb_build_object('applied', true, 'payment_id', v_payment.id, 'current_bid_cents', v_current_bid);
end;
$$;

commit;
