import { z } from 'zod'

import type { MaterialSetting } from '@/features/calculator/domain/types'

export const USER_DATA_SCHEMA_VERSION = 1

export interface UserProfile {
  skills: Record<string, number>
  defaultCraftQuantity: number
  recommendationSort: 'ROI' | 'NET_PROFIT' | 'NAME'
}

export interface Favorite {
  dishItemId: string
}

export interface CatalogCache {
  catalog: Record<string, unknown>
  cachedAt: string
  dataVersion: string
}

export interface UserDataExport {
  schemaVersion: typeof USER_DATA_SCHEMA_VERSION
  profile: UserProfile
  materials: MaterialSetting[]
  favorites: Favorite[]
  catalogCache: CatalogCache | null
}

const finiteNumber = z.number().finite()

export const userProfileSchema = z.object({
  skills: z.record(z.string().min(1), finiteNumber.int().nonnegative()),
  defaultCraftQuantity: finiteNumber.positive(),
  recommendationSort: z.enum(['ROI', 'NET_PROFIT', 'NAME']),
})

export const materialSettingSchema = z.object({
  itemId: z.string().min(1),
  sourceMode: z.enum(['SELF', 'PURCHASE', 'MIXED']),
  intermediateMode: z.enum(['MAKE', 'BUY', 'CHEAPEST']).optional(),
  ownedQuantity: finiteNumber.nonnegative(),
  purchasePackQuantity: finiteNumber.positive().optional(),
  purchasePackPrice: finiteNumber.nonnegative().optional(),
  observedAt: z.string().min(1).optional(),
})

export const favoriteSchema = z.object({
  dishItemId: z.string().min(1),
})

export const catalogCacheSchema = z.object({
  catalog: z.record(z.string(), z.unknown()),
  cachedAt: z.string().min(1),
  dataVersion: z.string().min(1),
})

const uniqueMaterialsSchema = z.array(materialSettingSchema).superRefine((materials, context) => {
  const itemIds = new Set<string>()
  for (const [index, material] of materials.entries()) {
    if (itemIds.has(material.itemId)) {
      context.addIssue({
        code: 'custom',
        message: `Duplicate material itemId: ${material.itemId}`,
        path: [index, 'itemId'],
      })
    }
    itemIds.add(material.itemId)
  }
})

const uniqueFavoritesSchema = z.array(favoriteSchema).superRefine((favorites, context) => {
  const dishItemIds = new Set<string>()
  for (const [index, favorite] of favorites.entries()) {
    if (dishItemIds.has(favorite.dishItemId)) {
      context.addIssue({
        code: 'custom',
        message: `Duplicate favorite dishItemId: ${favorite.dishItemId}`,
        path: [index, 'dishItemId'],
      })
    }
    dishItemIds.add(favorite.dishItemId)
  }
})

export const userDataExportSchema = z.object({
  schemaVersion: z.literal(USER_DATA_SCHEMA_VERSION),
  profile: userProfileSchema,
  materials: uniqueMaterialsSchema,
  favorites: uniqueFavoritesSchema,
  catalogCache: catalogCacheSchema.nullable(),
})
