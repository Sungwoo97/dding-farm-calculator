import { describe, expect, it } from 'vitest'
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
})
