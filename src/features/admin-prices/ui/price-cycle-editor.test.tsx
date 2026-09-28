import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PriceCycleEditor } from './price-cycle-editor'

const dishes = [
  { id: '10000000-0000-4000-8000-000000000005', slug: 'soup', name: '수프', officialMinPrice: 50, officialMaxPrice: 150 },
  { id: '10000000-0000-4000-8000-000000000006', slug: 'salad', name: '샐러드', officialMinPrice: null, officialMaxPrice: null },
]
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('PriceCycleEditor', () => {
  it('copies every previous price and shows changes', () => {
    render(<PriceCycleEditor dishes={dishes} previousPrices={{ [dishes[0].id]: 100, [dishes[1].id]: 200 }} />)
    fireEvent.click(screen.getByRole('button', { name: '이전 가격 복사' }))
    expect(screen.getByLabelText('수프 가격')).toHaveValue(100)
    expect(screen.getByLabelText('샐러드 가격')).toHaveValue(200)
    expect(screen.getAllByText('0.0%')).toHaveLength(2)
  })
  it('applies matching TSV rows and reports unknown slugs by line', () => {
    render(<PriceCycleEditor dishes={dishes} previousPrices={{}} />)
    fireEvent.change(screen.getByLabelText('가격 TSV'), { target: { value: 'soup\t120\nsalad\t220\nunknown\t30' } })
    fireEvent.click(screen.getByRole('button', { name: '붙여넣기 적용' }))
    expect(screen.getByLabelText('수프 가격')).toHaveValue(120)
    expect(screen.getByLabelText('샐러드 가격')).toHaveValue(220)
    expect(screen.getByRole('alert')).toHaveTextContent('3행: 알 수 없는 요리 unknown')
    expect(screen.getByRole('button', { name: '게시 확인' })).toBeDisabled()
  })
  it('requires validation and a saved draft before publication', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ cycleId: '20000000-0000-4000-8000-000000000001' }) })
    vi.stubGlobal('fetch', fetcher)
    render(<PriceCycleEditor dishes={dishes} previousPrices={{ [dishes[0].id]: 100, [dishes[1].id]: 200 }} />)
    fireEvent.click(screen.getByRole('button', { name: '이전 가격 복사' }))
    fireEvent.change(screen.getByLabelText('출처 URL'), { target: { value: 'https://example.com/prices' } })
    fireEvent.change(screen.getByLabelText('변경 사유'), { target: { value: '공식 확인' } })
    fireEvent.click(screen.getByRole('button', { name: '초안 저장' }))
    expect(await screen.findByText('초안을 저장했습니다.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '게시 확인' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Asia/Seoul')
    fireEvent.click(screen.getByRole('button', { name: '게시 취소' }))
    fireEvent.change(screen.getByLabelText('수프 가격'), { target: { value: '0' } })
    expect(screen.getByRole('button', { name: '게시 확인' })).toBeDisabled()
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('sends the saved cycle ID only after explicit publication confirmation', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ cycleId: '20000000-0000-4000-8000-000000000001' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ published: true }) })
    vi.stubGlobal('fetch', fetcher)
    render(<PriceCycleEditor dishes={dishes} previousPrices={{ [dishes[0].id]: 100, [dishes[1].id]: 200 }} initialStartsAt="2026-09-18T15:00:00Z" />)
    fireEvent.click(screen.getByRole('button', { name: '이전 가격 복사' }))
    fireEvent.change(screen.getByLabelText('출처 URL'), { target: { value: 'https://example.com/prices' } })
    fireEvent.change(screen.getByLabelText('변경 사유'), { target: { value: '공식 확인' } })
    fireEvent.click(screen.getByRole('button', { name: '초안 저장' }))
    await screen.findByText('초안을 저장했습니다.')
    expect(JSON.parse(fetcher.mock.calls[0][1].body).input.startsAt).toBe('2026-09-18T15:00:00.000Z')
    fireEvent.click(screen.getByRole('button', { name: '게시 확인' }))
    expect(fetcher).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: '게시 확정' }))
    await screen.findByText('가격 주기를 게시했습니다.')
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ type: 'PUBLISH', cycleId: '20000000-0000-4000-8000-000000000001', reason: '공식 확인' })
    expect(screen.getByRole('button', { name: '게시 확인' })).toBeDisabled()
  })
  it('requires evidence for configured bounds but never fabricates unconfigured ranges', () => {
    render(<PriceCycleEditor dishes={dishes} previousPrices={{ [dishes[0].id]: 151, [dishes[1].id]: 99999 }} />)
    fireEvent.click(screen.getByRole('button', { name: '이전 가격 복사' }))
    fireEvent.change(screen.getByLabelText('출처 URL'), { target: { value: 'https://example.com' } })
    fireEvent.change(screen.getByLabelText('변경 사유'), { target: { value: '확인' } })
    expect(screen.getByRole('alert')).toHaveTextContent('수프: 공식 범위 밖의 가격에는 확인 근거가 필요합니다.')
    expect(screen.getByText('공식 범위 미등록')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('수프 확인 근거'), { target: { value: '공식 확인' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
