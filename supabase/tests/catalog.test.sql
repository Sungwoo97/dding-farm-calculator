-- Run after `supabase db reset` with `supabase test db`.
-- These tests are transactional and never modify a deployed project.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok(relrowsecurity, format('RLS enabled on %s', relname))
from pg_class
where relnamespace = 'public'::regnamespace and relname in (
  'items', 'recipes', 'recipe_ingredients', 'price_cycles', 'cooking_prices', 'skills', 'skill_levels', 'change_logs'
);
select is((select count(*) from items), 7::bigint, 'seven seeded catalog items');
select is((select count(*) from recipes), 4::bigint, 'four recipes include the intermediate');
select is((select count(*) from recipe_ingredients), 8::bigint, 'eight ingredient relationships');
select is((select count(*) from cooking_prices), 3::bigint, 'all three fixture dishes have prices');
select is((select count(*) from skill_levels), 2::bigint, 'two supported fixture skill levels');
select is((select ends_at - starts_at from price_cycles), interval '72 hours', 'seed interval is exactly 72 hours');

select throws_ok($$
  update cooking_prices set base_price = 0
$$, '23514', null, 'zero prices rejected');
select throws_ok($$
  update recipes set output_quantity = 0
$$, '23514', null, 'zero output quantities rejected');
select throws_ok($$
  update recipe_ingredients set quantity = -1
$$, '23514', null, 'negative ingredient quantities rejected');
select throws_ok($$
  update price_cycles set ends_at = starts_at + interval '71 hours'
$$, '23514', null, 'non-72-hour intervals rejected');
select throws_ok($$
  insert into cooking_prices (cycle_id, dish_item_id, base_price, source_note, source_url, verified_at)
  select cycle_id, dish_item_id, base_price, source_note, source_url, verified_at from cooking_prices limit 1
$$, '23505', null, 'duplicate cycle/dish price rejected');
select throws_ok($$
  insert into price_cycles (starts_at, ends_at, status, published_at, source_url, verified_at)
  values ('2026-09-18T00:00:00+09:00', '2026-09-21T00:00:00+09:00', 'PUBLISHED', '2026-09-15T00:00:00Z', 'https://example.com/test', '2026-09-15T00:00:00Z')
$$, '23P01', null, 'overlapping published interval rejected');
select lives_ok($$
  insert into price_cycles (starts_at, ends_at, status, published_at, source_url, verified_at)
  values ('2026-09-19T00:00:00+09:00', '2026-09-22T00:00:00+09:00', 'PUBLISHED', '2026-09-15T00:00:00Z', 'https://example.com/test', '2026-09-15T00:00:00Z')
$$, 'adjacent half-open interval allowed');
select is((select count(*) from price_cycles where status = 'PUBLISHED' and starts_at <= '2026-09-19T00:00:00+09:00' and ends_at > '2026-09-19T00:00:00+09:00'), 1::bigint, 'exact endpoint selects only the next cycle');

-- Seed private rows before exercising real anon/authenticated database roles.
insert into items (slug, name, category, active, source_url, verified_at)
values ('inactive-test', 'Inactive', 'RAW', false, 'https://example.com/test', '2026-09-15T00:00:00Z');
insert into price_cycles (id, starts_at, ends_at, status, source_url, verified_at)
values ('20000000-0000-4000-8000-000000000001', '2026-09-16T00:00:00+09:00', '2026-09-19T00:00:00+09:00', 'DRAFT', 'https://example.com/test', '2026-09-15T00:00:00Z');
insert into cooking_prices (cycle_id, dish_item_id, base_price, source_note, source_url, verified_at)
values ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 200, 'Private draft', 'https://example.com/test', '2026-09-15T00:00:00Z');

set local role anon;
select is((select count(*) from items), 7::bigint, 'anonymous reads hide inactive items');
select is((select count(*) from price_cycles where status = 'DRAFT'), 0::bigint, 'anonymous cannot read drafts');
select is((select count(*) from cooking_prices), 3::bigint, 'anonymous cannot read draft child prices');
select throws_ok($$update cooking_prices set base_price = 999$$, '42501', null, 'anonymous cannot write');
select throws_ok($$select * from change_logs$$, '42501', null, 'anonymous cannot read audit history');
reset role;

-- user_metadata is deliberately not a source of administrator authority.
select set_config('request.jwt.claims', '{"role":"authenticated","app_metadata":{"role":"user"},"user_metadata":{"role":"admin"}}', true);
set local role authenticated;
select results_eq($$update cooking_prices set base_price = 999 returning base_price$$, $$select 0::bigint where false$$, 'ordinary authenticated users cannot update');
select throws_ok($$
  insert into items (slug, name, category, source_url, verified_at)
  values ('forbidden', 'Forbidden', 'RAW', 'https://example.com/test', '2026-09-15T00:00:00Z')
$$, '42501', null, 'user_metadata admin spoof does not permit inserts');
reset role;

select set_config('request.jwt.claims', '{"role":"authenticated","app_metadata":{"role":"admin"}}', true);
set local role authenticated;
select is((select count(*) from items), 8::bigint, 'administrators can read inactive items');
select is((select count(*) from price_cycles where status = 'DRAFT'), 1::bigint, 'administrators can read drafts');
select lives_ok($$update cooking_prices set base_price = 999$$, 'administrators can update prices');
select is((select count(*) from cooking_prices where base_price = 999), 4::bigint, 'admin update reaches published and draft prices');
select throws_ok($$update change_logs set change_reason = 'tampered'$$, '42501', null, 'even administrators cannot alter audit history');
select throws_ok($$delete from change_logs$$, '42501', null, 'even administrators cannot delete audit history');
reset role;

select * from finish();
rollback;
