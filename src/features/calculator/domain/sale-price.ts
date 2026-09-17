import Decimal from 'decimal.js'
import type { SkillEffect, SkillRounding } from './types'

export function applySalePriceRules(
  basePrice: number,
  quantity: number,
  effects: SkillEffect[],
): number {
  const unitPrice = effects
    .filter((effect) => effect.type !== 'EXPECTED_EXTRA_OUTPUT')
    .filter((effect) => effect.verified !== false)
    .filter((effect) => quantity >= (effect.minimumQuantity ?? 0))
    .toSorted((left, right) => left.order - right.order)
    .reduce(
      (price, effect) => roundDecimal(price.mul(new Decimal(1).plus(effect.value)), effect.rounding),
      new Decimal(basePrice),
    )

  return unitPrice.mul(quantity).toNumber()
}

function roundDecimal(value: Decimal, rounding: SkillRounding): Decimal {
  switch (rounding) {
    case 'FLOOR': return value.floor()
    case 'ROUND': return value.toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    case 'CEIL': return value.ceil()
    case 'NONE': return value
  }
}
