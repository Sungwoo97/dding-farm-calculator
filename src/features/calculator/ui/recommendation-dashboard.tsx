'use client'

import { useMemo, useState } from 'react'

import type { CalculationScenario } from '@/features/calculator/domain/types'
import type { PublishedCatalog } from '@/features/catalog/types'
import { useUserSettings } from '@/features/user-settings/use-user-settings'

import { useRecommendations } from '../use-recommendations'
import { CycleBanner } from './cycle-banner'
import { calculationErrorText } from './presentation'
import { RankingTable } from './ranking-table'
import { ScenarioTabs } from './scenario-tabs'
import styles from './recommendation-dashboard.module.css'

export function RecommendationDashboard({
  catalog,
  now,
}: {
  catalog: PublishedCatalog
  now?: string
}) {
  const { settings, ready, saveError } = useUserSettings()
  const [scenario, setScenario] = useState<CalculationScenario>('ALL_PURCHASE')
  const recommendations = useRecommendations(catalog, settings)
  const itemsById = useMemo(
    () => new Map(catalog.items.map((item) => [item.id, item])),
    [catalog],
  )

  if (!ready) {
    return (
      <section className={styles.dashboard}>
        <h1>오늘의 추천</h1>
        <p role="status">저장된 설정을 불러와 추천을 계산하는 중입니다.</p>
      </section>
    )
  }

  const current = scenario === 'ALL_PURCHASE' ? recommendations.allPurchase : recommendations.actual

  return (
    <section className={styles.dashboard}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>오늘 무엇을 만들까요?</p>
          <h1>오늘의 추천</h1>
          <p>현재 가격과 내 조달 설정으로 요리별 수익을 비교합니다.</p>
        </div>
        <CycleBanner cycle={catalog.activeCycle} now={now} />
      </header>

      {saveError ? <p role="alert">설정을 불러오지 못했습니다: {saveError}</p> : null}
      <ScenarioTabs value={scenario} onChange={setScenario} />

      <section id="recommendation-results" className={styles.results} aria-live="polite">
        <div className={styles.resultsHeading}>
          <div>
            <h2>{scenario === 'ALL_PURCHASE' ? '구매 효율 순위' : '실제 순이익 순위'}</h2>
            <p>{scenario === 'ALL_PURCHASE' ? '구매 ROI가 높은 순서입니다.' : '내 재료 조달을 반영한 순이익 순서입니다.'}</p>
          </div>
          <time dateTime={current.lastCalculatedAt}>방금 계산</time>
        </div>
        <RankingTable recommendation={current} itemsById={itemsById} />
      </section>

      {current.unavailable.length > 0 ? (
        <section className={styles.unavailable} aria-label="계산 불가 요리">
          <h2>계산에 필요한 정보</h2>
          <p>아래 요리는 누락된 정보를 채우면 순위에 포함됩니다.</p>
          <ul>
            {current.unavailable.map((calculation) => (
              <li key={calculation.dishId}>
                <strong>{itemsById.get(calculation.dishId)?.name ?? calculation.dishId}</strong>
                <ul>
                  {calculation.errors.map((error) => (
                    <li key={error}>{calculationErrorText(error, itemsById)}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  )
}
