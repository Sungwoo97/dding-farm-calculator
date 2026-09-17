import { z } from 'zod'

const publicCredentials = {
  NEXT_PUBLIC_SUPABASE_URL: z.url().refine((url) => /^https?:\/\//.test(url), 'Expected an HTTP(S) URL'),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().trim().min(1),
}

const envSchema = z.union([
  z.object({
    NODE_ENV: z.enum(['development', 'test']),
    NEXT_PUBLIC_USE_FIXTURES: z.literal('1'),
    NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  }),
  z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']),
    NEXT_PUBLIC_USE_FIXTURES: z.literal('0'),
    ...publicCredentials,
  }),
])

export function parseEnv(values: Record<string, string | undefined>) {
  return envSchema.parse({
    ...values,
    NODE_ENV: values.NODE_ENV ?? 'development',
    NEXT_PUBLIC_USE_FIXTURES: values.NEXT_PUBLIC_USE_FIXTURES ?? '0',
  })
}

export function getEnv() {
  // Keep these references explicit so Next.js can inline public browser values.
  return parseEnv({
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_USE_FIXTURES: process.env.NEXT_PUBLIC_USE_FIXTURES,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  })
}

export function getSupabaseConfig() {
  return z.object(publicCredentials).parse(getEnv())
}
