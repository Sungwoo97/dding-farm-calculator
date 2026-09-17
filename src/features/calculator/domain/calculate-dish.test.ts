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
})
