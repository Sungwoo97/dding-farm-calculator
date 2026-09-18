import { useEffect, useState } from 'react'

import type { PublishedCatalog } from '@/features/catalog/types'

import styles from './recommendation-dashboard.module.css'

const cycleDate = new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Seoul',
})

export function CycleBanner({
  cycle,
  now,
}: {
  cycle: PublishedCatalog['activeCycle']
  now?: string
}) {
  const [currentTime, setCurrentTime] = useState(() => Date.now())

  useEffect(() => {
    if (now !== undefined) return
    const remaining = Date.parse(cycle.endsAt) - Date.now()
    if (remaining <= 0) return

    const timeout = window.setTimeout(() => setCurrentTime(Date.now()), remaining)
    return () => window.clearTimeout(timeout)
  }, [cycle.endsAt, now])

  const displayedTime = now === undefined ? currentTime : Date.parse(now)
  const expired = displayedTime >= Date.parse(cycle.endsAt)

  return (
    <aside className={styles.cycleBanner} aria-label="가격 주기">
      <div>
        <strong>{expired ? '이전 주기 참고값' : '현재 가격 주기'}</strong>
        <p>{cycleDate.format(new Date(cycle.startsAt))} – {cycleDate.format(new Date(cycle.endsAt))}</p>
      </div>
      <span className={expired ? styles.expiredBadge : styles.activeBadge}>
        {expired ? '주기 종료' : '게시 중'}
      </span>
    </aside>
  )
}
