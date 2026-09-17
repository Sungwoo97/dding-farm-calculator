import { describe, expect, it } from 'vitest'
import { calculatePurchaseCost } from './procurement'

describe('calculatePurchaseCost', () => {
  const expectFiniteNumbers = (result: ReturnType<typeof calculatePurchaseCost>) => {
    for (const value of [
      result.requiredQuantity,
      result.purchaseQuantity,
      result.consumedCost,
      result.cashOutlay,
      result.leftoverQuantity,
    ]) expect(Number.isFinite(value)).toBe(true)
    if (result.unitPrice !== null) expect(Number.isFinite(result.unitPrice)).toBe(true)
  }

  it('직접 수확은 구매비용이 없다', () => {
    expect(calculatePurchaseCost(30, {
      itemId: 'onion', sourceMode: 'SELF', ownedQuantity: 0,
    })).toMatchObject({ purchaseQuantity: 0, consumedCost: 0, cashOutlay: 0 })
  })

  it('64개 1200G 묶음에서 10개 사용 원가와 잔량을 계산한다', () => {
    expect(calculatePurchaseCost(10, {
      itemId: 'tomato', sourceMode: 'PURCHASE', ownedQuantity: 0,
      purchasePackQuantity: 64, purchasePackPrice: 1200,
    })).toMatchObject({ purchaseQuantity: 10, consumedCost: 187.5, cashOutlay: 1200, leftoverQuantity: 54 })
  })

  it('혼합 조달은 보유량을 제외한 부족분만 구매한다', () => {
    expect(calculatePurchaseCost(30, {
      itemId: 'garlic', sourceMode: 'MIXED', ownedQuantity: 18,
      purchasePackQuantity: 32, purchasePackPrice: 1000,
    })).toMatchObject({ purchaseQuantity: 12, consumedCost: 375, cashOutlay: 1000, leftoverQuantity: 20 })
  })

  it('구매 묶음 값이 유효하지 않으면 오류를 반환한다', () => {
    expect(calculatePurchaseCost(1, {
      itemId: 'oil', sourceMode: 'PURCHASE', ownedQuantity: 0,
      purchasePackQuantity: 0, purchasePackPrice: 10,
    }).errors).toContain('구매 묶음 수량은 0보다 커야 합니다.')
  })

  it('계산 결과가 숫자 범위를 넘으면 오류와 유한한 숫자를 반환한다', () => {
    const result = calculatePurchaseCost(Number.MAX_VALUE, {
      itemId: 'rare', sourceMode: 'PURCHASE', ownedQuantity: 0,
      purchasePackQuantity: Number.MIN_VALUE, purchasePackPrice: 1,
    })

    expect(result.errors.length).toBeGreaterThan(0)
    expectFiniteNumbers(result)
  })

  it('가격 누락이나 비유한 입력은 오류와 유한한 숫자를 반환한다', () => {
    const missingPrice = calculatePurchaseCost(1, {
      itemId: 'oil', sourceMode: 'PURCHASE', ownedQuantity: 0,
      purchasePackQuantity: 1,
    })
    const invalidInput = calculatePurchaseCost(Number.NaN, {
      itemId: 'salt', sourceMode: 'MIXED', ownedQuantity: Number.POSITIVE_INFINITY,
      purchasePackQuantity: 1, purchasePackPrice: 1,
    })

    expect(missingPrice.errors.length).toBeGreaterThan(0)
    expect(invalidInput.errors.length).toBeGreaterThan(0)
    expectFiniteNumbers(missingPrice)
    expectFiniteNumbers(invalidInput)
  })
})
