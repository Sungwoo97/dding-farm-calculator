import { describe, expect, it, vi } from 'vitest'

describe('user-settings database module', () => {
  it('can load during server rendering before IndexedDB is available', async () => {
    const indexedDbDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB')
    Reflect.deleteProperty(globalThis, 'indexedDB')
    vi.resetModules()

    try {
      await expect(import('./db')).resolves.toMatchObject({
        getDb: expect.any(Function),
      })
    } finally {
      if (indexedDbDescriptor) {
        Object.defineProperty(globalThis, 'indexedDB', indexedDbDescriptor)
      }
    }
  })
})
