// @vitest-environment node
import { createClient } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getPublishedCatalog } from './repository'
import { NoActivePriceCycleError, CatalogQueryError } from '../types'
import { getFixtureCatalog } from './fixture-catalog'
import fixtureRows from './fixture-rows.json'

const server = vi.hoisted(() => ({ createServerClient: vi.fn() }))
vi.mock('@/lib/supabase/server', () => server)

const source = { source_url: 'https://example.com/fixture', verified_at: '2026-09-15T00:00:00Z' }
const rawId = '00000000-0000-4000-8000-000000000001'
const dishId = '00000000-0000-4000-8000-000000000002'
const recipeId = '00000000-0000-4000-8000-000000000003'
const cycleId = '00000000-0000-4000-8000-000000000004'
const skillId = '00000000-0000-4000-8000-000000000005'
const now = new Date('2026-09-17T12:00:00+09:00')

function databaseRows(): Record<string, Record<string, unknown>[]> {
  return {
    items: [
      { id: rawId, slug: 'tomato', name: '토마토', category: 'RAW', tradeable: true, active: true, ...source },
      { id: dishId, slug: 'soup', name: '수프', category: 'DISH', tradeable: true, active: true, ...source },
    ],
    recipes: [{ id: recipeId, output_item_id: dishId, output_quantity: 2, active: true, valid_from: '2026-09-01T00:00:00Z', valid_to: null, ...source }],
    recipe_ingredients: [{ id: '00000000-0000-4000-8000-000000000006', recipe_id: recipeId, ingredient_item_id: rawId, quantity: 3, ...source }],
    price_cycles: [{ id: cycleId, starts_at: '2026-09-16T00:00:00+09:00', ends_at: '2026-09-19T00:00:00+09:00', status: 'PUBLISHED', published_at: '2026-09-15T00:00:00Z', published_by: null, ...source }],
    cooking_prices: [{ id: '00000000-0000-4000-8000-000000000007', cycle_id: cycleId, dish_item_id: dishId, base_price: 1234, source_note: 'Synthetic fixture', ...source }],
    skills: [{ id: skillId, slug: 'sell', name: '판매 스킬', applies_to: 'DISH', max_level: 2, active: true, ...source }],
    skill_levels: [{ id: '00000000-0000-4000-8000-000000000008', skill_id: skillId, level: 1, effect_type: 'SELL_PRICE_MULTIPLIER', effect_value: 0.1, effect_order: 1, minimum_quantity: null, rounding: 'FLOOR', verified: true, rules_version: '1', ...source }],
  }
}

let rows: ReturnType<typeof databaseRows>
let requests: URL[]
let failedTable: string | undefined
let failedAfterCursor: boolean
let rowCap: number

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_USE_FIXTURES', '0')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://catalog.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test')
  rows = databaseRows()
  requests = []
  failedTable = undefined
  failedAfterCursor = false
  rowCap = 1000
  server.createServerClient.mockResolvedValue(createClient('https://catalog.supabase.co', 'sb_publishable_test', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input) => {
      const url = new URL(String(input))
      requests.push(url)
      const table = url.pathname.split('/').at(-1)!
      const cursor = url.searchParams.get('id')?.replace(/^gt\./, '')
      const failed = table === failedTable && (!failedAfterCursor || cursor !== undefined)
      const orderedRows = [...rows[table]].sort((left, right) => String(left.id).localeCompare(String(right.id)))
      const visibleRows = cursor ? orderedRows.filter((row) => String(row.id) > cursor) : orderedRows
      const page = visibleRows.slice(0, Math.min(table === 'price_cycles' ? 1000 : rowCap, Number(url.searchParams.get('limit') ?? 1000)))
      return new Response(JSON.stringify(failed
        ? { message: 'database unavailable', code: 'XX000' }
        : page), { status: failed ? 500 : 200, headers: { 'Content-Type': 'application/json' } })
    } },
  }))
})

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks() })

