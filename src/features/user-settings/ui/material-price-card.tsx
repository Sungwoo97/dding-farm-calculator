import { calculatePurchaseCost } from '@/features/calculator/domain/procurement'
import type { Item, MaterialSetting, SourceMode } from '@/features/calculator/domain/types'

import { FieldError } from '@/components/ui/field-error'

import styles from './material-price-table.module.css'

interface MaterialPriceCardProps {
  item: Item
  setting: MaterialSetting
  onChange(setting: MaterialSetting): void
}

const sourceOptions: ReadonlyArray<{ value: SourceMode; label: string }> = [
  { value: 'SELF', label: '직접 수확' },
  { value: 'PURCHASE', label: '전부 구매' },
  { value: 'MIXED', label: '보유분 사용 후 구매' },
]

function optionalNumber(value: string): number | undefined {
  return value === '' ? undefined : Number(value)
}

function formatUnitPrice(unitPrice: number): string {
  return `${new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(unitPrice)} G/개`
}

function withSourceMode(setting: MaterialSetting, sourceMode: SourceMode): MaterialSetting {
  const nextSetting = { ...setting, sourceMode }
  if (sourceMode === 'SELF') {
    if (
      nextSetting.purchasePackQuantity !== undefined &&
      (!Number.isFinite(nextSetting.purchasePackQuantity) || nextSetting.purchasePackQuantity <= 0)
    ) {
      delete nextSetting.purchasePackQuantity
    }
    if (
      nextSetting.purchasePackPrice !== undefined &&
      (!Number.isFinite(nextSetting.purchasePackPrice) || nextSetting.purchasePackPrice < 0)
    ) {
      delete nextSetting.purchasePackPrice
    }
  }
  return nextSetting
}

export function MaterialPriceCard({ item, setting, onChange }: MaterialPriceCardProps) {
  const purchases = setting.sourceMode !== 'SELF'
  const purchase = purchases ? calculatePurchaseCost(1, setting) : null
  const idPrefix = `material-${item.id}`
  const errorId = `${idPrefix}-error`

  return (
    <tr className={styles.card}>
      <th scope="row" className={styles.itemName}>{item.name}</th>
      <td data-label="조달 방식">
        <label className={styles.srOnly} htmlFor={`${idPrefix}-source`}>{item.name} 조달 방식</label>
        <select
          id={`${idPrefix}-source`}
          value={setting.sourceMode}
          onChange={(event) => onChange(withSourceMode(setting, event.target.value as SourceMode))}
        >
          {sourceOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </td>
      <td data-label="보유 수량">
        {setting.sourceMode === 'MIXED' ? (
          <>
            <label className={styles.srOnly} htmlFor={`${idPrefix}-owned`}>{item.name} 보유 수량</label>
            <input
              id={`${idPrefix}-owned`}
              type="number"
              min="0"
              inputMode="decimal"
              value={setting.ownedQuantity}
              onChange={(event) => onChange({ ...setting, ownedQuantity: Number(event.target.value) })}
            />
          </>
        ) : <span aria-label={`${item.name} 보유 수량 해당 없음`}>—</span>}
      </td>
      <td data-label="구매 묶음 수량">
        {purchases ? (
          <>
            <label className={styles.srOnly} htmlFor={`${idPrefix}-pack-quantity`}>{item.name} 구매 묶음 수량</label>
            <input
              id={`${idPrefix}-pack-quantity`}
              type="number"
              min="0"
              inputMode="decimal"
              aria-describedby={purchase?.errors.length ? errorId : undefined}
              value={setting.purchasePackQuantity ?? ''}
              onChange={(event) => onChange({
                ...setting,
                purchasePackQuantity: optionalNumber(event.target.value),
              })}
            />
          </>
        ) : <span>—</span>}
      </td>
      <td data-label="구매 묶음 가격">
        {purchases ? (
          <>
            <label className={styles.srOnly} htmlFor={`${idPrefix}-pack-price`}>{item.name} 구매 묶음 가격</label>
            <input
              id={`${idPrefix}-pack-price`}
              type="number"
              min="0"
              inputMode="decimal"
              aria-describedby={purchase?.errors.length ? errorId : undefined}
              value={setting.purchasePackPrice ?? ''}
              onChange={(event) => onChange({
                ...setting,
                purchasePackPrice: optionalNumber(event.target.value),
                observedAt: new Date().toISOString(),
              })}
            />
          </>
        ) : <span>—</span>}
      </td>
      <td data-label="개당 가격" className={styles.unitPrice}>
        {purchase?.unitPrice === null || purchase === null ? '—' : formatUnitPrice(purchase.unitPrice)}
        {purchase && purchase.errors.length > 0 ? (
          <FieldError id={errorId}>{purchase.errors.join(' ')}</FieldError>
        ) : null}
      </td>
    </tr>
  )
}
