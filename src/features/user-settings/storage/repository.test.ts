import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { MaterialSetting } from '@/features/calculator/domain/types'

import {
  createUserSettingsRepository,
  defaultUserProfile,
} from './repository'
import { dbPromise } from './db'

const mixedMaterial: MaterialSetting = {
  itemId: 'mushroom',
  sourceMode: 'MIXED',
  intermediateMode: 'CHEAPEST',
  ownedQuantity: 7,
  purchasePackQuantity: 10,
  purchasePackPrice: 120,
  observedAt: '2026-09-16T12:00:00.000Z',
}

describe('UserSettingsRepository', () => {
  beforeEach(async () => {
    await createUserSettingsRepository().replaceAll({
      schemaVersion: 1,
      profile: defaultUserProfile,
      materials: [],
      favorites: [],
      catalogCache: null,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('restores a MIXED material setting from IndexedDB in a new repository instance', async () => {
    const writer = createUserSettingsRepository()
    await writer.saveMaterial(mixedMaterial)

    const reloadedRepository = createUserSettingsRepository()

    await expect(reloadedRepository.listMaterials()).resolves.toEqual([mixedMaterial])
  })

  it('aborts a replacement transaction when a write-stage failure occurs', async () => {
    const repository = createUserSettingsRepository()
    await repository.saveProfile({
      skills: { existing: 1 },
      defaultCraftQuantity: 3,
      recommendationSort: 'NAME',
    })
    await repository.saveMaterial(mixedMaterial)

    const database = await dbPromise
    const transaction = database.transaction.bind(database)
    const transactionSpy = vi.spyOn(database, 'transaction').mockImplementation((...arguments_) => {
      const realTransaction = transaction(...arguments_)
      return {
        objectStore(storeName: 'profile' | 'materials' | 'favorites' | 'catalog_cache') {
          const store = realTransaction.objectStore(storeName)
          if (storeName !== 'catalog_cache') return store
          return {
            clear: () => store.clear!(),
            put: async () => {
              throw new Error('forced write-stage failure')
            },
          } as unknown as typeof store
        },
        abort: realTransaction.abort.bind(realTransaction),
        done: realTransaction.done,
      } as never
    })

    await expect(
      repository.replaceAll({
        schemaVersion: 1,
        profile: defaultUserProfile,
        materials: [],
        favorites: [],
        catalogCache: {
          catalog: { items: [] },
          cachedAt: '2026-09-17T00:00:00.000Z',
          dataVersion: 'replacement',
        },
      }),
    ).rejects.toThrow('forced write-stage failure')
    transactionSpy.mockRestore()

    await expect(repository.loadProfile()).resolves.toEqual({
      skills: { existing: 1 },
      defaultCraftQuantity: 3,
      recommendationSort: 'NAME',
    })
    await expect(repository.listMaterials()).resolves.toEqual([mixedMaterial])
  })
})
