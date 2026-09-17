import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { defaultUserProfile, userSettingsRepository } from './storage/repository'
import { useUserSettings } from './use-user-settings'

describe('useUserSettings', () => {
  beforeEach(async () => {
    await userSettingsRepository.replaceAll({
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

  it('persists concurrent skill updates without losing either optimistic screen value', async () => {
    const { result } = renderHook(() => useUserSettings())

    await waitFor(() => expect(result.current.ready).toBe(true))

    await act(async () => {
      await Promise.all([
        result.current.updateSkill('cooking', 3),
        result.current.updateSkill('fishing', 2),
      ])
    })

    await expect(userSettingsRepository.loadProfile()).resolves.toMatchObject({
      skills: { cooking: 3, fishing: 2 },
    })
    expect(result.current.settings.profile.skills).toEqual({ cooking: 3, fishing: 2 })
  })

  it('keeps an optimistic skill value on save failure and exposes saveError', async () => {
    const { result } = renderHook(() => useUserSettings())

    expect(result.current.ready).toBe(false)
    await waitFor(() => expect(result.current.ready).toBe(true))

    await act(async () => {
      await result.current.updateSkill('cooking', -1)
    })

    expect(result.current.settings.profile.skills).toEqual({ cooking: -1 })
    expect(result.current.saveError).toMatch(/expected number to be >=0/i)
    await expect(userSettingsRepository.loadProfile()).resolves.toEqual(defaultUserProfile)
  })

  it('applies a skill update after an overlapping import has hydrated its profile', async () => {
    const { result } = renderHook(() => useUserSettings())
    await waitFor(() => expect(result.current.ready).toBe(true))

    let markReplacementComplete!: () => void
    const replacementComplete = new Promise<void>((resolve) => {
      markReplacementComplete = resolve
    })
    let releaseImport!: () => void
    const importBlocked = new Promise<void>((resolve) => {
      releaseImport = resolve
    })
    const replaceAll = userSettingsRepository.replaceAll.bind(userSettingsRepository)
    vi.spyOn(userSettingsRepository, 'replaceAll').mockImplementation(async (data) => {
      await replaceAll(data)
      markReplacementComplete()
      await importBlocked
    })

    const importedData = JSON.stringify({
      schemaVersion: 1,
      profile: {
        skills: { imported: 5 },
        defaultCraftQuantity: 4,
        recommendationSort: 'NAME',
      },
      materials: [],
      favorites: [],
      catalogCache: null,
    })

    const importPromise = result.current.importData(importedData)
    await replacementComplete
    const updatePromise = result.current.updateSkill('local', 2)
    releaseImport()

    await act(async () => {
      await Promise.all([importPromise, updatePromise])
    })

    await expect(userSettingsRepository.loadProfile()).resolves.toEqual({
      skills: { imported: 5, local: 2 },
      defaultCraftQuantity: 4,
      recommendationSort: 'NAME',
    })
  })
})
