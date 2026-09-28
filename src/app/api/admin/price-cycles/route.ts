import { z } from 'zod'
import { AdminAccessError, requireAdmin } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'
import { priceCycleCommandSchema } from '@/features/admin-prices/schema'
import { createPriceCycleService, PriceCycleValidationError } from '@/features/admin-prices/service'

// Authenticate before parsing commands and expose only safe, fixed error messages.
export async function POST(request: Request) {
  try {
    const client = await createServerClient()
    await requireAdmin(client)
    let body: unknown
    try { body = await request.json() } catch { return Response.json({ error: '올바른 JSON이 필요합니다.' }, { status: 400 }) }
    const command = priceCycleCommandSchema.parse(body)
    const service = createPriceCycleService(client)
    if (command.type === 'CREATE_DRAFT') return Response.json({ cycleId: await service.createDraft(command.input) }, { status: 201 })
    await service.publish(command.cycleId, command.reason)
    return Response.json({ published: true })
  } catch (error) {
    if (error instanceof AdminAccessError) return Response.json({ error: error.message }, { status: error.status })
    if (error instanceof z.ZodError || error instanceof PriceCycleValidationError) return Response.json({ error: '입력값과 가격 주기의 게시 조건을 확인해 주세요.' }, { status: 400 })
    return Response.json({ error: '요청을 처리하지 못했습니다.' }, { status: 500 })
  }
}
