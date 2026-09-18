import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { PublishedCatalog } from '@/features/catalog/types'
import { defaultUserProfile, userSettingsRepository } from '@/features/user-settings/storage/repository'

import { DishBreakdown } from './dish-breakdown'

const source = {
  sourceUrl: 'https://example.com/test-source',
  verifiedAt: '2026-09-18T00:00:00.000Z',
}

const ids = {
  tomato: '10000000-0000-4000-8000-000000000001',
  salt: '10000000-0000-4000-8000-000000000002',
  dish: '10000000-0000-4000-8000-000000000011',
  skill: '10000000-0000-4000-8000-000000000051',
} as const

const catalog: PublishedCatalog = {
  items: [
    { id: ids.tomato, slug: 'tomato', name: '토마토', category: 'RAW', tradeable: true, ...source },
    { id: ids.salt, slug: 'salt', name: '소금', category: 'FIXED_INGREDIENT', tradeable: true, ...source },
    { id: ids.dish, slug: 'tomato-soup', name: '토마토 수프', category: 'DISH', tradeable: true, ...source },
  ],
  recipes: [{
    id: '20000000-0000-4000-8000-000000000011',
    outputItemId: ids.dish,
    outputQuantity: 1,
    ingredients: [{ itemId: ids.tomato, quantity: 3 }, { itemId: ids.salt, quantity: 1 }],
    validFrom: '2026-09-01T00:00:00.000Z',
    validTo: null,
    ...source,
  }],
  activeCycle: {
    id: '30000000-0000-4000-8000-000000000001', startsAt: '2026-09-17T00:00:00.000Z',
    endsAt: '2026-09-20T00:00:00.000Z', status: 'PUBLISHED', timeZone: 'Asia/Seoul',
    publishedAt: '2026-09-16T00:00:00.000Z', ...source,
  },
  prices: [{ dishItemId: ids.dish, basePrice: 1_000, sourceNote: 'test', ...source }],
  skills: [{
    id: ids.skill, slug: 'sale-bonus', name: '판매 보너스', appliesTo: 'DISH', maxLevel: 1,
    levels: [{
      level: 1,
      rulesVersion: 'test-v1',
      effect: { type: 'SELL_PRICE_MULTIPLIER', value: 0.1, order: 1, rounding: 'NONE', verified: true },
      ...source,
    }],
    ...source,
  }],
  dataVersion: 'test-catalog-v1',
}

describe('DishBreakdown', () => {
  beforeEach(async () => {
    await userSettingsRepository.replaceAll({
      schemaVersion: 1,
      profile: { ...defaultUserProfile, skills: { [ids.skill]: 1 } },
      materials: [
        {
          itemId: ids.tomato,
          sourceMode: 'MIXED',
          ownedQuantity: 1,
          purchasePackQuantity: 4,
          purchasePackPrice: 400,
          observedAt: '2026-09-18T01:02:03.000Z',
        },
        { itemId: ids.salt, sourceMode: 'SELF', ownedQuantity: 1 },
      ],
      favorites: [],
      catalogCache: null,
    })
  })

  afterEach(cleanup)

  it('explains the recipe, procurement, sale revenue, profit, and ROI', async () => {
    render(<DishBreakdown catalog={catalog} dishId={ids.dish} scenario="ACTUAL" />)

    expect(await screen.findByRole('heading', { name: '토마토 수프 계산 근거' })).toBeInTheDocument()

    const recipeTree = screen.getByRole('tree', { name: '레시피 구성' })
    expect(within(recipeTree).getByRole('treeitem', { name: /토마토 수프 1개 만들기/ })).toBeInTheDocument()
    expect(within(recipeTree).getByRole('treeitem', { name: /토마토 3개/ })).toBeInTheDocument()
    expect(within(recipeTree).getByRole('treeitem', { name: /소금 1개/ })).toBeInTheDocument()

    const procurement = screen.getByRole('region', { name: '재료 조달 내역' })
    const tomato = within(procurement).getByRole('listitem', { name: /토마토/ })
    expect(tomato).toHaveTextContent('구매 2개')
    expect(tomato).toHaveTextContent('자가 조달 1개')
    expect(tomato).toHaveTextContent('소모 원가 200 G')
    expect(tomato).toHaveTextContent('현금 지출 400 G')
    expect(tomato).toHaveTextContent('잔여 2개')
    expect(tomato).toHaveTextContent('가격 관측 2026. 9. 18. 오전 10:02')
    expect(tomato.querySelector('time')).toHaveAttribute('dateTime', '2026-09-18T01:02:03.000Z')

    const summary = screen.getByRole('region', { name: '수익 계산' })
    const expectMetric = (label: string, value: string) => {
      expect(within(summary).getByText(label).nextElementSibling).toHaveTextContent(value)
    }
    expectMetric('기본 판매 수익', '1,000 G')
    expectMetric('스킬 적용 판매 수익', '1,100 G')
    expectMetric('소모 구매 원가', '200 G')
    expectMetric('실제 지출액', '400 G')
    expectMetric('순이익', '900 G')
    expectMetric('구매 ROI', '450%')
    expect(summary).toHaveTextContent('판매 가격 확인 2026. 9. 18. 오전 9:00')
    expect(summary.querySelector('time')).toHaveAttribute('dateTime', '2026-09-18T00:00:00.000Z')
  })

  it('shows unavailable procurement values and all purchase calculation errors', async () => {
    await userSettingsRepository.replaceAll({
      schemaVersion: 1,
      profile: defaultUserProfile,
      materials: [
        {
          itemId: ids.tomato,
          sourceMode: 'PURCHASE',
          ownedQuantity: 0,
          purchasePackQuantity: Number.MIN_VALUE,
          purchasePackPrice: 1,
          observedAt: '2026-09-18T01:02:03.000Z',
        },
        { itemId: ids.salt, sourceMode: 'SELF', ownedQuantity: 1 },
      ],
      favorites: [],
      catalogCache: null,
    })

    render(<DishBreakdown catalog={catalog} dishId={ids.dish} scenario="ACTUAL" />)

    const errors = await screen.findByRole('alert', { name: '계산할 수 없는 이유' })
    expect(errors).toHaveTextContent('토마토 가격 입력 필요')

    const procurement = screen.getByRole('region', { name: '재료 조달 내역' })
    const tomato = within(procurement).getByRole('listitem', { name: /토마토/ })
    expect(tomato).toHaveTextContent('구매 계산 불가')
    expect(tomato).toHaveTextContent('소모 원가 계산 불가')
    expect(tomato).toHaveTextContent('현금 지출 계산 불가')
    expect(tomato).toHaveTextContent('계산 결과가 표현 가능한 숫자 범위를 초과했습니다.')
    expect(tomato).not.toHaveTextContent('0 G')
  })

  it('renders every blocking error instead of presenting an invalid result', async () => {
    await userSettingsRepository.replaceAll({
      schemaVersion: 1,
      profile: defaultUserProfile,
      materials: [],
      favorites: [],
      catalogCache: null,
    })

    render(<DishBreakdown catalog={{ ...catalog, prices: [] }} dishId={ids.dish} scenario="ACTUAL" />)

    const errors = await screen.findByRole('alert', { name: '계산할 수 없는 이유' })
    expect(within(errors).getAllByRole('listitem')).toHaveLength(3)
    expect(errors).toHaveTextContent('판매 가격을 찾을 수 없습니다.')
    expect(errors).toHaveTextContent('토마토 가격 입력 필요')
    expect(errors).toHaveTextContent('소금 가격 입력 필요')
  })
})
