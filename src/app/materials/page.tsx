import { getFixtureCatalog } from '@/features/catalog/server/fixture-catalog'
import { MaterialsForm } from '@/features/user-settings/ui/materials-form'

const fixtureTime = new Date('2026-09-17T00:00:00+09:00')

export default function MaterialsPage() {
  const catalog = getFixtureCatalog(fixtureTime)
  const materials = catalog.items.filter((item) => item.tradeable && item.category !== 'DISH')

  return (
    <section>
      <h1>재료 가격</h1>
      <p>재료를 마련하는 방법과 상점의 묶음 가격을 입력하세요. 개당 가격은 자동으로 계산됩니다.</p>
      <MaterialsForm items={materials} />
    </section>
  )
}
