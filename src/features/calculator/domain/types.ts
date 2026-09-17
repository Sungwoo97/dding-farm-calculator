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
