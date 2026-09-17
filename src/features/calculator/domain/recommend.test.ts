import { describe, expect, it } from 'vitest'
import { calculateDish } from './calculate-dish'
import { rankDishes } from './recommend'
import type { DishCalculation } from './types'

function calculation(dishId: string, overrides: Partial<DishCalculation> = {}): DishCalculation {
  return {
    dishId,
    scenario: 'ACTUAL',
    craftQuantity: 1,
    saleRevenue: 200,
    consumedPurchaseCost: 100,
    cashOutlay: 100,
    netProfit: 100,
    purchaseRoi: 100,
    selfSupplied: [],
    leftovers: [],
    errors: [],
    ...overrides,
  }
}

describe('rankDishes', () => {
  it('excludes errored calculations and breaks equal values by Korean dish name', () => {
    const ranked = rankDishes([
      calculation('zucchini'),
      calculation('bad', { errors: ['MISSING_PRICE:tomato'], netProfit: null }),
      calculation('apple'),
    ], 'NET_PROFIT', (itemId) => ({
      apple: '가나다 죽',
      bad: '나쁜 요리',
      zucchini: '하늘 볶음',
    })[itemId] ?? itemId)

    expect(ranked.map((result) => result.dishId)).toEqual(['apple', 'zucchini'])
  })

  it('excludes a requested dish with no recipe from ranking', () => {
    const unmadeDish = calculateDish({
      dishId: 'unmade-dish',
      scenario: 'ACTUAL',
      craftQuantity: 1,
      basePrice: 1_000,
      catalog: {
        items: [{ id: 'unmade-dish', slug: 'unmade-dish', name: 'Unmade dish', category: 'DISH', tradeable: true }],
        recipes: [],
      },
      settings: new Map([['unmade-dish', {
        itemId: 'unmade-dish',
        sourceMode: 'PURCHASE' as const,
        ownedQuantity: 0,
        purchasePackQuantity: 1,
        purchasePackPrice: 100,
      }]]),
      skillProfile: { effects: [] },
    })

    expect(rankDishes([unmadeDish], 'NET_PROFIT', (itemId) => itemId)).toEqual([])
  })
})
