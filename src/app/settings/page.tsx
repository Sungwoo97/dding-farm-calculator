import { getPublishedCatalog } from '@/features/catalog/server/repository'
import { SettingsForm } from '@/features/user-settings/ui/settings-form'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const catalog = await getPublishedCatalog(new Date())

  return (
    <section>
      <h1>내 설정</h1>
      <p>카탈로그에서 검증된 스킬과 레벨을 선택하세요.</p>
      <SettingsForm skills={catalog.skills} />
    </section>
  )
}
