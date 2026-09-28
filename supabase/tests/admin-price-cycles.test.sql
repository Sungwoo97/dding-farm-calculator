begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users (id, email) values ('90000000-0000-4000-8000-000000000001', 'price-admin@example.com');
update items set official_min_price = 50, official_max_price = 150 where category = 'DISH';
select throws_ok($$update items set official_min_price = null where category = 'DISH'$$, '23514', null, 'official bounds must be paired');
select throws_ok($$update items set official_max_price = 49 where category = 'DISH'$$, '23514', null, 'official bounds must be ordered');

select set_config('request.jwt.claims', '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"user"},"user_metadata":{"role":"admin"}}', true);
set local role authenticated;
select throws_ok($$select create_price_cycle_draft('{}'::jsonb)$$, '42501', null, 'spoofed user_metadata cannot create drafts');
select throws_ok($$select publish_price_cycle('20000000-0000-4000-8000-000000000001', 'test')$$, '42501', null, 'ordinary user cannot publish');
reset role;
set local role anon;
select throws_ok($$select create_price_cycle_draft('{}'::jsonb)$$, '42501', null, 'anonymous cannot invoke draft RPC');
reset role;

select set_config('request.jwt.claims', '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"admin"}}', true);
set local role authenticated;
select throws_ok($$select create_price_cycle_draft('{"startsAt":"2030-01-01T00:00:00Z","sourceUrl":"https://example.com","reason":"test","prices":[{"dishItemId":"10000000-0000-4000-8000-000000000005","basePrice":1.5,"sourceNote":""}]}')$$, '23514', null, 'RPC rejects fractional price before bigint coercion');
select throws_ok($$select create_price_cycle_draft('{"startsAt":"2030-01-01T00:00:00Z","sourceUrl":"https://example.com","reason":"test","prices":[{"dishItemId":"10000000-0000-4000-8000-000000000005","basePrice":0,"sourceNote":""}]}')$$, '23514', null, 'RPC rejects zero price');
select is((select count(*) from price_cycles where starts_at = '2030-01-01T00:00:00Z'), 0::bigint, 'failed creation leaves no partial cycle');
select is((select count(*) from change_logs), 0::bigint, 'failed creation leaves no partial audit rows');

select set_config('test.incomplete_id', create_price_cycle_draft('{"startsAt":"2030-01-01T00:00:00Z","sourceUrl":"https://example.com","reason":"incomplete","prices":[]}')::text, true);
select is((select ends_at - starts_at from price_cycles where id = current_setting('test.incomplete_id')::uuid), interval '72 hours', 'RPC defaults exact 72 hours');
select throws_ok($$select publish_price_cycle(current_setting('test.incomplete_id')::uuid, 'publish')$$, '23514', null, 'missing active prices block publish');
select is((select status from price_cycles where id = current_setting('test.incomplete_id')::uuid), 'DRAFT', 'failed publication preserves draft');

select set_config('test.complete_id', create_price_cycle_draft(jsonb_build_object('startsAt', '2030-01-01T00:00:00Z', 'sourceUrl', 'https://example.com', 'reason', 'complete', 'prices', (select jsonb_agg(jsonb_build_object('dishItemId', id, 'basePrice', 100, 'sourceNote', '')) from items where active and category = 'DISH')))::text, true);
select is((select count(*) from change_logs where record_id = current_setting('test.complete_id')::uuid), 1::bigint, 'draft creation is audited');
select is((select count(*) from change_logs where table_name = 'cooking_prices'), (select count(*) from items where active and category = 'DISH'), 'each child price is audited');
update cooking_prices set base_price = 151 where cycle_id = current_setting('test.complete_id')::uuid;
select throws_ok($$select publish_price_cycle(current_setting('test.complete_id')::uuid, 'publish')$$, '23514', null, 'out-of-range values require a source note at publish time');
update cooking_prices set source_note = 'official confirmation' where cycle_id = current_setting('test.complete_id')::uuid;
select lives_ok($$select publish_price_cycle(current_setting('test.complete_id')::uuid, 'publish')$$, 'documented out-of-range values can publish');
select is((select published_by from price_cycles where id = current_setting('test.complete_id')::uuid), '90000000-0000-4000-8000-000000000001'::uuid, 'publisher comes from auth.uid');
select is((select count(*) from change_logs where record_id = current_setting('test.complete_id')::uuid), 2::bigint, 'publication adds one immutable audit snapshot');
select throws_ok($$select publish_price_cycle(current_setting('test.complete_id')::uuid, 'again')$$, '23514', null, 'cannot publish a published cycle again');

select set_config('test.overlap_id', create_price_cycle_draft(jsonb_build_object('startsAt', '2030-01-02T00:00:00Z', 'sourceUrl', 'https://example.com', 'reason', 'overlap', 'prices', (select jsonb_agg(jsonb_build_object('dishItemId', id, 'basePrice', 100, 'sourceNote', '')) from items where active and category = 'DISH')))::text, true);
select throws_ok($$select publish_price_cycle(current_setting('test.overlap_id')::uuid, 'publish')$$, '23514', null, 'published overlap is rejected');
select set_config('test.adjacent_id', create_price_cycle_draft(jsonb_build_object('startsAt', '2030-01-04T00:00:00Z', 'sourceUrl', 'https://example.com', 'reason', 'adjacent', 'prices', (select jsonb_agg(jsonb_build_object('dishItemId', id, 'basePrice', 100, 'sourceNote', '')) from items where active and category = 'DISH')))::text, true);
select lives_ok($$select publish_price_cycle(current_setting('test.adjacent_id')::uuid, 'publish')$$, 'exact adjacent boundary can publish');
select set_config('test.stale_id', create_price_cycle_draft(jsonb_build_object('startsAt', '2030-02-01T00:00:00Z', 'sourceUrl', 'https://example.com', 'reason', 'stale', 'prices', (select jsonb_agg(jsonb_build_object('dishItemId', id, 'basePrice', 100, 'sourceNote', '')) from items where active and category = 'DISH')))::text, true);
insert into items (slug, name, category, source_url, verified_at) values ('new-active-dish', 'New dish', 'DISH', 'https://example.com', now());
select throws_ok($$select publish_price_cycle(current_setting('test.stale_id')::uuid, 'publish')$$, '23514', null, 'publish rereads dishes activated after draft creation');
select throws_ok($$update change_logs set change_reason = 'tamper'$$, '42501', null, 'audit history cannot be modified');
select throws_ok($$delete from change_logs$$, '42501', null, 'audit history cannot be removed');
reset role;
-- Deliberately fail the audit insert: all cycle mutations must roll back too.
revoke insert on change_logs from authenticated;
set local role authenticated;
select throws_ok($$select create_price_cycle_draft('{"startsAt":"2031-01-01T00:00:00Z","sourceUrl":"https://example.com","reason":"audit failure","prices":[]}')$$, '42501', null, 'audit failure aborts the mutation');
select is((select count(*) from price_cycles where starts_at = '2031-01-01T00:00:00Z'), 0::bigint, 'audit failure leaves no cycle behind');
reset role;
select * from finish();
rollback;
