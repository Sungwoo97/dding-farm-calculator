import { beforeEach, describe, expect, it } from 'vitest'

import type { MaterialSetting } from '@/features/calculator/domain/types'

import {
  createUserSettingsRepository,
  defaultUserProfile,
} from './repository'

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

  it('restores a MIXED material setting from IndexedDB in a new repository instance', async () => {
    const writer = createUserSettingsRepository()
    await writer.saveMaterial(mixedMaterial)

    const reloadedRepository = createUserSettingsRepository()

    await expect(reloadedRepository.listMaterials()).resolves.toEqual([mixedMaterial])
  })
})
