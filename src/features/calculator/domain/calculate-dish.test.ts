import { describe, expect, it } from 'vitest'
import { calculateDish } from './calculate-dish'
import type { Catalog, MaterialSetting } from './types'

const catalog: Catalog = {
  items: [
    { id: 'dish', slug: 'dish', name: 'Dish', category: 'DISH', tradeable: true },
    { id: 'tomato', slug: 'tomato', name: 'Tomato', category: 'RAW', tradeable: true },
  ],
  recipes: [{
    id: 'dish-recipe',
    outputItemId: 'dish',
    outputQuantity: 1,
    ingredients: [{ itemId: 'tomato', quantity: 2 }],
  }],
}

function settings(...entries: MaterialSetting[]): Map<string, MaterialSetting> {
  return new Map(entries.map((entry) => [entry.itemId, entry]))
}

const purchasedTomatoes: MaterialSetting = {
  itemId: 'tomato',
  sourceMode: 'PURCHASE',
  ownedQuantity: 0,
  purchasePackQuantity: 1,
  purchasePackPrice: 100,
}

describe('calculateDish', () => {
  it('uses expected extra output only for fractional sale quantity, not ingredient demand', () => {
    const result = calculateDish({
      dishId: 'dish',
      scenario: 'ACTUAL',
      craftQuantity: 1,
      basePrice: 1_000,
      catalog,
      settings: settings(purchasedTomatoes),
      skillProfile: {
        effects: [{
          type: 'EXPECTED_EXTRA_OUTPUT',
          value: 0.25,
          order: 1,
          rounding: 'NONE',
        }],
      },
    })

    expect(result.saleRevenue).toBe(1_250)
    expect(result.consumedPurchaseCost).toBe(200)
    expect(result.cashOutlay).toBe(200)
    expect(result.selfSupplied).toEqual([])
    expect(result.errors).toEqual([])
  })

  it('does not apply expected extra output below its craft-quantity threshold', () => {
    const result = calculateDish({
      dishId: 'dish',
      scenario: 'ACTUAL',
      craftQuantity: 2,
      basePrice: 1_000,
      catalog,
      settings: settings(purchasedTomatoes),
      skillProfile: {
        effects: [{
          type: 'EXPECTED_EXTRA_OUTPUT',
          value: 0.25,
          order: 1,
          minimumQuantity: 3,
          rounding: 'NONE',
        }],
      },
    })

    expect(result.saleRevenue).toBe(2_000)
    expect(result.consumedPurchaseCost).toBe(400)
    expect(result.errors).toEqual([])
  })

  it('returns null ROI rather than Infinity when ingredients have no purchase cost', () => {
    const result = calculateDish({
      dishId: 'dish',
      scenario: 'ACTUAL',
      craftQuantity: 1,
      basePrice: 1_000,
      catalog,
      settings: settings({ itemId: 'tomato', sourceMode: 'SELF', ownedQuantity: 2 }),
      skillProfile: { effects: [] },
    })

    expect(result.consumedPurchaseCost).toBe(0)
    expect(result.netProfit).toBe(1_000)
    expect(result.purchaseRoi).toBeNull()
  })

  it('keeps revenue but makes profit unavailable when an ingredient price is missing', () => {
    const result = calculateDish({
      dishId: 'dish',
      scenario: 'ACTUAL',
      craftQuantity: 1,
      basePrice: 1_000,
      catalog,
      settings: settings(),
      skillProfile: { effects: [] },
    })

    expect(result.saleRevenue).toBe(1_000)
    expect(result.consumedPurchaseCost).toBeNull()
    expect(result.netProfit).toBeNull()
    expect(result.errors).toContain('MISSING_PRICE:tomato')
  })

  it('reports an explicitly unverified skill effect as unavailable', () => {
    const result = calculateDish({
      dishId: 'dish',
      scenario: 'ACTUAL',
      craftQuantity: 1,
      basePrice: 1_000,
      catalog,
      settings: settings(purchasedTomatoes),
      skillProfile: {
        effects: [{
          type: 'SELL_PRICE_MULTIPLIER',
          value: 0.15,
          order: 1,
          rounding: 'NONE',
          verified: false,
        }],
      },
    })

    expect(result.saleRevenue).toBeNull()
    expect(result.netProfit).toBeNull()
    expect(result.errors).toContain('UNVERIFIED_SKILL_EFFECT:SELL_PRICE_MULTIPLIER')
  })

  it('normalizes a BUY intermediate to purchase in the all-purchase scenario', () => {
    const result = calculateDish({
      dishId: 'dish',
      scenario: 'ALL_PURCHASE',
      craftQuantity: 1,
      basePrice: 1_000,
      catalog: intermediateCatalog(),
      settings: settings({
        itemId: 'sauce',
        sourceMode: 'SELF',
        intermediateMode: 'BUY',
        ownedQuantity: 1,
        purchasePackQuantity: 1,
        purchasePackPrice: 100,
      }),
      skillProfile: { effects: [] },
    })

    expect(result.consumedPurchaseCost).toBe(100)
    expect(result.cashOutlay).toBe(100)
    expect(result.errors).toEqual([])
  })

  it('prices both CHEAPEST intermediate alternatives in the all-purchase scenario', () => {
    const result = calculateDish({
      dishId: 'dish',
      scenario: 'ALL_PURCHASE',
      craftQuantity: 1,
      basePrice: 1_000,
      catalog: intermediateCatalog(),
      settings: settings(
        {
          itemId: 'sauce',
          sourceMode: 'SELF',
          intermediateMode: 'CHEAPEST',
          ownedQuantity: 1,
          purchasePackQuantity: 1,
          purchasePackPrice: 100,
        },
        {
          itemId: 'tomato',
          sourceMode: 'SELF',
          ownedQuantity: 2,
          purchasePackQuantity: 1,
          purchasePackPrice: 10,
        },
      ),
      skillProfile: { effects: [] },
    })

    expect(result.consumedPurchaseCost).toBe(20)
    expect(result.cashOutlay).toBe(20)
    expect(result.errors).toEqual([])
  })

  it('marks a requested dish without a recipe as unavailable', () => {
    const result = calculateDish({
      dishId: 'unmade-dish',
      scenario: 'ACTUAL',
      craftQuantity: 1,
      basePrice: 1_000,
      catalog: {
        items: [{ id: 'unmade-dish', slug: 'unmade-dish', name: 'Unmade dish', category: 'DISH', tradeable: true }],
        recipes: [],
      },
      settings: settings({
        itemId: 'unmade-dish',
        sourceMode: 'PURCHASE',
        ownedQuantity: 0,
        purchasePackQuantity: 1,
        purchasePackPrice: 100,
      }),
      skillProfile: { effects: [] },
    })

    expect(result.netProfit).toBeNull()
    expect(result.errors).toContain('MISSING_DISH_RECIPE:unmade-dish')
  })
})

function intermediateCatalog(): Catalog {
  return {
    items: [
      { id: 'dish', slug: 'dish', name: 'Dish', category: 'DISH', tradeable: true },
      { id: 'sauce', slug: 'sauce', name: 'Sauce', category: 'PROCESSED', tradeable: true },
      { id: 'tomato', slug: 'tomato', name: 'Tomato', category: 'RAW', tradeable: true },
    ],
    recipes: [
      { id: 'dish-recipe', outputItemId: 'dish', outputQuantity: 1, ingredients: [{ itemId: 'sauce', quantity: 1 }] },
      { id: 'sauce-recipe', outputItemId: 'sauce', outputQuantity: 1, ingredients: [{ itemId: 'tomato', quantity: 2 }] },
    ],
  }
}
