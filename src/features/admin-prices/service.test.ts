import { describe, expect, it, vi } from 'vitest'
import { createPriceCycleDraft, publishPriceCycle, validatePriceCycleDraft } from './service'
import { priceCycleDraftSchema } from './schema'

const dishId = '10000000-0000-4000-8000-000000000005'
const cycleId = '20000000-0000-4000-8000-000000000001'
const draft = { startsAt: '2026-09-19T00:00:00+09:00', sourceUrl: 'https://example.com/prices', reason: '공식 가격 확인', prices: [{ dishItemId: dishId, basePrice: 100, sourceNote: '' }] }
const dishes = [{ id: dishId, slug: 'soup', name: '수프', officialMinPrice: 50, officialMaxPrice: 150 }]

describe('price cycle service', () => {
  it('normalizes offsets and defaults to exactly 72 elapsed hours', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: cycleId, error: null })
    expect(await createPriceCycleDraft(draft, { rpc })).toBe(cycleId)
    expect(rpc).toHaveBeenCalledWith('create_price_cycle_draft', { p_input: expect.objectContaining({ startsAt: '2026-09-18T15:00:00.000Z', endsAt: '2026-09-21T15:00:00.000Z' }) })
  })
  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid price %s', (basePrice) => {
    expect(priceCycleDraftSchema.safeParse({ ...draft, prices: [{ ...draft.prices[0], basePrice }] }).success).toBe(false)
  })
  it('blocks missing active dishes', () => {
    expect(validatePriceCycleDraft({ ...draft, prices: [] }, dishes, []).valid).toBe(false)
  })
  it('requires a nonblank source note outside configured official bounds', () => {
    const changed = { ...draft, prices: [{ ...draft.prices[0], basePrice: 151, sourceNote: '  ' }] }
    expect(validatePriceCycleDraft(changed, dishes, []).valid).toBe(false)
    expect(validatePriceCycleDraft({ ...changed, prices: [{ ...changed.prices[0], sourceNote: '공식 공지 확인' }] }, dishes, []).valid).toBe(true)
  })
  it('rejects overlaps but permits adjacent half-open intervals', () => {
    expect(validatePriceCycleDraft(draft, dishes, [{ startsAt: '2026-09-17T15:00:00Z', endsAt: '2026-09-19T15:00:00Z' }]).valid).toBe(false)
    expect(validatePriceCycleDraft(draft, dishes, [{ startsAt: '2026-09-15T15:00:00Z', endsAt: '2026-09-18T15:00:00Z' }]).valid).toBe(true)
  })
  it('rejects duplicates, unknown dishes and a non-72-hour end', () => {
    expect(validatePriceCycleDraft({ ...draft, prices: [...draft.prices, ...draft.prices] }, dishes, []).valid).toBe(false)
    expect(validatePriceCycleDraft(draft, [], []).valid).toBe(false)
    expect(priceCycleDraftSchema.safeParse({ ...draft, endsAt: '2026-09-20T00:00:00+09:00' }).success).toBe(false)
  })
  it('publishes through the revalidating RPC and maps constraint errors safely', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: '23P01', message: 'secret SQL' } })
    await expect(publishPriceCycle(cycleId, '공식 가격 게시', { rpc })).rejects.toThrow('게시할 수 없는 가격 주기입니다.')
    expect(rpc).toHaveBeenCalledWith('publish_price_cycle', { p_cycle_id: cycleId, p_reason: '공식 가격 게시' })
  })
})
