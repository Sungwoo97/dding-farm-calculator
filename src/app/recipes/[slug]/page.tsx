import { notFound } from 'next/navigation'

import type { CalculationScenario } from '@/features/calculator/domain/types'
import { DishBreakdown } from '@/features/calculator/ui/dish-breakdown'
import { getPublishedCatalog } from '@/features/catalog/server/repository'

export const dynamic = 'force-dynamic'

export default async function RecipeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ scenario?: string }>
}) {
  const catalog = await getPublishedCatalog(new Date())
  const { slug } = await params
  const query = await searchParams
  const dish = catalog.items.find((item) => item.slug === slug && item.category === 'DISH')
  if (!dish) notFound()

  const scenario: CalculationScenario = query.scenario === 'ALL_PURCHASE' ? 'ALL_PURCHASE' : 'ACTUAL'
  return <DishBreakdown catalog={catalog} dishId={dish.id} scenario={scenario} />
}
