import { openDB, type DBSchema } from 'idb'

import type {
  CatalogCache,
  Favorite,
  UserProfile,
} from './schema'
import type { MaterialSetting } from '@/features/calculator/domain/types'

export interface DdingFarmDb extends DBSchema {
  profile: {
    key: string
    value: UserProfile
  }
  materials: {
    key: string
    value: MaterialSetting
  }
  favorites: {
    key: string
    value: Favorite
  }
  catalog_cache: {
    key: string
    value: CatalogCache
  }
}

export const dbPromise = openDB<DdingFarmDb>('dding-farm', 1, {
  upgrade(db) {
    db.createObjectStore('profile')
    db.createObjectStore('materials', { keyPath: 'itemId' })
    db.createObjectStore('favorites', { keyPath: 'dishItemId' })
    db.createObjectStore('catalog_cache')
  },
})
