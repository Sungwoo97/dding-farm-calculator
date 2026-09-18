import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { getEnv } from '@/lib/env'
import { createServerClient } from '@/lib/supabase/server'
import { CatalogQueryError, NoActivePriceCycleError, type PublishedCatalog } from '../types'
import { assertActiveCycle, cycleRowSchema, mapPublishedCatalog } from './catalog-mapper'
import { getFixtureCatalog } from './fixture-catalog'

async function readRows(table: string, query: PromiseLike<{ data: unknown; error: unknown }>) {
  const { data, error } = await query
  if (error) throw new CatalogQueryError(table, error)
  return data
}

type CatalogQuery = ReturnType<ReturnType<SupabaseClient['from']>['select']>
const pageSchema = z.array(z.object({ id: z.uuid() }).passthrough())

async function readAllRows(table: string, createQuery: () => CatalogQuery) {
  const rows: z.infer<typeof pageSchema> = []
  let cursor: string | undefined
  while (true) {
    let query = createQuery().order('id', { ascending: true }).limit(1000)
    if (cursor !== undefined) query = query.gt('id', cursor)
    const page = pageSchema.parse(await readRows(table, query))
    if (page.length === 0) return rows
    for (const row of page) {
      if (cursor !== undefined && row.id <= cursor) {
        throw new CatalogQueryError(table, new Error('Catalog pagination did not advance in ID order'))
      }
      cursor = row.id
      rows.push(row)
    }
    // A server may cap results below our requested page size. Continue until
    // an empty page, never interpret a short page as proof of completeness.
  }
}

async function selectPublishedCatalogRows(client: SupabaseClient, now: Date) {
  const timestamp = now.toISOString()
  const cycles = z.array(cycleRowSchema).parse(await readRows('price_cycles', client.from('price_cycles')
    .select('*').eq('status', 'PUBLISHED').lte('starts_at', timestamp).gt('ends_at', timestamp).order('id').limit(2)))
  if (cycles.length === 0) throw new NoActivePriceCycleError()
  if (cycles.length > 1) throw new Error('Multiple active published price cycles')
  assertActiveCycle(cycles[0], now)

  const [items, recipes, ingredients, prices, skills, levels] = await Promise.all([
    readAllRows('items', () => client.from('items').select('*').eq('active', true)),
    readAllRows('recipes', () => client.from('recipes').select('*').eq('active', true).lte('valid_from', timestamp).or(`valid_to.is.null,valid_to.gt.${timestamp}`)),
    readAllRows('recipe_ingredients', () => client.from('recipe_ingredients').select('*')),
    readAllRows('cooking_prices', () => client.from('cooking_prices').select('*').eq('cycle_id', cycles[0].id)),
    readAllRows('skills', () => client.from('skills').select('*').eq('active', true)),
    readAllRows('skill_levels', () => client.from('skill_levels').select('*').eq('verified', true)),
  ])
  return { items, recipes, recipe_ingredients: ingredients, price_cycles: cycles, cooking_prices: prices, skills, skill_levels: levels }
}

export async function getPublishedCatalog(now: Date): Promise<PublishedCatalog> {
  if (getEnv().NEXT_PUBLIC_USE_FIXTURES === '1') return getFixtureCatalog(now)
  const client = await createServerClient()
  return mapPublishedCatalog(await selectPublishedCatalogRows(client, now), now)
}
