'use client'

import type { Item } from '@/features/calculator/domain/types'
import { useUserSettings } from '@/features/user-settings/use-user-settings'

import { MaterialPriceTable } from './material-price-table'

export function MaterialsForm({ items }: { items: Item[] }) {
  const { settings, ready, saveError, updateMaterial } = useUserSettings()

  if (!ready) return <p role="status">저장된 재료 설정을 불러오는 중입니다.</p>

  return (
    <>
      {saveError ? <p role="alert">설정을 저장하지 못했습니다: {saveError}</p> : null}
      <MaterialPriceTable
        items={items}
        settings={settings.materials}
        onChange={(setting) => void updateMaterial(setting)}
      />
    </>
  )
}
