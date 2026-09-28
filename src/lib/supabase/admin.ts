import { createServerClient } from './server'

export class AdminAccessError extends Error {
  constructor(public readonly status: 401 | 403) { super(status === 401 ? '로그인이 필요합니다.' : '관리자 권한이 필요합니다.') }
}

// Revalidate on every server entry point; user_metadata is never authoritative.
export async function requireAdmin(client?: Awaited<ReturnType<typeof createServerClient>>) {
  const supabase = client ?? await createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new AdminAccessError(401)
  if (user.app_metadata.role !== 'admin') throw new AdminAccessError(403)
  return user
}
