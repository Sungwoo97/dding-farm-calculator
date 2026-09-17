import { createHash } from 'node:crypto'
import { z } from 'zod'
import { NoActivePriceCycleError, publishedCatalogSchema, type PublishedCatalog } from '../types'

const provenance = { source_url: z.url(), verified_at: z.iso.datetime({ offset: true }) }
const row = z.object({ id: z.uuid(), ...provenance })
const instant = z.iso.datetime({ offset: true })

export const cycleRowSchema = row.extend({
  starts_at: instant, ends_at: instant, status: z.literal('PUBLISHED'), published_at: instant,
})

const rowsSchema = z.object({
  items: z.array(row.extend({ slug: z.string(), name: z.string(), category: z.enum(['RAW', 'PROCESSED', 'DISH', 'FIXED_INGREDIENT']), tradeable: z.boolean() })),
  recipes: z.array(row.extend({ output_item_id: z.uuid(), output_quantity: z.number(), valid_from: instant, valid_to: instant.nullable() })),
  recipe_ingredients: z.array(row.extend({ recipe_id: z.uuid(), ingredient_item_id: z.uuid(), quantity: z.number().positive() })),
  price_cycles: z.array(cycleRowSchema).length(1),
  cooking_prices: z.array(row.extend({ cycle_id: z.uuid(), dish_item_id: z.uuid(), base_price: z.number(), source_note: z.string() })),
  skills: z.array(row.extend({ slug: z.string(), name: z.string(), applies_to: z.literal('DISH'), max_level: z.number() })),
  skill_levels: z.array(row.extend({
    skill_id: z.uuid(), level: z.number(), effect_type: z.enum(['SELL_PRICE_MULTIPLIER', 'BULK_SALE_MULTIPLIER', 'EXPECTED_EXTRA_OUTPUT']),
    effect_value: z.number(), effect_order: z.number(), minimum_quantity: z.number().nullable(),
    rounding: z.enum(['FLOOR', 'ROUND', 'CEIL', 'NONE']), verified: z.boolean(), rules_version: z.string(),
  })),
})

function source(value: z.infer<typeof row>) {
  return { sourceUrl: value.source_url, verifiedAt: new Date(value.verified_at).toISOString() }
}

export function assertActiveCycle(cycle: z.infer<typeof cycleRowSchema>, now: Date) {
  const time = now.getTime()
  if (!Number.isFinite(time)) throw new RangeError('Invalid catalog time')
  if (time < Date.parse(cycle.starts_at) || time >= Date.parse(cycle.ends_at)) {
    throw new NoActivePriceCycleError()
  }
}

export function mapPublishedCatalog(input: unknown, now: Date): PublishedCatalog {
  const rows = rowsSchema.parse(input)
  const cycle = rows.price_cycles[0]
  assertActiveCycle(cycle, now)
  const catalog = publishedCatalogSchema.parse({
    items: rows.items.map((item) => ({ id: item.id, slug: item.slug, name: item.name, category: item.category, tradeable: item.tradeable, ...source(item) })),
    recipes: rows.recipes.map((recipe) => ({
      id: recipe.id, outputItemId: recipe.output_item_id, outputQuantity: recipe.output_quantity,
      validFrom: new Date(recipe.valid_from).toISOString(), validTo: recipe.valid_to === null ? null : new Date(recipe.valid_to).toISOString(), ...source(recipe),
      ingredients: rows.recipe_ingredients.filter((ingredient) => ingredient.recipe_id === recipe.id)
        .map((ingredient) => ({ itemId: ingredient.ingredient_item_id, quantity: ingredient.quantity })),
    })),
    activeCycle: { id: cycle.id, startsAt: new Date(cycle.starts_at).toISOString(), endsAt: new Date(cycle.ends_at).toISOString(), status: cycle.status, timeZone: 'Asia/Seoul', publishedAt: new Date(cycle.published_at).toISOString(), ...source(cycle) },
    prices: rows.cooking_prices.map((price) => ({ dishItemId: price.dish_item_id, basePrice: price.base_price, sourceNote: price.source_note, ...source(price) })),
    skills: rows.skills.map((skill) => ({
      id: skill.id, slug: skill.slug, name: skill.name, appliesTo: skill.applies_to, maxLevel: skill.max_level, ...source(skill),
      levels: rows.skill_levels.filter((level) => level.skill_id === skill.id).map((level) => ({
        level: level.level, rulesVersion: level.rules_version, ...source(level),
        effect: { type: level.effect_type, value: level.effect_value, order: level.effect_order,
          ...(level.minimum_quantity === null ? {} : { minimumQuantity: level.minimum_quantity }),
          rounding: level.rounding, verified: level.verified },
      })),
    })),
    dataVersion: 'pending',
  })
  catalog.dataVersion = `catalog-v1:${createHash('sha256').update(JSON.stringify(catalog)).digest('hex')}`
  return catalog
}
