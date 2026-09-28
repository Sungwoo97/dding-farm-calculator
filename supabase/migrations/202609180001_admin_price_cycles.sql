begin;

-- Official bounds are optional catalog data, not invented percentage heuristics.
alter table public.items
  add column official_min_price bigint,
  add column official_max_price bigint,
  add constraint items_official_price_bounds check (
    (official_min_price is null and official_max_price is null)
    or (official_min_price is not null and official_max_price is not null
      and official_min_price > 0 and official_max_price <= 9007199254740991
      and official_min_price <= official_max_price)
  );

-- SECURITY INVOKER preserves every existing grant and RLS policy.
-- No caller-provided administrator id is accepted by any function.
create function public.create_price_cycle_draft(p_input jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  cycle_row public.price_cycles;
  price_row public.cooking_prices;
  price_input jsonb;
  start_time timestamptz;
  end_time timestamptz;
  reason text;
begin
  if auth.uid() is null or (auth.jwt() -> 'app_metadata' ->> 'role') is distinct from 'admin' then
    raise exception 'Administrator required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_input) is distinct from 'object'
    or jsonb_typeof(p_input -> 'prices') is distinct from 'array'
    or jsonb_typeof(p_input -> 'startsAt') is distinct from 'string'
    or jsonb_typeof(p_input -> 'sourceUrl') is distinct from 'string'
    or jsonb_typeof(p_input -> 'reason') is distinct from 'string' then
    raise exception 'Invalid draft' using errcode = '23514';
  end if;
  reason := btrim(p_input ->> 'reason');
  if length(reason) not between 1 and 2000
    or length(p_input ->> 'sourceUrl') > 2000
    or (p_input ->> 'sourceUrl') !~ '^https?://'
    or (p_input ->> 'startsAt') !~ '^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$'
    or jsonb_array_length(p_input -> 'prices') > 10000 then
    raise exception 'Invalid draft' using errcode = '23514';
  end if;
  start_time := (p_input ->> 'startsAt')::timestamptz;
  end_time := start_time + interval '72 hours';
  if not isfinite(start_time) or (p_input ? 'endsAt' and
    (jsonb_typeof(p_input -> 'endsAt') is distinct from 'string' or (p_input ->> 'endsAt')::timestamptz <> end_time)) then
    raise exception 'Invalid cycle duration' using errcode = '23514';
  end if;

  -- Same lock order as publish: keep catalog and child rows stable through audit.
  lock table public.items in share mode;
  lock table public.price_cycles, public.cooking_prices in share row exclusive mode;
  insert into public.price_cycles (starts_at, ends_at, source_url, verified_at)
    values (start_time, end_time, p_input ->> 'sourceUrl', now()) returning * into cycle_row;
  insert into public.change_logs (table_name, record_id, after_data, changed_by, change_reason)
    values ('price_cycles', cycle_row.id, to_jsonb(cycle_row), auth.uid(), reason);

  for price_input in select value from jsonb_array_elements(p_input -> 'prices') loop
    if jsonb_typeof(price_input) is distinct from 'object'
      or jsonb_typeof(price_input -> 'dishItemId') is distinct from 'string'
      or jsonb_typeof(price_input -> 'basePrice') is distinct from 'number'
      or jsonb_typeof(price_input -> 'sourceNote') is distinct from 'string' then
      raise exception 'Invalid price' using errcode = '23514';
    end if;
    if (price_input ->> 'basePrice')::numeric <> trunc((price_input ->> 'basePrice')::numeric)
      or (price_input ->> 'basePrice')::numeric not between 1 and 9007199254740991
      or length(price_input ->> 'sourceNote') > 4000
      or not exists (select 1 from public.items where id = (price_input ->> 'dishItemId')::uuid and active and category = 'DISH') then
      raise exception 'Invalid dish price' using errcode = '23514';
    end if;
    insert into public.cooking_prices (cycle_id, dish_item_id, base_price, source_note, source_url, verified_at)
      values (cycle_row.id, (price_input ->> 'dishItemId')::uuid, (price_input ->> 'basePrice')::bigint,
        price_input ->> 'sourceNote', cycle_row.source_url, now()) returning * into price_row;
    insert into public.change_logs (table_name, record_id, after_data, changed_by, change_reason)
      values ('cooking_prices', price_row.id, to_jsonb(price_row), auth.uid(), reason);
  end loop;
  return cycle_row.id;
end;
$$;

-- Preview helper; publication calls this again under locks, never trusts its caller.
create function public.validate_price_cycle_draft(p_cycle_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  cycle_row public.price_cycles;
  errors jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or (auth.jwt() -> 'app_metadata' ->> 'role') is distinct from 'admin' then
    raise exception 'Administrator required' using errcode = '42501';
  end if;
  select * into cycle_row from public.price_cycles where id = p_cycle_id;
  if not found or cycle_row.status <> 'DRAFT' then
    return jsonb_build_object('valid', false, 'errors', jsonb_build_array('초안을 찾을 수 없습니다.'));
  end if;
  if cycle_row.ends_at <> cycle_row.starts_at + interval '72 hours' then
    errors := errors || jsonb_build_array('가격 주기는 정확히 72시간이어야 합니다.');
  end if;
  if exists (select 1 from public.items item where item.active and item.category = 'DISH'
    and not exists (select 1 from public.cooking_prices price where price.cycle_id = p_cycle_id and price.dish_item_id = item.id)) then
    errors := errors || jsonb_build_array('모든 활성 요리의 가격이 필요합니다.');
  end if;
  if exists (select 1 from public.cooking_prices price join public.items item on item.id = price.dish_item_id
    where price.cycle_id = p_cycle_id and (
      not item.active or item.category <> 'DISH' or price.base_price not between 1 and 9007199254740991
      or (item.official_min_price is not null and (price.base_price < item.official_min_price or price.base_price > item.official_max_price)
        and price.source_note !~ '[^[:space:]]'))) then
    errors := errors || jsonb_build_array('요리 가격 또는 공식 범위 밖 가격의 확인 근거를 확인해 주세요.');
  end if;
  if exists (select 1 from public.price_cycles other where other.status = 'PUBLISHED'
    and other.starts_at < cycle_row.ends_at and cycle_row.starts_at < other.ends_at) then
    errors := errors || jsonb_build_array('게시된 가격 주기와 시간이 겹칩니다.');
  end if;
  return jsonb_build_object('valid', jsonb_array_length(errors) = 0, 'errors', errors);
end;
$$;

create function public.publish_price_cycle(p_cycle_id uuid, p_reason text)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  before_row public.price_cycles;
  after_row public.price_cycles;
begin
  if auth.uid() is null or (auth.jwt() -> 'app_metadata' ->> 'role') is distinct from 'admin' then
    raise exception 'Administrator required' using errcode = '42501';
  end if;
  if p_reason is null or p_reason !~ '[^[:space:]]' or length(p_reason) > 2000 then
    raise exception 'Change reason required' using errcode = '23514';
  end if;
  lock table public.items in share mode;
  lock table public.price_cycles, public.cooking_prices in share row exclusive mode;
  if not (public.validate_price_cycle_draft(p_cycle_id) ->> 'valid')::boolean then
    raise exception 'Invalid price cycle' using errcode = '23514';
  end if;
  select * into before_row from public.price_cycles where id = p_cycle_id for update;
  update public.price_cycles set status = 'PUBLISHED', published_at = now(), published_by = auth.uid()
    where id = p_cycle_id returning * into after_row;
  insert into public.change_logs (table_name, record_id, before_data, after_data, changed_by, change_reason)
    values ('price_cycles', p_cycle_id, to_jsonb(before_row), to_jsonb(after_row), auth.uid(), btrim(p_reason));
end;
$$;

revoke all on function public.create_price_cycle_draft(jsonb), public.validate_price_cycle_draft(uuid), public.publish_price_cycle(uuid, text) from public, anon;
grant execute on function public.create_price_cycle_draft(jsonb), public.validate_price_cycle_draft(uuid), public.publish_price_cycle(uuid, text) to authenticated;
commit;
