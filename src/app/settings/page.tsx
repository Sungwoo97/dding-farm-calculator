import { getFixtureCatalog } from '@/features/catalog/server/fixture-catalog'
import { SettingsForm } from '@/features/user-settings/ui/settings-form'

const fixtureTime = new Date('2026-09-17T00:00:00+09:00')

export default function SettingsPage() {
  const catalog = getFixtureCatalog(fixtureTime)

  return (
    <section>
      <h1>내 설정</h1>
      <p>카탈로그에서 검증된 스킬과 레벨을 선택하세요.</p>
      <SettingsForm skills={catalog.skills} />
    </section>
  )
}
