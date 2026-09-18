import type { PublishedCatalog } from '@/features/catalog/types'

export const numberFormat = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 })

export function formatGold(value: number | null): string {
  return value === null ? '계산 불가' : `${numberFormat.format(value)} G`
}

export function formatRoi(value: number | null, purchaseCost: number | null): string {
  if (purchaseCost === 0) return '구매비용 없음'
  return value === null ? '계산 불가' : `${numberFormat.format(value)}%`
}

export function calculationErrorText(
  error: string,
  itemsById: Map<string, PublishedCatalog['items'][number]>,
): string {
  const [code, detail] = error.split(':', 2)
  const itemName = detail ? (itemsById.get(detail)?.name ?? detail) : ''
  switch (code) {
    case 'MISSING_PRICE': return `${itemName} 가격 입력 필요`
    case 'MISSING_SALE_PRICE': return '판매 가격을 찾을 수 없습니다.'
    case 'MISSING_DISH_RECIPE': return '등록된 레시피를 찾을 수 없습니다.'
    case 'INVALID_DISH': return '요리 정보를 찾을 수 없습니다.'
    case 'INVALID_CRAFT_QUANTITY': return '제작 수량이 올바르지 않습니다.'
    case 'UNVERIFIED_SKILL_EFFECT': return '검증되지 않은 스킬 효과가 포함되어 있습니다.'
    case 'INVALID_SKILL_EFFECT': return '스킬 효과 설정이 올바르지 않습니다.'
    case 'RECIPE_CYCLE': return '레시피가 순환하여 계산할 수 없습니다.'
    case 'INVALID_RECIPE':
    case 'INVALID_RECIPE_OUTPUT': return '레시피 정보가 올바르지 않습니다.'
    case 'CALCULATION_OVERFLOW': return '계산 결과가 표현 가능한 범위를 초과했습니다.'
    default: return error
  }
}
