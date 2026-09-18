import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const catalogBoundary = vi.hoisted(() => ({
  getFixtureCatalog: vi.fn(),
  getPublishedCatalog: vi.fn(),
}))

vi.mock('@/features/catalog/server/fixture-catalog', () => ({
  getFixtureCatalog: catalogBoundary.getFixtureCatalog,
}))
vi.mock('@/features/catalog/server/repository', () => ({
  getPublishedCatalog: catalogBoundary.getPublishedCatalog,
}))
vi.mock('@/features/user-settings/ui/materials-form', () => ({
  MaterialsForm: () => null,
}))
vi.mock('@/features/user-settings/ui/settings-form', () => ({
  SettingsForm: () => null,
}))
vi.mock('@/features/calculator/ui/recommendation-dashboard', () => ({
  RecommendationDashboard: () => <h1>오늘의 추천</h1>,
}))
vi.mock('@/features/calculator/ui/dish-breakdown', () => ({
  DishBreakdown: () => <h1>토마토 수프 계산 근거</h1>,
}))

import HomePage from './page'
import MaterialsPage from './materials/page'
import RecipeDetailPage from './recipes/[slug]/page'
import SettingsPage from './settings/page'

const now = new Date('2026-09-18T12:34:56+09:00')
const catalog = {
  items: [
    {
      id: '10000000-0000-4000-8000-000000000001',
      slug: 'tomato',
      name: '토마토',
      category: 'RAW',
      tradeable: true,
    },
    {
      id: '10000000-0000-4000-8000-000000000002',
      slug: 'tomato-soup',
      name: '토마토 수프',
      category: 'DISH',
      tradeable: true,
    },
  ],
  skills: [],
}

describe('catalog-backed settings pages', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
    catalogBoundary.getPublishedCatalog.mockResolvedValue(catalog)
    catalogBoundary.getFixtureCatalog.mockReturnValue(catalog)
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('loads catalog-backed pages through the environment-aware published catalog boundary', async () => {
    render(await HomePage())
    expect(screen.getByRole('heading', { name: '오늘의 추천' })).toBeInTheDocument()

    cleanup()
    render(await MaterialsPage())
    expect(screen.getByRole('heading', { name: '재료 가격' })).toBeInTheDocument()

    cleanup()
    render(await SettingsPage())
    expect(screen.getByRole('heading', { name: '내 설정' })).toBeInTheDocument()

    cleanup()
    render(await RecipeDetailPage({
      params: Promise.resolve({ slug: 'tomato-soup' }),
      searchParams: Promise.resolve({ scenario: 'ALL_PURCHASE' }),
    }))
    expect(screen.getByRole('heading', { name: '토마토 수프 계산 근거' })).toBeInTheDocument()

    expect(catalogBoundary.getPublishedCatalog).toHaveBeenNthCalledWith(1, now)
    expect(catalogBoundary.getPublishedCatalog).toHaveBeenNthCalledWith(2, now)
    expect(catalogBoundary.getPublishedCatalog).toHaveBeenNthCalledWith(3, now)
    expect(catalogBoundary.getPublishedCatalog).toHaveBeenNthCalledWith(4, now)
    expect(catalogBoundary.getFixtureCatalog).not.toHaveBeenCalled()
  })
})
