import { beforeEach, describe, expect, it, vi } from 'vitest'
const { getUser, rpc } = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createServerClient: async () => ({ auth: { getUser }, rpc }) }))
import { requireAdmin } from '@/lib/supabase/admin'
import { POST } from '@/app/api/admin/price-cycles/route'

const command = { type: 'PUBLISH', cycleId: '20000000-0000-4000-8000-000000000001', reason: '공식 확인' }
const request = (body: unknown) => new Request('http://localhost/api/admin/price-cycles', { method: 'POST', body: JSON.stringify(body) })
beforeEach(() => { vi.clearAllMocks(); getUser.mockResolvedValue({ data: { user: { id: 'admin', app_metadata: { role: 'admin' } } }, error: null }); rpc.mockResolvedValue({ data: null, error: null }) })

describe('admin authorization and command API', () => {
  it('requires a freshly verified user on every invocation', async () => {
    await requireAdmin()
    getUser.mockResolvedValue({ data: { user: null }, error: null })
    await expect(requireAdmin()).rejects.toMatchObject({ status: 401 })
  })
  it('does not trust user_metadata admin claims', async () => {
    getUser.mockResolvedValue({ data: { user: { app_metadata: {}, user_metadata: { role: 'admin' } } }, error: null })
    expect((await POST(request(command))).status).toBe(403)
    expect(rpc).not.toHaveBeenCalled()
  })
  it('returns 401 for an expired session without mutation', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: 'sensitive auth' } })
    expect((await POST(request(command))).status).toBe(401)
    expect(rpc).not.toHaveBeenCalled()
  })
  it.each([{ type: 'DELETE' }, { ...command, reason: '' }, { ...command, adminId: 'spoof' }])('rejects invalid commands', async (body) => {
    expect((await POST(request(body))).status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })
  it('rejects malformed JSON safely', async () => {
    expect((await POST(new Request('http://localhost', { method: 'POST', body: '{' }))).status).toBe(400)
  })
  it('maps DB validation errors to safe 400 responses', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '23514', message: 'secret SQL' } })
    const response = await POST(request(command))
    expect(response.status).toBe(400)
    expect(await response.text()).not.toContain('secret')
  })
  it('hides unexpected infrastructure failures', async () => {
    rpc.mockRejectedValue(new Error('secret password stack'))
    const response = await POST(request(command))
    expect(response.status).toBe(500)
    expect(await response.text()).not.toMatch(/secret|stack|password/)
  })
  it('dispatches validated publish requests successfully', async () => {
    expect((await POST(request(command))).status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('publish_price_cycle', { p_cycle_id: command.cycleId, p_reason: command.reason })
  })
  it('creates a draft and normalizes the exact interval at the API boundary', async () => {
    rpc.mockResolvedValue({ data: command.cycleId, error: null })
    const response = await POST(request({ type: 'CREATE_DRAFT', input: { startsAt: '2026-09-19T00:00:00+09:00', sourceUrl: 'https://example.com/prices', reason: 'draft', prices: [] } }))
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ cycleId: command.cycleId })
    expect(rpc).toHaveBeenCalledWith('create_price_cycle_draft', { p_input: { startsAt: '2026-09-18T15:00:00.000Z', endsAt: '2026-09-21T15:00:00.000Z', sourceUrl: 'https://example.com/prices', reason: 'draft', prices: [] } })
  })
})
