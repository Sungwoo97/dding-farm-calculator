import Link from 'next/link'

import type { PublishedCatalog } from '@/features/catalog/types'

import type { RecommendationSet } from '../use-recommendations'
import { formatGold, formatRoi, numberFormat, selfSuppliedQuantity } from './presentation'
import { RecommendationCard } from './recommendation-card'
import styles from './recommendation-dashboard.module.css'

export function RankingTable({
  recommendation,
  itemsById,
}: {
  recommendation: RecommendationSet
  itemsById: Map<string, PublishedCatalog['items'][number]>
}) {
  const label = recommendation.scenario === 'ALL_PURCHASE' ? '전부 구매 효율 순위' : '내 실제 조달 순위'

  if (recommendation.ranked.length === 0) {
    return <p className={styles.empty}>가격을 입력하면 추천 순위를 확인할 수 있습니다.</p>
  }

  return (
    <>
      <div className={styles.desktopRanking}>
        <table aria-label={label}>
          <thead>
            <tr>
              <th scope="col">순위</th>
              <th scope="col">요리</th>
              <th scope="col">판매 수익</th>
              <th scope="col">순이익</th>
              <th scope="col">구매 ROI</th>
              <th scope="col">자가 조달</th>
              <th scope="col">소모 원가</th>
              <th scope="col">현금 지출</th>
            </tr>
          </thead>
          <tbody>
            {recommendation.ranked.map((calculation, index) => {
              const dish = itemsById.get(calculation.dishId)!
              return (
                <tr key={calculation.dishId} className={index === 0 ? styles.firstRank : undefined}>
                  <td><span className={styles.rank}>{index + 1}위</span>{index === 0 ? <span className={styles.changeBadge}>추천</span> : null}</td>
                  <th scope="row"><Link href={`/recipes/${dish.slug}?scenario=${calculation.scenario}`}>{dish.name}</Link></th>
                  <td>{formatGold(calculation.saleRevenue)}</td>
                  <td>{formatGold(calculation.netProfit)}</td>
                  <td>{formatRoi(calculation.purchaseRoi, calculation.consumedPurchaseCost)}</td>
                  <td>자가 조달 {numberFormat.format(selfSuppliedQuantity(calculation.selfSupplied))}개</td>
                  <td>{formatGold(calculation.consumedPurchaseCost)}</td>
                  <td>{formatGold(calculation.cashOutlay)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className={styles.mobileRanking} aria-label={label}>
        {recommendation.ranked.map((calculation, index) => (
          <RecommendationCard
            key={calculation.dishId}
            calculation={calculation}
            dish={itemsById.get(calculation.dishId)!}
            rank={index + 1}
          />
        ))}
      </div>
    </>
  )
}
