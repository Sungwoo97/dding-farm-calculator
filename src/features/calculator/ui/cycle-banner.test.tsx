import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { PublishedCatalog } from '@/features/catalog/types'

import { CycleBanner } from './cycle-banner'

const cycle: PublishedCatalog['activeCycle'] = {
  id: '30000000-0000-4000-8000-000000000001',
  startsAt: '2026-09-17T00:00:00.000Z',
  endsAt: '2026-09-20T00:00:00.000Z',
  status: 'PUBLISHED',
  timeZone: 'Asia/Seoul',
  publishedAt: '2026-09-16T00:00:00.000Z',
  sourceUrl: 'https://example.com/cycle',
  verifiedAt: '2026-09-16T00:00:00.000Z',
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('CycleBanner', () => {
  it('changes to the expired state at the exact cycle boundary and cleans up its timer', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-19T23:59:59.000Z'))

    const view = render(<CycleBanner cycle={cycle} />)
    expect(screen.getByText('현재 가격 주기')).toBeInTheDocument()
    expect(vi.getTimerCount()).toBe(1)

    act(() => vi.advanceTimersByTime(1_000))

    expect(screen.getByText('이전 주기 참고값')).toBeInTheDocument()
    expect(vi.getTimerCount()).toBe(0)

    view.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
