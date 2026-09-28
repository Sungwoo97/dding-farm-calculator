import { redirect } from 'next/navigation'
import { AdminAccessError, requireAdmin } from '@/lib/supabase/admin'
import { login } from './actions'

// Public login entry still verifies existing sessions before showing admin links.
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  let admin = false
  let unavailable = false
  try { await requireAdmin(); admin = true } catch (error) { unavailable = !(error instanceof AdminAccessError) }
  if (admin) redirect('/admin/prices')
  const params = await searchParams
  return <section aria-labelledby="login-title" style={{ maxWidth: 440, margin: '2rem auto' }}>
    <h1 id="login-title">관리자 로그인</h1>
    {(params.error || unavailable) && <p role="alert">로그인 정보를 확인하거나 잠시 후 다시 시도해 주세요.</p>}
    <form action={login} style={{ display: 'grid', gap: 16 }}>
      <label>이메일<input name="email" type="email" autoComplete="username" required /></label>
      <label>비밀번호<input name="password" type="password" autoComplete="current-password" required /></label>
      <button type="submit">로그인</button>
    </form>
  </section>
}
