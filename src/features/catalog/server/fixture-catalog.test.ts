// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { expandRecipe } from '@/features/calculator/domain/recipe-tree'
import { catalogCacheSchema } from '@/features/user-settings/storage/schema'
import { getFixtureCatalog } from './fixture-catalog'
import { NoActivePriceCycleError, publishedCatalogSchema } from '../types'

describe('fixture catalog', () => {
  it('provides three priced dishes, a nested recipe, and two supported skill levels in the shared contract', () => {
    const catalog = getFixtureCatalog(new Date('2026-09-16T00:00:00+09:00'))
    expect(publishedCatalogSchema.parse(catalog)).toEqual(catalog)
    const dishes = catalog.items.filter((item) => item.category === 'DISH')
    expect(dishes).toHaveLength(3)
    for (const dish of dishes) {
      expect(catalog.prices.some((price) => price.dishItemId === dish.id)).toBe(true)
    }
    expect(catalog.skills.flatMap((skill) => skill.levels)).toHaveLength(2)
    const pasta = catalog.items.find((item) => item.slug === 'tomato-pasta')!
    const settings = new Map(catalog.items.map((item) => [item.id, { itemId: item.id, sourceMode: 'SELF' as const, ownedQuantity: 0 }]))
    expect(expandRecipe(pasta.id, 1, catalog, settings).errors).toEqual([])
    expect(catalog.recipes.some((recipe) => recipe.ingredients.some((ingredient) => catalog.recipes.some((nested) => nested.outputItemId === ingredient.itemId)))).toBe(true)
    expect(catalogCacheSchema.parse({ catalog, cachedAt: '2026-09-16T00:00:00Z', dataVersion: catalog.dataVersion }).catalog).toEqual(catalog)
  })
  it.each(['2026-09-15T23:59:59+09:00', '2026-09-19T00:00:00+09:00'])('rejects time outside the fixed half-open interval: %s', (date) => {
    expect(() => getFixtureCatalog(new Date(date))).toThrow(NoActivePriceCycleError)
  })
  it('returns independent results so consumer mutation cannot contaminate the next request', () => {
    const now = new Date('2026-09-17T00:00:00+09:00')
    const catalog = getFixtureCatalog(now)
    catalog.items[0].name = 'changed'
    expect(getFixtureCatalog(now).items[0].name).not.toBe('changed')
  })
})
