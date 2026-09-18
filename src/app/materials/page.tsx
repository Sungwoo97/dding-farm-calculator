import { getPublishedCatalog } from '@/features/catalog/server/repository'
import { MaterialsForm } from '@/features/user-settings/ui/materials-form'

export const dynamic = 'force-dynamic'

export default async function MaterialsPage() {
  const catalog = await getPublishedCatalog(new Date())
  const materials = catalog.items.filter((item) => item.tradeable && item.category !== 'DISH')

  return (
    <section>
      <h1>재료 가격</h1>
      <p>재료를 마련하는 방법과 상점의 묶음 가격을 입력하세요. 개당 가격은 자동으로 계산됩니다.</p>
      <MaterialsForm items={materials} />
    </section>
  )
}
