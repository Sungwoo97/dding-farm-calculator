import type { Item, MaterialSetting } from '@/features/calculator/domain/types'

import { MaterialPriceCard } from './material-price-card'
import styles from './material-price-table.module.css'

export interface MaterialPriceTableProps {
  items: Item[]
  settings: Map<string, MaterialSetting>
  onChange(setting: MaterialSetting): void
}

function defaultSetting(itemId: string): MaterialSetting {
  return { itemId, sourceMode: 'SELF', ownedQuantity: 0 }
}

export function MaterialPriceTable({ items, settings, onChange }: MaterialPriceTableProps) {
  return (
    <div className={styles.tableRegion}>
      <table className={styles.table}>
        <caption>재료별 조달 방식과 구매 가격</caption>
        <thead>
          <tr>
            <th scope="col">재료</th>
            <th scope="col">조달 방식</th>
            <th scope="col">보유 수량</th>
            <th scope="col">구매 묶음 수량</th>
            <th scope="col">구매 묶음 가격</th>
            <th scope="col">개당 가격</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <MaterialPriceCard
              key={item.id}
              item={item}
              setting={settings.get(item.id) ?? defaultSetting(item.id)}
              onChange={onChange}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
