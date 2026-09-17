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
