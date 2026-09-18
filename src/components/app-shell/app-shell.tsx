'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import styles from './app-shell.module.css'

const navigation = [
  { href: '/', label: '오늘의 추천' },
  { href: '/materials', label: '재료 가격' },
  { href: '/settings', label: '내 설정' },
  { href: '/recipes', label: '레시피' },
  { href: '/price-history', label: '가격 기록' },
] as const

function NavigationLink({ href, label }: (typeof navigation)[number]) {
  const pathname = usePathname()
  const current = pathname === href

  return (
    <Link href={href} aria-current={current ? 'page' : undefined}>
      <span>{label}</span>
      {current ? <span className={styles.currentLabel}>현재</span> : null}
    </Link>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const primary = navigation.slice(0, 3)
  const secondary = navigation.slice(3)

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/">띵타이쿤 재배전문가</Link>
        <nav aria-label="주요 메뉴">
          {navigation.map((item) => <NavigationLink key={item.href} {...item} />)}
        </nav>
      </aside>
      <main id="main-content" className={styles.content}>{children}</main>
      <nav className={styles.bottomNavigation} aria-label="모바일 주요 메뉴">
        {primary.map((item) => <NavigationLink key={item.href} {...item} />)}
        <details className={styles.moreMenu}>
          <summary>더보기</summary>
          <div className={styles.moreLinks}>
            {secondary.map((item) => <NavigationLink key={item.href} {...item} />)}
          </div>
        </details>
      </nav>
    </div>
  )
}
