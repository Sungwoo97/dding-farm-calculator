import type { DishCalculation } from './types'

export function rankDishes(
  calculations: DishCalculation[],
  sort: 'ROI' | 'NET_PROFIT' | 'NAME',
  itemName: (itemId: string) => string,
): DishCalculation[] {
  return calculations
    .filter((result) => result.errors.length === 0 && result.netProfit !== null)
    .toSorted((left, right) => compareDishResult(left, right, sort, itemName))
}

function compareDishResult(
  left: DishCalculation,
  right: DishCalculation,
  sort: 'ROI' | 'NET_PROFIT' | 'NAME',
  itemName: (itemId: string) => string,
): number {
  if (sort === 'ROI') {
    const roiOrder = compareNullableDescending(left.purchaseRoi, right.purchaseRoi)
    if (roiOrder !== 0) return roiOrder
  }
  if (sort === 'NET_PROFIT') {
    const profitOrder = right.netProfit! - left.netProfit!
    if (profitOrder !== 0) return profitOrder
  }
  return itemName(left.dishId).localeCompare(itemName(right.dishId), 'ko')
}

function compareNullableDescending(left: number | null, right: number | null): number {
  if (left === null) return right === null ? 0 : 1
  if (right === null) return -1
  return right - left
}
