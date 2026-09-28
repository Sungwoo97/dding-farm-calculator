import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { loadPriceEditorData } from './editor-data'

const dish = { id: '10000000-0000-4000-8000-000000000005', slug: 'soup', name: '수프', official_min_price: 50, official_max_price: 150 }
// Fake only the remote query boundary, including server-side filtering and caps.
function clientWith(rows: Record<string, Record<string, unknown>[]>) {
  return { from(table: string) {
    let cursor = ''
    const filters: Record<string, unknown> = {}
    const query = {
      select: () => query, order: () => query, limit: () => query,
      eq: (key: string, value: unknown) => { filters[key] = value; return query },
      gt: (_key: string, value: string) => { cursor = value; return query },
      then(resolve: (value: unknown) => unknown) { return Promise.resolve(resolve({ error: null, data: (rows[table] ?? []).filter((row) => String(row.id) > cursor && Object.entries(filters).every(([key, value]) => row[key] === value)).slice(0, 1) })) },
    }
    return query
  } } as unknown as SupabaseClient
}
describe('admin editor data', () => {
  it('reads all active dishes despite a server cap of one row and copies the latest published cycle', async () => {
    const data = await loadPriceEditorData(clientWith({
      items: [{ ...dish, active: true, category: 'DISH' }, { ...dish, id: '10000000-0000-4000-8000-000000000006', slug: 'salad', active: true, category: 'DISH' }],
      price_cycles: [{ id: '20000000-0000-4000-8000-000000000001', starts_at: '2026-09-18T15:00:00Z', ends_at: '2026-09-21T15:00:00Z', status: 'PUBLISHED' }],
      cooking_prices: [{ id: '30000000-0000-4000-8000-000000000001', cycle_id: '20000000-0000-4000-8000-000000000001', dish_item_id: dish.id, base_price: 120 }],
    }))
    expect(data.dishes).toHaveLength(2)
    expect(data.previousPrices).toEqual({ [dish.id]: 120 })
    expect(data.initialStartsAt).toBe('2026-09-21T15:00:00Z')
    expect(data.dishes[0].officialMinPrice).toBe(50)
  })
  it('fails closed on malformed official bounds instead of omitting validation', async () => {
    await expect(loadPriceEditorData(clientWith({ items: [{ ...dish, active: true, category: 'DISH', official_max_price: null }] }))).rejects.toThrow()
  })
})
