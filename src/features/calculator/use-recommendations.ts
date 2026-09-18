'use client'

import { useMemo } from 'react'

import type { PublishedCatalog } from '@/features/catalog/types'
import type { UserSettingsState } from '@/features/user-settings/use-user-settings'

import { calculateDish } from './domain/calculate-dish'
import { rankDishes } from './domain/recommend'
import type { CalculationScenario, DishCalculation, SkillProfile } from './domain/types'

export interface RecommendationSet {
  scenario: CalculationScenario
  ranked: DishCalculation[]
  unavailable: DishCalculation[]
  lastCalculatedAt: string
}

export function selectedSkillProfile(
  catalog: PublishedCatalog,
  settings: UserSettingsState,
): SkillProfile {
  return {
    effects: catalog.skills.flatMap((skill) => {
      const selectedLevel = settings.profile.skills[skill.id] ?? 0
      const level = skill.levels.find((candidate) => candidate.level === selectedLevel)
      return level ? [level.effect] : []
    }),
  }
}

export function useRecommendations(
  catalog: PublishedCatalog,
  settings: UserSettingsState,
): { allPurchase: RecommendationSet; actual: RecommendationSet } {
  const lookups = useMemo(() => ({
    dishes: catalog.items.filter((item) => item.category === 'DISH'),
    itemNames: new Map(catalog.items.map((item) => [item.id, item.name])),
    prices: new Map(catalog.prices.map((price) => [price.dishItemId, price.basePrice])),
  }), [catalog])

  const skillProfile = useMemo(
    () => selectedSkillProfile(catalog, settings),
    [catalog, settings],
  )

  return useMemo(() => {
    const lastCalculatedAt = new Date().toISOString()
    const itemName = (itemId: string) => lookups.itemNames.get(itemId) ?? itemId

    const build = (scenario: CalculationScenario): RecommendationSet => {
      const calculations = lookups.dishes.map((dish) => calculateDish({
        dishId: dish.id,
        scenario,
        craftQuantity: settings.profile.defaultCraftQuantity,
        basePrice: lookups.prices.get(dish.id) ?? null,
        catalog,
        settings: settings.materials,
        skillProfile,
      }))
      const ranked = rankDishes(
        calculations,
        scenario === 'ALL_PURCHASE' ? 'ROI' : 'NET_PROFIT',
        itemName,
      )
      const rankedIds = new Set(ranked.map((calculation) => calculation.dishId))

      return {
        scenario,
        ranked,
        unavailable: calculations.filter((calculation) => !rankedIds.has(calculation.dishId)),
        lastCalculatedAt,
      }
    }

    return {
      allPurchase: build('ALL_PURCHASE'),
      actual: build('ACTUAL'),
    }
  }, [catalog, lookups, settings, skillProfile])
}
