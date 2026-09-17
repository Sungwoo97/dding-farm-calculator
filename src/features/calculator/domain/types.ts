export type SourceMode = 'SELF' | 'PURCHASE' | 'MIXED'
export type IntermediateMode = 'MAKE' | 'BUY' | 'CHEAPEST'

export interface MaterialSetting {
  itemId: string
  sourceMode: SourceMode
  intermediateMode?: IntermediateMode
  ownedQuantity: number
  purchasePackQuantity?: number
  purchasePackPrice?: number
  observedAt?: string
}

export interface PurchaseCostResult {
  requiredQuantity: number
  purchaseQuantity: number
  consumedCost: number
  cashOutlay: number
  leftoverQuantity: number
  unitPrice: number | null
  errors: string[]
}

export interface Item {
  id: string
  slug: string
  name: string
  category: 'RAW' | 'PROCESSED' | 'DISH' | 'FIXED_INGREDIENT'
  tradeable: boolean
}

export interface RecipeIngredient {
  itemId: string
  quantity: number
}

export interface Recipe {
  id: string
  outputItemId: string
  outputQuantity: number
  ingredients: RecipeIngredient[]
}

export interface Catalog {
  items: Item[]
  recipes: Recipe[]
}

export type SkillEffectType =
  | 'SELL_PRICE_MULTIPLIER'
  | 'BULK_SALE_MULTIPLIER'
  | 'EXPECTED_EXTRA_OUTPUT'

export type SkillRounding = 'FLOOR' | 'ROUND' | 'CEIL' | 'NONE'

export interface SkillEffect {
  type: SkillEffectType
  value: number
  order: number
  minimumQuantity?: number
  rounding: SkillRounding
  verified?: boolean
}

export interface SkillProfile {
  effects: SkillEffect[]
}

export type CalculationScenario = 'ALL_PURCHASE' | 'ACTUAL'

export interface DishCalculation {
  dishId: string
  scenario: CalculationScenario
  craftQuantity: number
  saleRevenue: number | null
  consumedPurchaseCost: number | null
  cashOutlay: number | null
  netProfit: number | null
  purchaseRoi: number | null
  selfSupplied: Array<{ itemId: string; quantity: number }>
  leftovers: Array<{ itemId: string; quantity: number }>
  errors: string[]
}
