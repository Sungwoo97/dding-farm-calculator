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

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_USE_FIXTURES', '0')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://catalog.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test')
  rows = databaseRows()
  requests = []
  failedTable = undefined
  server.createServerClient.mockResolvedValue(createClient('https://catalog.supabase.co', 'sb_publishable_test', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input) => {
      const url = new URL(String(input))
      requests.push(url)
      const table = url.pathname.split('/').at(-1)!
      return new Response(JSON.stringify(table === failedTable
        ? { message: 'database unavailable', code: 'XX000' }
        : rows[table]), { status: table === failedTable ? 500 : 200, headers: { 'Content-Type': 'application/json' } })
    } },
  }))
})

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks() })

describe('getPublishedCatalog', () => {
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
