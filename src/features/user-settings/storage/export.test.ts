import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  defaultUserProfile,
  userSettingsRepository,
} from './repository'
import { exportUserData, importUserData } from './export'
import { dbPromise } from './db'
import type { UserDataExport } from './schema'

const exportedData = {
  schemaVersion: 1 as const,
  profile: {
    skills: { cooking: 3 },
    defaultCraftQuantity: 2,
    recommendationSort: 'NET_PROFIT' as const,
  },
  materials: [
    {
      itemId: 'flour',
      sourceMode: 'MIXED' as const,
      intermediateMode: 'BUY' as const,
      ownedQuantity: 4,
      purchasePackQuantity: 10,
      purchasePackPrice: 300,
      observedAt: '2026-09-16T12:00:00.000Z',
    },
  ],
  favorites: [{ dishItemId: 'pizza' }],
  catalogCache: {
    catalog: { version: '2026-09-16', items: [] },
    cachedAt: '2026-09-16T12:00:00.000Z',
    dataVersion: '2026-09-16',
  },
}

function sparseArray(): string[] {
  const values = [] as string[]
  values[1] = 'second item'
  return values
}

function decoratedArray(metadata: unknown): number[] {
  return Object.assign([1], { metadata }) as number[]
}

describe('user data transfer', () => {
  beforeEach(async () => {
    await userSettingsRepository.replaceAll({
      schemaVersion: 1,
      profile: defaultUserProfile,
      materials: [],
      favorites: [],
      catalogCache: null,
    })
  })

  it('round-trips all locally persisted user data through JSON export and import', async () => {
    await userSettingsRepository.replaceAll(exportedData)

    const json = await exportUserData()
    await userSettingsRepository.replaceAll({
      schemaVersion: 1,
      profile: defaultUserProfile,
      materials: [],
      favorites: [],
      catalogCache: null,
    })

    await importUserData(json)

    await expect(exportUserData()).resolves.toBe(json)
  })

  it('rejects invalid imported data without deleting existing settings', async () => {
    await userSettingsRepository.replaceAll(exportedData)

    await expect(
      importUserData(
        JSON.stringify({
          ...exportedData,
          materials: [{ ...exportedData.materials[0], sourceMode: 'INVALID' }],
        }),
      ),
    ).rejects.toThrow(/invalid/i)

    await expect(exportUserData()).resolves.toBe(JSON.stringify(exportedData))
  })

  it('rejects duplicate material records without deleting existing settings', async () => {
    await userSettingsRepository.replaceAll(exportedData)

    await expect(
      importUserData(
        JSON.stringify({
          ...exportedData,
          materials: [exportedData.materials[0], exportedData.materials[0]],
        }),
      ),
    ).rejects.toThrow(/invalid/i)

    await expect(exportUserData()).resolves.toBe(JSON.stringify(exportedData))
  })

  it('rejects future schema versions with a readable error', async () => {
    await expect(
      importUserData(JSON.stringify({ ...exportedData, schemaVersion: 2 })),
    ).rejects.toThrow('Unsupported user-data schema version: 2')
  })

  it.each([
    ['Date', new Date()],
    ['BigInt', BigInt(1)],
    ['function', () => undefined],
    ['sparse array', sparseArray()],
    ['decorated array with primitive metadata', decoratedArray('retained')],
    ['decorated array with function metadata', decoratedArray(() => undefined)],
  ])('rejects non-JSON %s catalog cache data before replacing existing settings', async (_, nonJsonValue) => {
    await userSettingsRepository.replaceAll(exportedData)
    const invalidCache = {
      ...exportedData,
      catalogCache: {
        ...exportedData.catalogCache,
        catalog: { generatedAt: nonJsonValue },
      },
    } as unknown as UserDataExport

    const database = await dbPromise
    const transactionSpy = vi.spyOn(database, 'transaction')
    try {
      await expect(userSettingsRepository.replaceAll(invalidCache)).rejects.toThrow()
      expect(transactionSpy).not.toHaveBeenCalled()
      await expect(exportUserData()).resolves.toBe(JSON.stringify(exportedData))
    } finally {
      transactionSpy.mockRestore()
    }
  })
})
