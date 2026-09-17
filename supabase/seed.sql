-- Synthetic local/test fixtures ONLY; not verified game facts.
-- Canonical data: src/features/catalog/server/fixture-rows.json.
-- Fixed verification timestamp and Asia/Seoul interval; never move the interval with now().
-- Do not apply this seed to production. Replace it with officially sourced catalog data.
begin;

insert into public.items (id, slug, name, category, tradeable, active, source_url, verified_at) values
  ('10000000-0000-4000-8000-000000000001', 'tomato', '토마토', 'RAW', true, true, 'https://example.com/dding-farm-fixtures', '2026-09-15T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000002', 'wheat', '밀', 'RAW', true, true, 'https://example.com/dding-farm-fixtures', '2026-09-15T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000003', 'salt', '소금', 'FIXED_INGREDIENT', true, true, 'https://example.com/dding-farm-fixtures', '2026-09-15T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000004', 'flour', '밀가루', 'PROCESSED', true, true, 'https://example.com/dding-farm-fixtures', '2026-09-15T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000005', 'tomato-soup', '토마토 수프', 'DISH', true, true, 'https://example.com/dding-farm-fixtures', '2026-09-15T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000006', 'bread', '빵', 'DISH', true, true, 'https://example.com/dding-farm-fixtures', '2026-09-15T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000007', 'tomato-pasta', '토마토 파스타', 'DISH', true, true, 'https://example.com/dding-farm-fixtures', '2026-09-15T00:00:00Z');

insert into public.recipes (id, output_item_id, output_quantity, active, valid_from, valid_to, source_url, verified_at) values
  ('10000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000004', 2, true, '2026-09-01T00:00:00Z', null, 'https://example.com/dding-farm-fixtures', '2026-09-15T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000005', 1, true, '2026-09-01T00:00:00Z', null, 'https://example.com/dding-farm-fixtures', '2026-09-15T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000006', 2, true, '2026-09-01T00:00:00Z', null, 'https://example.com/dding-farm-fixtures', '2026-09-15T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000007', 1, true, '2026-09-01T00:00:00Z', null, 'https://example.com/dding-farm-fixtures', '2026-09-15T00:00:00Z');

insert into public.recipe_ingredients (id, recipe_id, ingredient_item_id, quantity, source_url, verified_at) values
  ('10000000-0000-4000-8000-000000000021', '10000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000002', 3, 'https://example.com/dding-farm-fixtures', '2026-09-15T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000022', '10000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000001', 3, 'https://example.com/dding-farm-fixtures', '2026-09-15T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000023', '10000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000003', 1, 'https://example.com/dding-farm-fixtures', '2026-09-15T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000024', '10000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000004', 2, 'https://example.com/dding-farm-fixtures', '2026-09-15T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000025', '10000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000003', 1, 'https://example.com/dding-farm-fixtures', '2026-09-15T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000026', '10000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000004', 2, 'https://example.com/dding-farm-fixtures', '2026-09-15T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000027', '10000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000001', 2, 'https://example.com/dding-farm-fixtures', '2026-09-15T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000028', '10000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000003', 1, 'https://example.com/dding-farm-fixtures', '2026-09-15T00:00:00Z');

insert into public.price_cycles (id, starts_at, ends_at, status, published_at, published_by, source_url, verified_at) values
  ('10000000-0000-4000-8000-000000000031', '2026-09-16T00:00:00+09:00', '2026-09-19T00:00:00+09:00', 'PUBLISHED', '2026-09-15T00:00:00Z', null, 'https://example.com/dding-farm-fixtures', '2026-09-15T00:00:00Z');

insert into public.cooking_prices (id, cycle_id, dish_item_id, base_price, source_note, source_url, verified_at) values
  ('10000000-0000-4000-8000-000000000041', '10000000-0000-4000-8000-000000000031', '10000000-0000-4000-8000-000000000005', 900, 'Synthetic test fixture; not verified game data', 'https://example.com/dding-farm-fixtures', '2026-09-15T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000042', '10000000-0000-4000-8000-000000000031', '10000000-0000-4000-8000-000000000006', 700, 'Synthetic test fixture; not verified game data', 'https://example.com/dding-farm-fixtures', '2026-09-15T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000043', '10000000-0000-4000-8000-000000000031', '10000000-0000-4000-8000-000000000007', 1600, 'Synthetic test fixture; not verified game data', 'https://example.com/dding-farm-fixtures', '2026-09-15T00:00:00Z');

insert into public.skills (id, slug, name, applies_to, max_level, active, source_url, verified_at) values
  ('10000000-0000-4000-8000-000000000051', 'sale-bonus', '판매 보너스 (샘플)', 'DISH', 2, true, 'https://example.com/dding-farm-fixtures', '2026-09-15T00:00:00Z');

insert into public.skill_levels (id, skill_id, level, effect_type, effect_value, effect_order, minimum_quantity, rounding, verified, rules_version, source_url, verified_at) values
  ('10000000-0000-4000-8000-000000000061', '10000000-0000-4000-8000-000000000051', 1, 'SELL_PRICE_MULTIPLIER', 0.05, 1, null, 'FLOOR', true, 'fixture-v1', 'https://example.com/dding-farm-fixtures', '2026-09-15T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000062', '10000000-0000-4000-8000-000000000051', 2, 'SELL_PRICE_MULTIPLIER', 0.1, 1, null, 'FLOOR', true, 'fixture-v1', 'https://example.com/dding-farm-fixtures', '2026-09-15T00:00:00Z');

commit;