describe('getPublishedCatalog', () => {
  function addIngredientsAcrossPageBoundary() {
    rows.recipe_ingredients = []
    for (let index = 1; index <= 1001; index += 1) {
      const itemId = `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`
      rows.items.push({ ...rows.items[0], id: itemId, slug: `ingredient-${index}` })
      rows.recipe_ingredients.push({ ...source, id: `20000000-0000-4000-8000-${String(index).padStart(12, '0')}`, recipe_id: recipeId, ingredient_item_id: itemId, quantity: index === 1001 ? 7 : 1 })
    }
  }

  it('maps every ingredient when a recipe spans the 1000-row response boundary', async () => {
    addIngredientsAcrossPageBoundary()
    const catalog = await getPublishedCatalog(now)
    expect(catalog.items).toHaveLength(1003)
    expect(catalog.recipes[0].ingredients).toHaveLength(1001)
    expect(catalog.recipes[0].ingredients.at(-1)).toEqual({ itemId: '10000000-0000-4000-8000-000000001001', quantity: 7 })
    expect(catalog.recipes[0].ingredients.reduce((sum, ingredient) => sum + ingredient.quantity, 0)).toBe(1007)
    expect(requests.filter((url) => !url.pathname.endsWith('/price_cycles')).every((url) => url.searchParams.get('order') === 'id.asc')).toBe(true)
  })

  it('rejects the catalog if a later ingredient page fails', async () => {
    addIngredientsAcrossPageBoundary()
    failedTable = 'recipe_ingredients'
    failedAfterCursor = true
    await expect(getPublishedCatalog(now)).rejects.toBeInstanceOf(CatalogQueryError)
  })

  it('fetches all six catalog collections even when the server returns short pages', async () => {
    rows = JSON.parse(JSON.stringify(fixtureRows))
    rows.skills.push({ ...rows.skills[0], id: '10000000-0000-4000-8000-000000000052', slug: 'second-skill' })
    rowCap = 1
    const catalog = await getPublishedCatalog(now)
    expect(catalog.items).toHaveLength(7)
    expect(catalog.recipes).toHaveLength(4)
    expect(catalog.recipes.flatMap((recipe) => recipe.ingredients)).toHaveLength(8)
    expect(catalog.prices).toHaveLength(3)
    expect(catalog.skills).toHaveLength(2)
    expect(catalog.skills[0].levels).toHaveLength(2)
  })

  it('queries one published cycle with inclusive start and exclusive end, then maps domain fields', async () => {
    const catalog = await getPublishedCatalog(now)
    const cycleRequest = requests.find((url) => url.pathname.endsWith('/price_cycles'))!
    expect(cycleRequest.searchParams.get('status')).toBe('eq.PUBLISHED')
    expect(cycleRequest.searchParams.get('starts_at')).toBe(`lte.${now.toISOString()}`)
    expect(cycleRequest.searchParams.get('ends_at')).toBe(`gt.${now.toISOString()}`)
    expect(cycleRequest.searchParams.get('limit')).toBe('2')
    expect(requests.find((url) => url.pathname.endsWith('/cooking_prices'))!.searchParams.get('cycle_id')).toBe(`eq.${cycleId}`)
    expect(catalog.items.find((item) => item.id === rawId)).toMatchObject({ name: '토마토', category: 'RAW', tradeable: true, sourceUrl: source.source_url })
    expect(catalog.recipes).toEqual([expect.objectContaining({ id: recipeId, outputItemId: dishId, outputQuantity: 2, ingredients: [{ itemId: rawId, quantity: 3 }] })])
    expect(catalog.activeCycle).toMatchObject({ id: cycleId, status: 'PUBLISHED', timeZone: 'Asia/Seoul' })
    expect(catalog.prices).toEqual([expect.objectContaining({ dishItemId: dishId, basePrice: 1234 })])
    expect(catalog.skills[0].levels[0]).toMatchObject({ level: 1, rulesVersion: '1', effect: { type: 'SELL_PRICE_MULTIPLIER', value: 0.1, order: 1, rounding: 'FLOOR', verified: true } })
    expect(catalog.dataVersion).toMatch(/^catalog-v1:/)
  })

  it('throws NoActivePriceCycleError without falling back to expired data', async () => {
    rows.price_cycles = []
    await expect(getPublishedCatalog(now)).rejects.toBeInstanceOf(NoActivePriceCycleError)
    expect(requests).toHaveLength(1)
  })

  it('rejects overlapping active cycles instead of silently picking one', async () => {
    rows.price_cycles.push({ ...rows.price_cycles[0], id: '00000000-0000-4000-8000-000000000009' })
    await expect(getPublishedCatalog(now)).rejects.toThrow(/Multiple active/)
  })

  it.each(['price_cycles', 'cooking_prices', 'items', 'recipes', 'recipe_ingredients', 'skills', 'skill_levels'])('preserves query failure from %s instead of serving a partial catalog', async (table) => {
    failedTable = table
    await expect(getPublishedCatalog(now)).rejects.toBeInstanceOf(CatalogQueryError)
  })

  it('rejects malformed prices at the mapping boundary', async () => {
    rows.cooking_prices[0].base_price = 0
    await expect(getPublishedCatalog(now)).rejects.toThrow()
  })

  it('rejects recipes whose ingredients are absent from the active item catalog', async () => {
    rows.items = rows.items.filter((item) => item.id !== rawId)
    await expect(getPublishedCatalog(now)).rejects.toThrow(/Unknown ingredient/)
  })

  it('rejects an empty recipe instead of exposing a free dish', async () => {
    rows.recipe_ingredients = []
    await expect(getPublishedCatalog(now)).rejects.toThrow()
  })

  it('rejects a returned cycle outside the requested interval', async () => {
    await expect(getPublishedCatalog(new Date('2026-09-19T00:00:00+09:00'))).rejects.toBeInstanceOf(NoActivePriceCycleError)
  })

  it('changes dataVersion when a published price changes but keeps unchanged data stable', async () => {
    const first = await getPublishedCatalog(now)
    expect((await getPublishedCatalog(now)).dataVersion).toBe(first.dataVersion)
    rows.cooking_prices[0].base_price = 1235
    expect((await getPublishedCatalog(now)).dataVersion).not.toBe(first.dataVersion)
  })

  it('matches fixtures even when PostgreSQL returns equivalent timestamps in UTC', async () => {
    rows = JSON.parse(JSON.stringify(fixtureRows))
    for (const table of Object.values(rows)) {
      for (const record of table) {
        for (const [key, value] of Object.entries(record)) {
          if (typeof value === 'string' && ['starts_at', 'ends_at', 'published_at', 'verified_at', 'valid_from', 'valid_to'].includes(key)) record[key] = new Date(value).toISOString()
        }
      }
    }
    expect(await getPublishedCatalog(now)).toEqual(getFixtureCatalog(now))
  })

  it('uses fixtures only when explicitly enabled and does not open a server connection', async () => {
    vi.stubEnv('NEXT_PUBLIC_USE_FIXTURES', '1')
    const catalog = await getPublishedCatalog(now)
    expect(catalog.items.filter((item) => item.category === 'DISH')).toHaveLength(3)
    expect(server.createServerClient).not.toHaveBeenCalled()
  })
})
