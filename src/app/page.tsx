import { RecommendationDashboard } from '@/features/calculator/ui/recommendation-dashboard'
import { getPublishedCatalog } from '@/features/catalog/server/repository'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const catalog = await getPublishedCatalog(new Date())
  return <RecommendationDashboard catalog={catalog} />
}
