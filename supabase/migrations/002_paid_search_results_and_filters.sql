-- Apply once after 001_initial.sql. Increases the stored result ceiling for
-- paid search plans; quota attempts remain enforced by reserve_run.
begin;
alter table public.runs drop constraint if exists runs_results_check;
alter table public.runs add constraint runs_results_check check (jsonb_typeof(results) = 'array' and jsonb_array_length(results) <= 100);
alter table public.runs drop constraint if exists runs_result_count_check;
alter table public.runs add constraint runs_result_count_check check (result_count between 0 and 100);
alter table public.runs add column if not exists requested_limit integer not null default 10 check (requested_limit between 1 and 100);
alter table public.runs add column if not exists search_filters jsonb not null default '{}'::jsonb check (jsonb_typeof(search_filters) = 'object');

-- Atomic paid authorization, monthly quota reservation, and search audit.
-- The browser cannot call this RPC or write its own plan/usage.
create or replace function public.reserve_filtered_run(p_user uuid, p_query text, p_kind text, p_limit integer, p_filters jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_plan text; v_max integer; v_id uuid;
begin
  if p_user is null or p_query is null or char_length(btrim(p_query)) not between 3 and 500
    or p_kind is null or p_kind not in ('jobs','clients','research')
    or p_limit is null or p_limit not between 1 and 100
    or p_filters is null or jsonb_typeof(p_filters) <> 'object' or octet_length(p_filters::text) > 16000 then
    raise exception 'INVALID_INPUT';
  end if;
  select plan into v_plan from public.profiles where id = p_user for update;
  if not found then raise exception 'ACCOUNT_NOT_READY'; end if;
  v_max := case v_plan when 'pro' then 100 when 'starter' then 50 else 10 end;
  if p_limit > v_max or (v_plan not in ('starter','pro') and p_filters <> '{}'::jsonb) then
    raise exception 'PLAN_LIMIT';
  end if;
  -- reserve_run locks the same row in this transaction, so downgrades and
  -- parallel quota requests cannot bypass these limits.
  v_id := public.reserve_run(p_user, p_query, p_kind);
  update public.runs set requested_limit = p_limit, search_filters = p_filters where id = v_id and user_id = p_user;
  return v_id;
end;
$$;
revoke all on function public.reserve_filtered_run(uuid,text,text,integer,jsonb) from public, anon, authenticated;
grant execute on function public.reserve_filtered_run(uuid,text,text,integer,jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
