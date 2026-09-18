import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const getPublishedCatalog = vi.hoisted(() => vi.fn().mockResolvedValue({}))

vi.mock('@/features/catalog/server/repository', () => ({ getPublishedCatalog }))
vi.mock('@/features/calculator/ui/recommendation-dashboard', () => ({
  RecommendationDashboard: () => <h1>오늘의 추천</h1>,
}))

import HomePage from './page'

describe('HomePage', () => {
  it('오늘의 추천 제목을 표시한다', async () => {
    render(await HomePage())
    expect(screen.getByRole('heading', { name: '오늘의 추천' })).toBeInTheDocument()
  })
})
