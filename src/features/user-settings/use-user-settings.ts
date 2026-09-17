'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { MaterialSetting } from '@/features/calculator/domain/types'

import { exportUserData, importUserData } from './storage/export'
import {
  defaultUserProfile,
  userSettingsRepository,
} from './storage/repository'
import type { UserProfile } from './storage/schema'

export interface UserSettingsState {
  profile: UserProfile
  materials: Map<string, MaterialSetting>
}

export interface UseUserSettingsResult {
  settings: UserSettingsState
  ready: boolean
  saveError: string | null
  updateMaterial(setting: MaterialSetting): Promise<void>
  updateSkill(skillId: string, level: number): Promise<void>
  exportData(): Promise<string>
  importData(json: string): Promise<void>
}

const initialSettings: UserSettingsState = {
  profile: defaultUserProfile,
  materials: new Map(),
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to save user settings'
}

export function useUserSettings(): UseUserSettingsResult {
  const [settings, setSettings] = useState<UserSettingsState>(initialSettings)
  const settingsRef = useRef<UserSettingsState>(initialSettings)
  const [ready, setReady] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const hydrate = useCallback(async () => {
    const [profile, materials] = await Promise.all([
      userSettingsRepository.loadProfile(),
      userSettingsRepository.listMaterials(),
    ])
    const nextSettings = {
      profile,
      materials: new Map(materials.map((item) => [item.itemId, item])),
    }
    settingsRef.current = nextSettings
    setSettings(nextSettings)
  }, [])

  useEffect(() => {
    let active = true
    void hydrate()
      .catch((error: unknown) => {
        if (active) setSaveError(errorMessage(error))
      })
      .finally(() => {
        if (active) setReady(true)
      })
    return () => {
      active = false
    }
  }, [hydrate])

  const updateMaterial = useCallback(async (setting: MaterialSetting) => {
    const nextSettings = {
      ...settingsRef.current,
      materials: new Map(settingsRef.current.materials).set(setting.itemId, setting),
    }
    settingsRef.current = nextSettings
    setSettings(nextSettings)
    try {
      await userSettingsRepository.saveMaterial(setting)
      setSaveError(null)
    } catch (error) {
      setSaveError(errorMessage(error))
    }
  }, [])

  const updateSkill = useCallback(async (skillId: string, level: number) => {
    const profileToSave: UserProfile = {
      ...settingsRef.current.profile,
      skills: { ...settingsRef.current.profile.skills, [skillId]: level },
    }
    const nextSettings = { ...settingsRef.current, profile: profileToSave }
    settingsRef.current = nextSettings
    setSettings(nextSettings)
    try {
      await userSettingsRepository.saveProfile(profileToSave)
      setSaveError(null)
    } catch (error) {
      setSaveError(errorMessage(error))
    }
  }, [])

  const importData = useCallback(async (json: string) => {
    try {
      await importUserData(json)
      await hydrate()
      setSaveError(null)
    } catch (error) {
      setSaveError(errorMessage(error))
    }
  }, [hydrate])

  const exportData = useCallback(async () => {
    try {
      const data = await exportUserData()
      setSaveError(null)
      return data
    } catch (error) {
      const message = errorMessage(error)
      setSaveError(message)
      throw error
    }
  }, [])

  return { settings, ready, saveError, updateMaterial, updateSkill, importData, exportData }
}
