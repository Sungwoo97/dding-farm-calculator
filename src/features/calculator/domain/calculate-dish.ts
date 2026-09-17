import Decimal from 'decimal.js'
import { calculatePurchaseCost } from './procurement'
import { expandRecipe, RecipeCycleError } from './recipe-tree'
import { applySalePriceRules } from './sale-price'
import type {
  CalculationScenario,
  Catalog,
  DishCalculation,
  MaterialSetting,
  SkillProfile,
} from './types'

export interface CalculateDishInput {
  dishId: string
  scenario: CalculationScenario
  craftQuantity: number
  basePrice: number | null
  catalog: Catalog
  settings: Map<string, MaterialSetting>
  skillProfile: SkillProfile
}

export function calculateDish(input: CalculateDishInput): DishCalculation {
  const errors = validateInput(input)
  const saleRevenue = calculateSaleRevenue(input, errors)
  const expanded = expandIngredients(input, errors)
  const procurement = expanded
    ? calculateProcurement(expanded.leaves, scenarioSettings(input), errors)
    : { consumedPurchaseCost: null, cashOutlay: null, selfSupplied: [], leftovers: [] }

  let netProfit: number | null = null
  let purchaseRoi: number | null = null
  if (
    errors.length === 0
    && saleRevenue !== null
    && procurement.consumedPurchaseCost !== null
    && procurement.cashOutlay !== null
  ) {
    netProfit = new Decimal(saleRevenue).minus(procurement.consumedPurchaseCost).toNumber()
    purchaseRoi = procurement.consumedPurchaseCost === 0
      ? null
      : new Decimal(netProfit).div(procurement.consumedPurchaseCost).mul(100).toNumber()
  }

  if (netProfit !== null && !Number.isFinite(netProfit)) errors.push('CALCULATION_OVERFLOW')
  if (purchaseRoi !== null && !Number.isFinite(purchaseRoi)) errors.push('CALCULATION_OVERFLOW')

  return {
    dishId: input.dishId,
    scenario: input.scenario,
    craftQuantity: input.craftQuantity,
    saleRevenue,
    consumedPurchaseCost: errors.length === 0 ? procurement.consumedPurchaseCost : null,
    cashOutlay: errors.length === 0 ? procurement.cashOutlay : null,
    netProfit: errors.length === 0 ? netProfit : null,
    purchaseRoi: errors.length === 0 ? purchaseRoi : null,
    selfSupplied: procurement.selfSupplied,
    leftovers: procurement.leftovers,
    errors: unique(errors),
  }
}

function validateInput(input: CalculateDishInput): string[] {
  const errors: string[] = []
  if (!Number.isFinite(input.craftQuantity) || input.craftQuantity <= 0) errors.push(`INVALID_CRAFT_QUANTITY:${input.dishId}`)
  if (input.basePrice === null || !Number.isFinite(input.basePrice) || input.basePrice < 0) errors.push(`MISSING_SALE_PRICE:${input.dishId}`)
  const dish = input.catalog.items.find((item) => item.id === input.dishId)
  if (!dish || dish.category !== 'DISH') errors.push(`INVALID_DISH:${input.dishId}`)
  else if (!input.catalog.recipes.some((recipe) => recipe.outputItemId === input.dishId)) {
    errors.push(`MISSING_DISH_RECIPE:${input.dishId}`)
  }
  for (const effect of input.skillProfile.effects) {
    if (effect.verified === false) errors.push(`UNVERIFIED_SKILL_EFFECT:${effect.type}`)
    if (!Number.isFinite(effect.value) || !Number.isFinite(effect.order)) errors.push(`INVALID_SKILL_EFFECT:${effect.type}`)
    if (effect.minimumQuantity !== undefined && !Number.isFinite(effect.minimumQuantity)) {
      errors.push(`INVALID_SKILL_EFFECT:${effect.type}`)
    }
  }
  return errors
}

