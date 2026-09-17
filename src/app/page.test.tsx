import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import HomePage from './page'

describe('HomePage', () => {
  it('오늘의 추천 제목을 표시한다', () => {
    render(<HomePage />)
    expect(screen.getByRole('heading', { name: '오늘의 추천' })).toBeInTheDocument()
  })
})
