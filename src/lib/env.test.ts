// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { parseEnv } from './env'

describe('environment validation', () => {
  it.each(['development', 'test'])('allows explicit fixtures without credentials in %s', (NODE_ENV) => {
    expect(parseEnv({ NODE_ENV, NEXT_PUBLIC_USE_FIXTURES: '1' }).NEXT_PUBLIC_USE_FIXTURES).toBe('1')
  })
  it('rejects fixture mode in production', () => {
    expect(() => parseEnv({ NODE_ENV: 'production', NEXT_PUBLIC_USE_FIXTURES: '1' })).toThrow()
  })
  it.each([
    {},
    { NEXT_PUBLIC_SUPABASE_URL: 'https://catalog.supabase.co' },
    { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' },
    { NEXT_PUBLIC_SUPABASE_URL: 'invalid', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' },
    { NEXT_PUBLIC_SUPABASE_URL: 'https://catalog.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ' ' },
  ])('requires valid public credentials when fixtures are disabled: %j', (values) => {
    expect(() => parseEnv({ NODE_ENV: 'production', ...values })).toThrow()
  })
  it('accepts production public credentials and defaults to live mode', () => {
    expect(parseEnv({ NODE_ENV: 'production', NEXT_PUBLIC_SUPABASE_URL: 'https://catalog.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' }).NEXT_PUBLIC_USE_FIXTURES).toBe('0')
  })
})