function calculateSaleRevenue(input: CalculateDishInput, errors: string[]): number | null {
  if (errors.some((error) => error.startsWith('MISSING_SALE_PRICE') || error.includes('SKILL_EFFECT'))) return null

  const expectedSaleQuantity = input.skillProfile.effects
    .filter((effect) => effect.type === 'EXPECTED_EXTRA_OUTPUT')
    .filter((effect) => input.craftQuantity >= (effect.minimumQuantity ?? 0))
    .reduce((quantity, effect) => quantity.mul(new Decimal(1).plus(effect.value)), new Decimal(input.craftQuantity))
  const revenue = applySalePriceRules(input.basePrice!, expectedSaleQuantity.toNumber(), input.skillProfile.effects)

  if (!Number.isFinite(revenue)) {
    errors.push('CALCULATION_OVERFLOW')
    return null
  }
  return revenue
}

function expandIngredients(input: CalculateDishInput, errors: string[]) {
  if (errors.some((error) => error.startsWith('INVALID_CRAFT_QUANTITY') || error.startsWith('INVALID_DISH') || error.startsWith('MISSING_DISH_RECIPE'))) return null
  try {
    const expanded = expandRecipe(input.dishId, input.craftQuantity, input.catalog, scenarioSettings(input))
    errors.push(...expanded.errors)
    return expanded
  } catch (error) {
    if (error instanceof RecipeCycleError) {
      errors.push(`RECIPE_CYCLE:${error.path.join('->')}`)
      return null
    }
    throw error
  }
}

function scenarioSettings(input: CalculateDishInput): Map<string, MaterialSetting> {
  if (input.scenario === 'ACTUAL') return input.settings

  const adjusted = new Map(input.settings)
  for (const item of input.catalog.items) {
    if (!item.tradeable) continue
    const setting = adjusted.get(item.id)
    adjusted.set(item.id, setting
      ? { ...setting, sourceMode: 'PURCHASE', ownedQuantity: 0 }
      : { itemId: item.id, sourceMode: 'PURCHASE', ownedQuantity: 0 })
  }
  return adjusted
}

function calculateProcurement(
  leaves: Array<{ itemId: string; quantity: number }>,
  settings: Map<string, MaterialSetting>,
  errors: string[],
): Pick<DishCalculation, 'consumedPurchaseCost' | 'cashOutlay' | 'selfSupplied' | 'leftovers'> {
  let consumedPurchaseCost = new Decimal(0)
  let cashOutlay = new Decimal(0)
  const selfSupplied: Array<{ itemId: string; quantity: number }> = []
  const leftovers: Array<{ itemId: string; quantity: number }> = []

  for (const leaf of leaves) {
    const setting = settings.get(leaf.itemId)
    if (!setting) {
      errors.push(`MISSING_PRICE:${leaf.itemId}`)
      continue
    }
    const purchase = calculatePurchaseCost(leaf.quantity, setting)
    if (purchase.errors.length > 0) {
      errors.push(`MISSING_PRICE:${leaf.itemId}`)
      continue
    }
    consumedPurchaseCost = consumedPurchaseCost.plus(purchase.consumedCost)
    cashOutlay = cashOutlay.plus(purchase.cashOutlay)
    const suppliedQuantity = leaf.quantity - purchase.purchaseQuantity
    if (suppliedQuantity > 0) selfSupplied.push({ itemId: leaf.itemId, quantity: suppliedQuantity })
    if (purchase.leftoverQuantity > 0) leftovers.push({ itemId: leaf.itemId, quantity: purchase.leftoverQuantity })
  }

  const consumed = consumedPurchaseCost.toNumber()
  const outlay = cashOutlay.toNumber()
  if (!Number.isFinite(consumed) || !Number.isFinite(outlay)) {
    errors.push('CALCULATION_OVERFLOW')
    return { consumedPurchaseCost: null, cashOutlay: null, selfSupplied, leftovers }
  }
  return { consumedPurchaseCost: consumed, cashOutlay: outlay, selfSupplied, leftovers }
}

function unique(errors: string[]): string[] {
  return [...new Set(errors)]
}
