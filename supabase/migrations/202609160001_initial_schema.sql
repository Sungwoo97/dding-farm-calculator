-- All instants are timestamptz. The application displays them in Asia/Seoul.
-- An elapsed 72 hours is deliberately not a calendar-date approximation.
begin;

create table public.items (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (length(trim(slug)) > 0),
  name text not null check (length(trim(name)) > 0),
  category text not null check (category in ('RAW', 'PROCESSED', 'DISH', 'FIXED_INGREDIENT')),
  tradeable boolean not null default true,
  active boolean not null default true,
  source_url text not null check (source_url ~ '^https?://'),
  verified_at timestamptz not null
);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  output_item_id uuid not null references public.items(id),
  output_quantity numeric not null check (output_quantity > 0 and output_quantity < 'Infinity'::numeric),
  active boolean not null default true,
  valid_from timestamptz not null,
  valid_to timestamptz,
  source_url text not null check (source_url ~ '^https?://'),
  verified_at timestamptz not null,
  check (valid_to is null or valid_to > valid_from)
);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  ingredient_item_id uuid not null references public.items(id),
  quantity numeric not null check (quantity > 0 and quantity < 'Infinity'::numeric),
  source_url text not null check (source_url ~ '^https?://'),
  verified_at timestamptz not null,
  unique (recipe_id, ingredient_item_id)
);

create table public.price_cycles (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED', 'EXPIRED')),
  published_at timestamptz,
  published_by uuid references auth.users(id),
  source_url text not null check (source_url ~ '^https?://'),
  verified_at timestamptz not null,
  check (isfinite(starts_at) and isfinite(ends_at)),
  check (ends_at = starts_at + interval '72 hours'),
  check (status <> 'PUBLISHED' or published_at is not null),
  exclude using gist (tstzrange(starts_at, ends_at, '[)') with &&)
    where (status = 'PUBLISHED')
);

create table public.cooking_prices (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.price_cycles(id) on delete cascade,
  dish_item_id uuid not null references public.items(id),
  base_price bigint not null check (base_price > 0 and base_price <= 9007199254740991),
  source_note text not null,
  source_url text not null check (source_url ~ '^https?://'),
  verified_at timestamptz not null,
  unique (cycle_id, dish_item_id)
);

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (length(trim(slug)) > 0),
  name text not null check (length(trim(name)) > 0),
  applies_to text not null check (applies_to = 'DISH'),
  max_level integer not null check (max_level > 0),
  active boolean not null default false,
  source_url text not null check (source_url ~ '^https?://'),
  verified_at timestamptz not null
);

create table public.skill_levels (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references public.skills(id) on delete cascade,
  level integer not null check (level > 0),
  effect_type text not null check (effect_type in ('SELL_PRICE_MULTIPLIER', 'BULK_SALE_MULTIPLIER', 'EXPECTED_EXTRA_OUTPUT')),
  effect_value numeric not null check (effect_value >= 0 and effect_value < 'Infinity'::numeric),
  effect_order integer not null check (effect_order >= 0),
  minimum_quantity numeric check (minimum_quantity > 0 and minimum_quantity < 'Infinity'::numeric),
  rounding text not null check (rounding in ('FLOOR', 'ROUND', 'CEIL', 'NONE')),
  verified boolean not null default false,
  rules_version text not null check (length(trim(rules_version)) > 0),
  source_url text not null check (source_url ~ '^https?://'),
  verified_at timestamptz not null,
  unique (skill_id, level)
);

create table public.change_logs (
  id uuid primary key default gen_random_uuid(),
  table_name text not null check (table_name in ('items', 'recipes', 'recipe_ingredients', 'price_cycles', 'cooking_prices', 'skills', 'skill_levels')),
  record_id uuid not null,
  before_data jsonb,
  after_data jsonb,
  changed_by uuid not null references auth.users(id),
  change_reason text not null check (length(trim(change_reason)) > 0),
  changed_at timestamptz not null default now(),
  check (before_data is not null or after_data is not null)
);

create index recipes_output_item_id_idx on public.recipes(output_item_id);
create index recipe_ingredients_item_id_idx on public.recipe_ingredients(ingredient_item_id);
create index cooking_prices_dish_item_id_idx on public.cooking_prices(dish_item_id);
create index price_cycles_published_by_idx on public.price_cycles(published_by);
create index change_logs_record_idx on public.change_logs(table_name, record_id, changed_at desc);
create index change_logs_changed_by_idx on public.change_logs(changed_by);

alter table public.items enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.price_cycles enable row level security;
alter table public.cooking_prices enable row level security;
alter table public.skills enable row level security;
alter table public.skill_levels enable row level security;
alter table public.change_logs enable row level security;

create policy "public can read active items" on public.items
  for select to anon, authenticated using (active);
create policy "public can read active recipes" on public.recipes
  for select to anon, authenticated using (
    active and valid_from <= now() and (valid_to is null or now() < valid_to)
    and exists (select 1 from public.items where items.id = output_item_id and items.active)
  );
create policy "public can read active recipe ingredients" on public.recipe_ingredients
  for select to anon, authenticated using (
    exists (select 1 from public.recipes where recipes.id = recipe_id and recipes.active
      and recipes.valid_from <= now() and (recipes.valid_to is null or now() < recipes.valid_to))
  );
-- Retain every ingredient relationship of a visible recipe. Hiding a row when
-- an ingredient is deactivated would silently reduce its cost. The catalog
-- validator rejects missing item references instead of serving a partial recipe.
create policy "public can read published price cycles" on public.price_cycles
  for select to anon, authenticated using (status = 'PUBLISHED');
create policy "public can read published cooking prices" on public.cooking_prices
  for select to anon, authenticated using (
    exists (select 1 from public.price_cycles where price_cycles.id = cycle_id and price_cycles.status = 'PUBLISHED')
    and exists (select 1 from public.items where items.id = dish_item_id and items.active and items.category = 'DISH')
  );
create policy "public can read active skills" on public.skills
  for select to anon, authenticated using (active);
create policy "public can read verified skill levels" on public.skill_levels
  for select to anon, authenticated using (
    verified and exists (select 1 from public.skills where skills.id = skill_id and skills.active)
  );

create policy "admins can manage items" on public.items for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admins can manage recipes" on public.recipes for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admins can manage recipe ingredients" on public.recipe_ingredients for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admins can manage price cycles" on public.price_cycles for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admins can manage cooking prices" on public.cooking_prices for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admins can manage skills" on public.skills for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admins can manage skill levels" on public.skill_levels for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Audit history is private and append-only, including for administrators.
create policy "admins can read change logs" on public.change_logs for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admins can append own change logs" on public.change_logs for insert to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' and changed_by = auth.uid());

revoke all on public.items, public.recipes, public.recipe_ingredients, public.price_cycles,
  public.cooking_prices, public.skills, public.skill_levels, public.change_logs from anon, authenticated;
grant select on public.items, public.recipes, public.recipe_ingredients, public.price_cycles,
  public.cooking_prices, public.skills, public.skill_levels to anon, authenticated;
grant insert, update, delete on public.items, public.recipes, public.recipe_ingredients, public.price_cycles,
  public.cooking_prices, public.skills, public.skill_levels to authenticated;
grant select, insert on public.change_logs to authenticated;

commit;
