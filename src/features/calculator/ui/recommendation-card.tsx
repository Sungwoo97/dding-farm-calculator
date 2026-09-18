import Link from 'next/link'

import type { PublishedCatalog } from '@/features/catalog/types'

import type { DishCalculation } from '../domain/types'
import { formatGold, formatRoi } from './presentation'
import styles from './recommendation-dashboard.module.css'

export function RecommendationCard({
  calculation,
  dish,
  rank,
}: {
  calculation: DishCalculation
  dish: PublishedCatalog['items'][number]
  rank: number
}) {
  return (
    <article className={`${styles.card} ${rank === 1 ? styles.firstRank : ''}`}>
      <div className={styles.cardHeading}>
        <span className={styles.rank}>{rank}위</span>
        {rank === 1 ? <span className={styles.changeBadge}>추천</span> : null}
        <h3><Link href={`/recipes/${dish.slug}?scenario=${calculation.scenario}`}>{dish.name}</Link></h3>
      </div>
      <dl className={styles.cardMetrics}>
        <div><dt>순이익</dt><dd>{formatGold(calculation.netProfit)}</dd></div>
        <div><dt>구매 ROI</dt><dd>{formatRoi(calculation.purchaseRoi, calculation.consumedPurchaseCost)}</dd></div>
        <div><dt>소모 원가</dt><dd>{formatGold(calculation.consumedPurchaseCost)}</dd></div>
        <div><dt>현금 지출</dt><dd>{formatGold(calculation.cashOutlay)}</dd></div>
      </dl>
    </article>
  )
}
