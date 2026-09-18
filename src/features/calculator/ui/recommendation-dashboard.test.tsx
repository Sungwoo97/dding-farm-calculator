import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { PublishedCatalog } from '@/features/catalog/types'
import { defaultUserProfile, userSettingsRepository } from '@/features/user-settings/storage/repository'

import { RecommendationDashboard } from './recommendation-dashboard'

const source = {
  sourceUrl: 'https://example.com/test-source',
  verifiedAt: '2026-09-18T00:00:00.000Z',
}

const itemIds = {
  tomato: '10000000-0000-4000-8000-000000000001',
  wheat: '10000000-0000-4000-8000-000000000002',
  salt: '10000000-0000-4000-8000-000000000003',
  tomatoDish: '10000000-0000-4000-8000-000000000011',
  wheatDish: '10000000-0000-4000-8000-000000000012',
  unavailableDish: '10000000-0000-4000-8000-000000000013',
} as const

const catalog: PublishedCatalog = {
  items: [
    { id: itemIds.tomato, slug: 'tomato', name: '토마토', category: 'RAW', tradeable: true, ...source },
    { id: itemIds.wheat, slug: 'wheat', name: '밀', category: 'RAW', tradeable: true, ...source },
    { id: itemIds.salt, slug: 'salt', name: '소금', category: 'RAW', tradeable: true, ...source },
    { id: itemIds.tomatoDish, slug: 'tomato-stir-fry', name: '토마토 볶음', category: 'DISH', tradeable: true, ...source },
    { id: itemIds.wheatDish, slug: 'wheat-stew', name: '밀 스튜', category: 'DISH', tradeable: true, ...source },
    { id: itemIds.unavailableDish, slug: 'salt-soup', name: '소금국', category: 'DISH', tradeable: true, ...source },
  ],
  recipes: [
    {
      id: '20000000-0000-4000-8000-000000000011', outputItemId: itemIds.tomatoDish, outputQuantity: 1,
      ingredients: [{ itemId: itemIds.tomato, quantity: 1 }], validFrom: '2026-09-01T00:00:00.000Z', validTo: null, ...source,
    },
    {
      id: '20000000-0000-4000-8000-000000000012', outputItemId: itemIds.wheatDish, outputQuantity: 1,
      ingredients: [{ itemId: itemIds.wheat, quantity: 5 }], validFrom: '2026-09-01T00:00:00.000Z', validTo: null, ...source,
    },
    {
      id: '20000000-0000-4000-8000-000000000013', outputItemId: itemIds.unavailableDish, outputQuantity: 1,
      ingredients: [{ itemId: itemIds.salt, quantity: 1 }], validFrom: '2026-09-01T00:00:00.000Z', validTo: null, ...source,
    },
  ],
  activeCycle: {
    id: '30000000-0000-4000-8000-000000000001', startsAt: '2026-09-15T00:00:00.000Z',
    endsAt: '2026-09-18T00:00:00.000Z', status: 'PUBLISHED', timeZone: 'Asia/Seoul',
    publishedAt: '2026-09-14T00:00:00.000Z', ...source,
  },
  prices: [
    { dishItemId: itemIds.tomatoDish, basePrice: 600, sourceNote: 'test', ...source },
    { dishItemId: itemIds.wheatDish, basePrice: 1_200, sourceNote: 'test', ...source },
    { dishItemId: itemIds.unavailableDish, basePrice: 400, sourceNote: 'test', ...source },
  ],
  skills: [],
  dataVersion: 'test-catalog-v1',
}

describe('RecommendationDashboard', () => {
  beforeEach(async () => {
    await userSettingsRepository.replaceAll({
      schemaVersion: 1,
      profile: defaultUserProfile,
      materials: [
        { itemId: itemIds.tomato, sourceMode: 'SELF', ownedQuantity: 1, purchasePackQuantity: 1, purchasePackPrice: 100 },
        { itemId: itemIds.wheat, sourceMode: 'PURCHASE', ownedQuantity: 0, purchasePackQuantity: 1, purchasePackPrice: 100 },
      ],
      favorites: [],
      catalogCache: null,
    })
  })

  afterEach(cleanup)

  it('ranks valid dishes per scenario and keeps unavailable dishes outside the ranking', async () => {
    render(<RecommendationDashboard catalog={catalog} now="2026-09-20T00:00:00.000Z" />)

    const allPurchaseTab = await screen.findByRole('tab', { name: '전부 구매 효율' })
    expect(allPurchaseTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('이전 주기 참고값')).toBeInTheDocument()

    const allPurchaseTable = screen.getByRole('table', { name: '전부 구매 효율 순위' })
    expect(within(allPurchaseTable).getAllByRole('link').map((link) => link.textContent)).toEqual(['토마토 볶음', '밀 스튜'])

    const unavailable = screen.getByRole('region', { name: '계산 불가 요리' })
    expect(unavailable).toHaveTextContent('소금국')
    expect(unavailable).toHaveTextContent('가격 입력 필요')
    expect(within(allPurchaseTable).queryByRole('link', { name: '소금국' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: '내 실제 조달' }))

    const actualTable = screen.getByRole('table', { name: '내 실제 조달 순위' })
    expect(within(actualTable).getAllByRole('link').map((link) => link.textContent)).toEqual(['밀 스튜', '토마토 볶음'])
    expect(within(actualTable).getByRole('row', { name: /토마토 볶음/ })).toHaveTextContent('구매비용 없음')
    expect(document.body).not.toHaveTextContent('Infinity')
  })
})
