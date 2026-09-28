import { z } from 'zod'
import { priceCycleDraftSchema, reasonSchema, type PriceCycleDraftInput, type PriceCycleValidation } from './schema'
export { validatePriceCycleDraft } from './schema'

interface RpcClient {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string } | null }>
}
export class PriceCycleValidationError extends Error {
  constructor() { super('게시할 수 없는 가격 주기입니다.') }
}

// Keep database internals out of application error responses.
function checkError(error: { code?: string } | null) {
  if (!error) return
  if (['23514', '23505', '23503', '23P01', '22023', '22P02', '22007', '22008', '22003', 'P0001'].includes(error.code ?? '')) throw new PriceCycleValidationError()
  throw new Error('가격 주기 처리에 실패했습니다.')
}

// The RPC creates the cycle, child prices, and immutable audit rows atomically.
export async function createPriceCycleDraft(input: PriceCycleDraftInput, client: RpcClient): Promise<string> {
  const normalized = priceCycleDraftSchema.parse(input)
  const { data, error } = await client.rpc('create_price_cycle_draft', { p_input: normalized })
  checkError(error)
  return z.uuid().parse(data)
}

// Publication always revalidates the current database state inside its transaction.
export async function publishPriceCycle(cycleId: string, reason: string, client: RpcClient): Promise<void> {
  const { error } = await client.rpc('publish_price_cycle', { p_cycle_id: z.uuid().parse(cycleId), p_reason: reasonSchema.parse(reason) })
  checkError(error)
}

export interface PriceCycleService {
  createDraft(input: PriceCycleDraftInput): Promise<string>
  validateDraft(cycleId: string): Promise<PriceCycleValidation>
  publish(cycleId: string, reason: string): Promise<void>
}

// Administrator identity is derived from the verified session, never a parameter.
export function createPriceCycleService(client: RpcClient): PriceCycleService {
  return {
    createDraft: (input) => createPriceCycleDraft(input, client),
    publish: (cycleId, reason) => publishPriceCycle(cycleId, reason, client),
    async validateDraft(cycleId) {
      const { data, error } = await client.rpc('validate_price_cycle_draft', { p_cycle_id: z.uuid().parse(cycleId) })
      checkError(error)
      return z.object({ valid: z.boolean(), errors: z.array(z.string()) }).parse(data)
    },
  }
}
