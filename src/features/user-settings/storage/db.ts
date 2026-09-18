import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

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

let dbPromise: Promise<IDBPDatabase<DdingFarmDb>> | undefined

export function getDb(): Promise<IDBPDatabase<DdingFarmDb>> {
  dbPromise ??= openDB<DdingFarmDb>('dding-farm', 1, {
    upgrade(db) {
      db.createObjectStore('profile')
      db.createObjectStore('materials', { keyPath: 'itemId' })
      db.createObjectStore('favorites', { keyPath: 'dishItemId' })
      db.createObjectStore('catalog_cache')
    },
  })
  return dbPromise
}
