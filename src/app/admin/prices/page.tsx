import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { AdminAccessError, requireAdmin } from '@/lib/supabase/admin'
import { loadPriceEditorData } from '@/features/admin-prices/editor-data'
import { PriceCycleEditor } from '@/features/admin-prices/ui/price-cycle-editor'

// Verify authorization before any private draft/catalog query is issued.
export default async function PricesPage() {
  const client = await createServerClient()
  try { await requireAdmin(client) } catch (error) {
    if (error instanceof AdminAccessError && error.status === 401) redirect('/admin/login')
    return <p role="alert">관리자 권한을 확인할 수 없습니다.</p>
  }
  let data: Awaited<ReturnType<typeof loadPriceEditorData>>
  try { data = await loadPriceEditorData(client) } catch {
    return <p role="alert">가격 편집 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
  }
  return <PriceCycleEditor {...data} />
}
