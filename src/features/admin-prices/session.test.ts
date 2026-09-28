// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const { createServerClient, getUser } = vi.hoisted(() => ({ createServerClient: vi.fn(), getUser: vi.fn() }))
vi.mock('@supabase/ssr', () => ({ createServerClient }))
vi.mock('@/lib/env', () => ({ getSupabaseConfig: () => ({ NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'public-test-key' }) }))
import { proxy } from '@/proxy'
beforeEach(() => { vi.clearAllMocks() })
describe('admin cookie refresh', () => {
  it('forwards refreshed cookies to both the server request and browser response', async () => {
    createServerClient.mockImplementation((_url, _key, options) => ({ auth: { getUser: async () => { options.cookies.setAll([{ name: 'session', value: 'refreshed', options: { httpOnly: true, path: '/' } }]); return { data: { user: null }, error: null } } } }))
    const request = new NextRequest('https://example.com/admin/prices', { headers: { cookie: 'session=old' } })
    const response = await proxy(request)
    expect(request.cookies.get('session')?.value).toBe('refreshed')
    expect(response.cookies.get('session')?.value).toBe('refreshed')
    expect(response.headers.get('set-cookie')).toContain('HttpOnly')
  })
  it('allows pages/routes to map an auth service failure safely', async () => {
    createServerClient.mockReturnValue({ auth: { getUser } })
    getUser.mockRejectedValue(new Error('private auth message'))
    const response = await proxy(new NextRequest('https://example.com/admin/login'))
    expect(response.status).toBe(200)
    expect(await response.text()).not.toContain('private')
  })
})
