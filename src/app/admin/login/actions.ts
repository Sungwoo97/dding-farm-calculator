'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/admin'

// Check the authoritative user after password sign-in before granting access.
export async function login(formData: FormData): Promise<void> {
  const credentials = z.object({ email: z.email(), password: z.string().min(1).max(4096) }).safeParse({ email: formData.get('email'), password: formData.get('password') })
  if (!credentials.success) redirect('/admin/login?error=access')
  try {
    const client = await createServerClient()
    const { error } = await client.auth.signInWithPassword(credentials.data)
    if (error) throw new Error('Sign-in failed')
    try { await requireAdmin(client) } catch {
      await client.auth.signOut()
      throw new Error('Administrator required')
    }
  } catch { redirect('/admin/login?error=access') }
  redirect('/admin/prices')
}
