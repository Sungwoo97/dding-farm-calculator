import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

const safePrice = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
const dishRowSchema = z.object({ id: z.uuid(), slug: z.string(), name: z.string(), official_min_price: safePrice.nullable(), official_max_price: safePrice.nullable() })
  .refine((dish) => (dish.official_min_price === null && dish.official_max_price === null)
    || (dish.official_min_price !== null && dish.official_max_price !== null && dish.official_min_price <= dish.official_max_price))
const cycleRowSchema = z.object({ id: z.uuid(), starts_at: z.string(), ends_at: z.string() })
const priceRowSchema = z.object({ id: z.uuid(), dish_item_id: z.uuid(), base_price: safePrice })
interface Query extends PromiseLike<{ data: unknown; error: unknown }> {
  order(column: string): Query
  limit(count: number): Query
  gt(column: string, value: string): Query
}

// Follow keyset pages to an empty page so server row caps cannot hide dishes.
async function allRows<T extends { id: string }>(makeQuery: () => Query, schema: z.ZodType<T>): Promise<T[]> {
  const rows: T[] = []
  let cursor: string | undefined
  while (true) {
    let query = makeQuery().order('id').limit(1000)
    if (cursor) query = query.gt('id', cursor)
    const { data, error } = await query
    if (error) throw new Error('가격 편집 데이터를 읽지 못했습니다.')
    const page = z.array(schema).parse(data)
    if (!page.length) return rows
    for (const row of page) {
      if (cursor && row.id <= cursor) throw new Error('가격 편집 데이터 순서 오류')
      cursor = row.id
      rows.push(row)
    }
  }
}

// Caller must requireAdmin using this same cookie-based client first.
export async function loadPriceEditorData(client: SupabaseClient) {
  const [dishRows, cycleRows] = await Promise.all([
    allRows(() => client.from('items').select('id,slug,name,official_min_price,official_max_price').eq('active', true).eq('category', 'DISH'), dishRowSchema),
    allRows(() => client.from('price_cycles').select('id,starts_at,ends_at').eq('status', 'PUBLISHED'), cycleRowSchema),
  ])
  const previous = cycleRows.sort((left, right) => Date.parse(right.starts_at) - Date.parse(left.starts_at))[0]
  const priceRows = previous ? await allRows(() => client.from('cooking_prices').select('id,dish_item_id,base_price').eq('cycle_id', previous.id), priceRowSchema) : []
  return {
    dishes: dishRows.map((dish) => ({ id: dish.id, slug: dish.slug, name: dish.name, officialMinPrice: dish.official_min_price, officialMaxPrice: dish.official_max_price })),
    previousPrices: Object.fromEntries(priceRows.map((price) => [price.dish_item_id, price.base_price])),
    published: cycleRows.map((cycle) => ({ startsAt: cycle.starts_at, endsAt: cycle.ends_at })),
    initialStartsAt: previous?.ends_at ?? new Date().toISOString(),
  }
}
