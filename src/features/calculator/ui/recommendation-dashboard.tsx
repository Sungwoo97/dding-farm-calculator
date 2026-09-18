'use client'

import { useMemo, useState } from 'react'

import type { CalculationScenario } from '@/features/calculator/domain/types'
import type { PublishedCatalog } from '@/features/catalog/types'
import { useUserSettings } from '@/features/user-settings/use-user-settings'

import {
  defaultRecommendationSorts,
  type RecommendationSort,
  type RecommendationSorts,
  useRecommendations,
} from '../use-recommendations'
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
  const [sorts, setSorts] = useState<RecommendationSorts>(defaultRecommendationSorts)
  const recommendations = useRecommendations(catalog, settings, sorts)
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
  const currentSort = sorts[scenario]
  const sortDescription = {
    ROI: '구매 ROI가 높은 순서입니다.',
    NET_PROFIT: '순이익이 높은 순서입니다.',
    NAME: '요리 이름의 가나다 순서입니다.',
  }[currentSort]

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
            <p>{sortDescription}</p>
          </div>
          <div className={styles.resultControls}>
            <label htmlFor="recommendation-sort">정렬 기준</label>
            <select
              id="recommendation-sort"
              value={currentSort}
              onChange={(event) => {
                const sort = event.target.value as RecommendationSort
                setSorts((currentSorts) => ({ ...currentSorts, [scenario]: sort }))
              }}
            >
              <option value="NET_PROFIT">순이익</option>
              <option value="ROI">구매 ROI</option>
              <option value="NAME">이름</option>
            </select>
            <time dateTime={current.lastCalculatedAt}>방금 계산</time>
          </div>
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
