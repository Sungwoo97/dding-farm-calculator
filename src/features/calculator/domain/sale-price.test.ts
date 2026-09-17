import { describe, expect, it } from 'vitest'
import { applySalePriceRules } from './sale-price'

describe('applySalePriceRules', () => {
  it('applies a 15 percent sell-price multiplier to one item', () => {
    expect(applySalePriceRules(1_000, 1, [{
      type: 'SELL_PRICE_MULTIPLIER',
      value: 0.15,
      order: 1,
      rounding: 'NONE',
    }])).toBe(1_150)
  })

  it('does not apply a bulk multiplier below its minimum quantity', () => {
    expect(applySalePriceRules(1_000, 2, [{
      type: 'BULK_SALE_MULTIPLIER',
      value: 0.03,
      order: 1,
      minimumQuantity: 3,
      rounding: 'NONE',
    }])).toBe(2_000)
  })

  it('applies active effects by configured order and rounds after each effect', () => {
    expect(applySalePriceRules(101, 3, [
      {
        type: 'BULK_SALE_MULTIPLIER',
        value: 0.03,
        order: 2,
        minimumQuantity: 3,
        rounding: 'CEIL',
      },
      {
        type: 'SELL_PRICE_MULTIPLIER',
        value: 0.1,
        order: 1,
        rounding: 'FLOOR',
      },
    ])).toBe(345)
  })
})
