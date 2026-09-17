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

export type JsonPrimitive = boolean | null | number | string
export type JsonValue = JsonObject | JsonPrimitive | JsonValue[]
export interface JsonObject {
  [key: string]: JsonValue
}

export interface CatalogCache {
  catalog: JsonObject
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

function isJsonValue(value: unknown, ancestors = new Set<object>()): value is JsonValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value !== 'object') return false
  if (ancestors.has(value)) return false

  const prototype = Object.getPrototypeOf(value)
  if (Array.isArray(value)) {
    ancestors.add(value)
    let valid = true
    const enumerableKeys = Reflect.ownKeys(value).filter((key) =>
      Object.prototype.propertyIsEnumerable.call(value, key),
    )
    if (enumerableKeys.length !== value.length) valid = false
    for (let index = 0; index < value.length; index += 1) {
      if (
        enumerableKeys[index] !== String(index) ||
        !Object.prototype.hasOwnProperty.call(value, index) ||
        !isJsonValue(value[index], ancestors)
      ) {
        valid = false
        break
      }
    }
    ancestors.delete(value)
    return valid
  }
  if (prototype !== Object.prototype && prototype !== null) return false

  ancestors.add(value)
  const valid = Object.values(value).every((entry) => isJsonValue(entry, ancestors))
  ancestors.delete(value)
  return valid
}

function isJsonObject(value: unknown): value is JsonObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    isJsonValue(value)
  )
}

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
  catalog: z.custom<JsonObject>(isJsonObject, 'Expected JSON object'),
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
