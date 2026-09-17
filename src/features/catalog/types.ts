import { z } from 'zod'

const id = z.uuid()
const timestamp = z.iso.datetime({ offset: true })
const positiveNumber = z.number().finite().positive()
const provenance = { sourceUrl: z.url(), verifiedAt: timestamp }

export const publishedCatalogSchema = z.object({
  items: z.array(z.object({
    id, slug: z.string().min(1), name: z.string().min(1),
    category: z.enum(['RAW', 'PROCESSED', 'DISH', 'FIXED_INGREDIENT']),
    tradeable: z.boolean(), ...provenance,
  })),
  recipes: z.array(z.object({
    id, outputItemId: id, outputQuantity: positiveNumber,
    ingredients: z.array(z.object({ itemId: id, quantity: positiveNumber })).min(1),
    validFrom: timestamp, validTo: timestamp.nullable(), ...provenance,
  })),
  activeCycle: z.object({
    id, startsAt: timestamp, endsAt: timestamp, status: z.literal('PUBLISHED'),
    timeZone: z.literal('Asia/Seoul'), publishedAt: timestamp,
    ...provenance,
  }).refine((cycle) => Date.parse(cycle.endsAt) - Date.parse(cycle.startsAt) === 72 * 60 * 60 * 1000, 'Price cycles must last exactly 72 hours'),
  prices: z.array(z.object({
    dishItemId: id, basePrice: positiveNumber.int().safe(), sourceNote: z.string(), ...provenance,
  })),
  skills: z.array(z.object({
    id, slug: z.string().min(1), name: z.string().min(1), appliesTo: z.literal('DISH'),
    maxLevel: positiveNumber.int(), ...provenance,
    levels: z.array(z.object({
      level: positiveNumber.int(), rulesVersion: z.string().min(1), ...provenance,
      effect: z.object({
        type: z.enum(['SELL_PRICE_MULTIPLIER', 'BULK_SALE_MULTIPLIER', 'EXPECTED_EXTRA_OUTPUT']),
        value: z.number().finite().nonnegative(), order: z.number().int().nonnegative(),
        minimumQuantity: positiveNumber.optional(),
        rounding: z.enum(['FLOOR', 'ROUND', 'CEIL', 'NONE']), verified: z.boolean(),
      }),
    })),
  })),
  dataVersion: z.string().min(1),
}).superRefine((catalog, context) => {
  const itemIds = new Set(catalog.items.map((item) => item.id))
  catalog.recipes.forEach((recipe, recipeIndex) => {
    recipe.ingredients.forEach((ingredient, ingredientIndex) => {
      if (!itemIds.has(ingredient.itemId)) context.addIssue({
        code: 'custom', message: `Unknown ingredient: ${ingredient.itemId}`,
        path: ['recipes', recipeIndex, 'ingredients', ingredientIndex, 'itemId'],
      })
    })
  })
})

// Structural extension of the existing domain Catalog; all fields are JSON-safe.
export type PublishedCatalog = z.infer<typeof publishedCatalogSchema>

export class NoActivePriceCycleError extends Error {
  constructor() {
    super('No published price cycle is active at the requested time')
    this.name = 'NoActivePriceCycleError'
  }
}

export class CatalogQueryError extends Error {
  constructor(table: string, cause: unknown) {
    super(`Failed to load catalog table: ${table}`, { cause })
    this.name = 'CatalogQueryError'
  }
}
