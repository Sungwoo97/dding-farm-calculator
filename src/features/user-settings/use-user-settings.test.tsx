import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

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
})
