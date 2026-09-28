import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseConfig } from '@/lib/env'

// Refresh cookies before Server Components, which cannot write response cookies.
// Every protected entry point still verifies the user and role independently.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })
  try {
    const config = getSupabaseConfig()
    const client = createServerClient(config.NEXT_PUBLIC_SUPABASE_URL, config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookies) {
          cookies.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    })
    await client.auth.getUser()
  } catch {
    // The page/action/route handles unavailable authentication without details.
  }
  return response
}

export const config = { matcher: ['/admin/:path*', '/api/admin/:path*'] }
