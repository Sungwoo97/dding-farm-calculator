import type { MaterialSetting } from '@/features/calculator/domain/types'

import { dbPromise } from './db'
import {
  catalogCacheSchema,
  favoriteSchema,
  materialSettingSchema,
  userDataExportSchema,
  userProfileSchema,
  type CatalogCache,
  type Favorite,
  type UserDataExport,
  type UserProfile,
} from './schema'

const PROFILE_KEY = 'current'
const CATALOG_CACHE_KEY = 'current'

export const defaultUserProfile: UserProfile = {
  skills: {},
  defaultCraftQuantity: 1,
  recommendationSort: 'ROI',
}

export interface UserSettingsRepository {
  loadProfile(): Promise<UserProfile>
  saveProfile(profile: UserProfile): Promise<void>
  listMaterials(): Promise<MaterialSetting[]>
  saveMaterial(setting: MaterialSetting): Promise<void>
  listFavorites(): Promise<Favorite[]>
  saveFavorite(favorite: Favorite): Promise<void>
  replaceAll(data: UserDataExport): Promise<void>
  getCatalogCache(): Promise<CatalogCache | null>
  setCatalogCache(cache: CatalogCache): Promise<void>
}

class IndexedDbUserSettingsRepository implements UserSettingsRepository {
  async loadProfile(): Promise<UserProfile> {
    const database = await dbPromise
    return (await database.get('profile', PROFILE_KEY)) ?? defaultUserProfile
  }

  async saveProfile(profile: UserProfile): Promise<void> {
    const validProfile = userProfileSchema.parse(profile)
    const database = await dbPromise
    await database.put('profile', validProfile, PROFILE_KEY)
  }

  async listMaterials(): Promise<MaterialSetting[]> {
    const database = await dbPromise
    return (await database.getAll('materials')).sort((left, right) =>
      left.itemId.localeCompare(right.itemId),
    )
  }

  async saveMaterial(setting: MaterialSetting): Promise<void> {
    const validSetting = materialSettingSchema.parse(setting)
    const database = await dbPromise
    await database.put('materials', validSetting)
  }

  async listFavorites(): Promise<Favorite[]> {
    const database = await dbPromise
    return (await database.getAll('favorites')).sort((left, right) =>
      left.dishItemId.localeCompare(right.dishItemId),
    )
  }

  async saveFavorite(favorite: Favorite): Promise<void> {
    const validFavorite = favoriteSchema.parse(favorite)
    const database = await dbPromise
    await database.put('favorites', validFavorite)
  }

  async replaceAll(data: UserDataExport): Promise<void> {
    const validData = userDataExportSchema.parse(data)
    const database = await dbPromise
    const transaction = database.transaction(
      ['profile', 'materials', 'favorites', 'catalog_cache'],
      'readwrite',
    )

    try {
      await Promise.all([
        transaction.objectStore('profile').clear(),
        transaction.objectStore('materials').clear(),
        transaction.objectStore('favorites').clear(),
        transaction.objectStore('catalog_cache').clear(),
      ])

      await transaction.objectStore('profile').put(validData.profile, PROFILE_KEY)
      for (const material of validData.materials) {
        await transaction.objectStore('materials').put(material)
      }
      for (const favorite of validData.favorites) {
        await transaction.objectStore('favorites').put(favorite)
      }
      if (validData.catalogCache) {
        await transaction
          .objectStore('catalog_cache')
          .put(validData.catalogCache, CATALOG_CACHE_KEY)
      }

      await transaction.done
    } catch (error) {
      try {
        transaction.abort()
      } catch {
        // The transaction may already be inactive after a native IndexedDB error.
      }
      await transaction.done.catch(() => undefined)
      throw error
    }
  }

  async getCatalogCache(): Promise<CatalogCache | null> {
    const database = await dbPromise
    return (await database.get('catalog_cache', CATALOG_CACHE_KEY)) ?? null
  }

  async setCatalogCache(cache: CatalogCache): Promise<void> {
    const validCache = catalogCacheSchema.parse(cache)
    const database = await dbPromise
    await database.put('catalog_cache', validCache, CATALOG_CACHE_KEY)
  }
}

export function createUserSettingsRepository(): UserSettingsRepository {
  return new IndexedDbUserSettingsRepository()
}

export const userSettingsRepository = createUserSettingsRepository()
