import Decimal from 'decimal.js'
import type { MaterialSetting, PurchaseCostResult } from './types'

export function calculatePurchaseCost(
  requiredQuantity: number,
  setting: MaterialSetting,
): PurchaseCostResult {
  const required = finiteNumber(requiredQuantity) && requiredQuantity >= 0 ? requiredQuantity : 0
  const requiredErrors = finiteNumber(requiredQuantity)
    ? requiredQuantity < 0 ? ['필요 수량은 0 이상이어야 합니다.'] : []
    : ['필요 수량은 유효한 숫자여야 합니다.']

  if (setting.sourceMode === 'SELF') return zeroPurchase(required, requiredErrors)

  const ownedValid = finiteNumber(setting.ownedQuantity) && setting.ownedQuantity >= 0
  const ownedQuantity = ownedValid ? setting.ownedQuantity : 0
  const purchaseQuantity = setting.sourceMode === 'MIXED'
    ? Math.max(0, required - ownedQuantity)
    : required
  const validation = [...requiredErrors, ...validatePack(setting)]
  if (!ownedValid) validation.push(finiteNumber(setting.ownedQuantity)
    ? '보유 수량은 0 이상이어야 합니다.'
    : '보유 수량은 유효한 숫자여야 합니다.')
  if (validation.length > 0) return invalidPurchase(required, purchaseQuantity, validation)

  const packQuantity = new Decimal(setting.purchasePackQuantity!)
  const packPrice = new Decimal(setting.purchasePackPrice!)
  const unitPrice = packPrice.div(packQuantity)
  const packsToBuy = new Decimal(purchaseQuantity).div(packQuantity).ceil()

  return {
    requiredQuantity: required,
    purchaseQuantity,
    unitPrice: unitPrice.toNumber(),
    consumedCost: unitPrice.mul(purchaseQuantity).toNumber(),
    cashOutlay: packsToBuy.mul(packPrice).toNumber(),
    leftoverQuantity: packsToBuy.mul(packQuantity).minus(purchaseQuantity).toNumber(),
    errors: [],
  }
}

function finiteNumber(value: number): boolean {
  return typeof value === 'number' && Number.isFinite(value)
}

function validatePack(setting: MaterialSetting): string[] {
  const errors: string[] = []
  const quantity = setting.purchasePackQuantity
  const price = setting.purchasePackPrice
  if (typeof quantity !== 'number' || !Number.isFinite(quantity)) errors.push('구매 묶음 수량은 유효한 숫자여야 합니다.')
  else if (quantity <= 0) errors.push('구매 묶음 수량은 0보다 커야 합니다.')
  if (typeof price !== 'number' || !Number.isFinite(price)) errors.push('구매 묶음 가격은 유효한 숫자여야 합니다.')
  else if (price < 0) errors.push('구매 묶음 가격은 0 이상이어야 합니다.')
  return errors
}

function zeroPurchase(requiredQuantity: number, errors: string[] = []): PurchaseCostResult {
  return {
    requiredQuantity,
    purchaseQuantity: 0,
    consumedCost: 0,
    cashOutlay: 0,
    leftoverQuantity: 0,
    unitPrice: null,
    errors,
  }
}

function invalidPurchase(
  requiredQuantity: number,
  purchaseQuantity: number,
  errors: string[],
): PurchaseCostResult {
  return {
    requiredQuantity,
    purchaseQuantity,
    consumedCost: 0,
    cashOutlay: 0,
    leftoverQuantity: 0,
    unitPrice: null,
    errors,
  }
}
