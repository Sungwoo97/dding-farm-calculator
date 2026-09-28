import { z } from 'zod'

export const CYCLE_DURATION_MS = 72 * 60 * 60 * 1000
const instant = z.iso.datetime({ offset: true }).refine((value) => Number.isFinite(Date.parse(value)))
export const reasonSchema = z.string().trim().min(1).max(2000)
export const priceSchema = z.strictObject({
  dishItemId: z.uuid(),
  basePrice: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  sourceNote: z.string().max(4000),
})
export const priceCycleDraftSchema = z.strictObject({
  startsAt: instant,
  endsAt: instant.optional(),
  sourceUrl: z.url().max(2000).refine((value) => /^https?:\/\//.test(value)),
  reason: reasonSchema,
  prices: z.array(priceSchema).max(10000),
}).superRefine((input, context) => {
  if (input.endsAt && Date.parse(input.endsAt) - Date.parse(input.startsAt) !== CYCLE_DURATION_MS) {
    context.addIssue({ code: 'custom', path: ['endsAt'], message: '가격 주기는 정확히 72시간이어야 합니다.' })
  }
  if (new Set(input.prices.map((price) => price.dishItemId)).size !== input.prices.length) {
    context.addIssue({ code: 'custom', path: ['prices'], message: '요리 가격이 중복되었습니다.' })
  }
}).transform((input) => ({ ...input, startsAt: new Date(input.startsAt).toISOString(), endsAt: new Date(Date.parse(input.startsAt) + CYCLE_DURATION_MS).toISOString() }))

export const priceCycleCommandSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('CREATE_DRAFT'), input: priceCycleDraftSchema }),
  z.strictObject({ type: z.literal('PUBLISH'), cycleId: z.uuid(), reason: reasonSchema }),
])
export type PriceCycleDraftInput = z.input<typeof priceCycleDraftSchema>
export interface AdminDish {
  id: string
  slug: string
  name: string
  officialMinPrice: number | null
  officialMaxPrice: number | null
}
export interface PublishedInterval { startsAt: string; endsAt: string }
export interface PriceCycleValidation { valid: boolean; errors: string[] }

// Validate preview data against the same configured bounds used in the database.
export function validatePriceCycleDraft(input: unknown, dishes: AdminDish[], published: PublishedInterval[]): PriceCycleValidation {
  const parsed = priceCycleDraftSchema.safeParse(input)
  if (!parsed.success) return { valid: false, errors: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`) }
  const draft = parsed.data
  const errors: string[] = []
  for (const dish of dishes) {
    const price = draft.prices.find((row) => row.dishItemId === dish.id)
    if (!price) errors.push(`${dish.name}: 가격이 필요합니다.`)
    else if (dish.officialMinPrice !== null && dish.officialMaxPrice !== null && (price.basePrice < dish.officialMinPrice || price.basePrice > dish.officialMaxPrice) && !price.sourceNote.trim()) errors.push(`${dish.name}: 공식 범위 밖의 가격에는 확인 근거가 필요합니다.`)
  }
  if (draft.prices.some((price) => !dishes.some((dish) => dish.id === price.dishItemId))) errors.push('활성 요리가 아닌 가격이 포함되었습니다.')
  if (published.some((cycle) => Date.parse(draft.startsAt) < Date.parse(cycle.endsAt) && Date.parse(cycle.startsAt) < Date.parse(draft.endsAt))) errors.push('게시된 가격 주기와 시간이 겹칩니다.')
  return { valid: errors.length === 0, errors }
}
