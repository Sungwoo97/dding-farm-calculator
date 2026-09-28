import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const { getUser, signInWithPassword, signOut, redirect } = vi.hoisted(() => ({ getUser: vi.fn(), signInWithPassword: vi.fn(), signOut: vi.fn(), redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`) }) }))
vi.mock('@/lib/supabase/server', () => ({ createServerClient: async () => ({ auth: { getUser, signInWithPassword, signOut } }) }))
vi.mock('next/navigation', () => ({ redirect }))
import { login } from '@/app/admin/login/actions'
import LoginPage from '@/app/admin/login/page'
import PricesPage from '@/app/admin/prices/page'

const form = () => { const data = new FormData(); data.set('email', 'admin@example.com'); data.set('password', 'test-password'); return data }
beforeEach(() => { vi.clearAllMocks(); signInWithPassword.mockResolvedValue({ error: null }); signOut.mockResolvedValue({ error: null }); getUser.mockResolvedValue({ data: { user: null }, error: null }) })
afterEach(cleanup)
describe('admin login', () => {
  it('shows the login form only after verifying the current session', async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }))
    expect(screen.getByLabelText('이메일')).toBeInTheDocument()
    expect(getUser).toHaveBeenCalledOnce()
  })
  it('redirects an anonymous prices page to login before reading data', async () => {
    await expect(PricesPage()).rejects.toThrow('REDIRECT:/admin/login')
  })
  it('does not accept sign-in success without a verified administrator', async () => {
    await expect(login(form())).rejects.toThrow('REDIRECT:/admin/login?error=access')
    expect(getUser).toHaveBeenCalledOnce()
    expect(signOut).toHaveBeenCalledOnce()
  })
  it('redirects only after getUser confirms app_metadata administrator role', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'admin', app_metadata: { role: 'admin' } } }, error: null })
    await expect(login(form())).rejects.toThrow('REDIRECT:/admin/prices')
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'admin@example.com', password: 'test-password' })
    expect(getUser).toHaveBeenCalledOnce()
  })
  it('returns a safe failure URL for authentication service failures', async () => {
    signInWithPassword.mockRejectedValue(new Error('secret'))
    await expect(login(form())).rejects.toThrow('REDIRECT:/admin/login?error=access')
  })
})
