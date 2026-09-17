# 띵타이쿤 재배전문가 요리 수익 계산기 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 재료 조달 방식과 구매 가격을 입력하면 현재 3일 가격 주기의 모든 요리 수익을 계산하고 가장 효율적인 요리를 추천하는 반응형 Next.js 웹앱을 구축한다.

**Architecture:** Next.js App Router가 공개 카탈로그와 관리자 기능을 제공하고, Supabase PostgreSQL이 공통 레시피·스킬·가격 주기를 저장한다. 계산 엔진은 UI와 저장소에서 분리된 순수 TypeScript 모듈이며, 사용자별 스킬·재료 가격·보유량은 IndexedDB에 저장한다.

**Tech Stack:** Node.js 20.9 이상, Next.js App Router, React, TypeScript, CSS Modules, Supabase, IndexedDB(`idb`), Zod, Decimal.js, Vitest, React Testing Library, Playwright

**Spec:** `docs/superpowers/specs/2026-09-16-dding-farm-profit-calculator-design.md`

## Global Constraints

- 일반 사용자는 회원가입 없이 사용할 수 있어야 한다.
- 공통 레시피·스킬·가격은 공개 읽기만 허용하고 관리자만 변경할 수 있어야 한다.
- 사용자별 스킬·재료 가격·보유량은 IndexedDB에 저장한다.
- 요리 가격 주기는 Asia/Seoul 기준 `[starts_at, ends_at)` 72시간 구간이다.
- 추천 결과에 구매비용, 직접 준비할 재료, 판매금액, 순이익, 수익률과 계산 불가 사유를 표시한다.
- Primary는 `#496B57`, Secondary는 `#C65A46`, 배경은 `#FAF7F2`, 기본 글자는 `#2D2925`를 사용한다.
- PC를 우선하되 320px 이상 화면에서 핵심 기능이 가로 잘림 없이 동작해야 한다.
- 구현은 테스트를 먼저 작성하고 실패를 확인한 뒤 최소 코드를 작성한다.
- `NEXT_PUBLIC_USE_FIXTURES=1`은 로컬 개발과 E2E에서만 허용하며 프로덕션 빌드에서는 Supabase 설정 누락을 오류로 처리한다.

---

## File Structure

```text
src/
├─ app/
│  ├─ admin/login/page.tsx
│  ├─ admin/prices/page.tsx
│  ├─ api/admin/price-cycles/route.ts
│  ├─ materials/page.tsx
│  ├─ recipes/[slug]/page.tsx
│  ├─ settings/page.tsx
│  ├─ globals.css
│  ├─ layout.tsx
│  └─ page.tsx
├─ components/
│  ├─ app-shell/
│  └─ ui/
├─ features/
│  ├─ admin-prices/
│  ├─ calculator/
│  │  ├─ domain/
│  │  └─ ui/
│  ├─ catalog/
│  │  ├─ server/
│  │  └─ types.ts
│  └─ user-settings/
│     ├─ storage/
│     └─ ui/
└─ lib/
   ├─ env.ts
   └─ supabase/
supabase/
├─ migrations/202609160001_initial_schema.sql
└─ seed.sql
e2e/
├─ admin-price-cycle.spec.ts
└─ recommendation-flow.spec.ts
```

---

### Task 1: Next.js 및 테스트 기반 구성

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `eslint.config.mjs`
- Create: `vitest.config.mts`
- Create: `vitest.setup.ts`
- Create: `playwright.config.ts`
- Create: `.env.example`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`
- Create: `src/app/page.test.tsx`

**Interfaces:**
- Produces: `npm run dev`, `npm run test`, `npm run test:e2e`, `npm run lint`, `npm run build`
- Produces: 전역 CSS 토큰 `--primary`, `--secondary`, `--background`, `--foreground`

- [ ] **Step 1: 런타임 버전 확인**

Run:

```powershell
node --version
npm --version
```

Expected: Node.js `20.9.0` 이상과 npm 버전이 출력된다. 조건을 만족하지 않으면 코드를 작성하지 않고 Node.js를 먼저 갱신한다.

- [ ] **Step 2: 최소 패키지 파일 작성 후 의존성 설치**

Create `package.json` with:

```json
{
  "name": "dding-farm-profit-calculator",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  }
}
```

Run:

```powershell
npm install next@latest react@latest react-dom@latest @supabase/supabase-js @supabase/ssr idb zod decimal.js
npm install --save-dev typescript @types/node @types/react @types/react-dom eslint eslint-config-next vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom @testing-library/jest-dom vite-tsconfig-paths @playwright/test
```

Expected: `package-lock.json`이 생성되고 설치 오류가 없다.

- [ ] **Step 3: 페이지 렌더링 실패 테스트 작성**

Create `src/app/page.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import HomePage from './page'

describe('HomePage', () => {
  it('오늘의 추천 제목을 표시한다', () => {
    render(<HomePage />)
    expect(screen.getByRole('heading', { name: '오늘의 추천' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: 테스트를 실행해 실패 확인**

Run: `npm test -- src/app/page.test.tsx`

Expected: `src/app/page.tsx` 또는 테스트 설정이 없어 FAIL.

- [ ] **Step 5: TypeScript, Vitest, Next.js 최소 설정 작성**

Configure `tsconfig.json` with strict mode and `@/* -> ./src/*`; configure `vitest.config.mts` with `jsdom`, React, `vite-tsconfig-paths`, and `vitest.setup.ts`; configure Playwright with `baseURL: http://127.0.0.1:3000` and a fixture-mode web server.

Create `src/app/page.tsx`:

```tsx
export default function HomePage() {
  return <h1>오늘의 추천</h1>
}
```

Create `src/app/layout.tsx` with `lang="ko"` and import `globals.css`.

- [ ] **Step 6: 디자인 토큰 작성**

Create `src/app/globals.css` with:

```css
:root {
  --primary: #496b57;
  --primary-foreground: #ffffff;
  --secondary: #c65a46;
  --secondary-foreground: #ffffff;
  --background: #faf7f2;
  --foreground: #2d2925;
  --surface: #ffffff;
  --border: #e7ded3;
  --muted: #6c665f;
  --warning: #9a6816;
  --danger: #963c36;
}

* { box-sizing: border-box; }
body { margin: 0; background: var(--background); color: var(--foreground); }
button, input, select { font: inherit; }
```

- [ ] **Step 7: 기반 검증**

Run:

```powershell
npm test
npm run lint
npm run build
```

Expected: 모두 종료 코드 0.

- [ ] **Step 8: 커밋**

```powershell
git add package.json package-lock.json tsconfig.json next.config.ts eslint.config.mjs vitest.config.mts vitest.setup.ts playwright.config.ts .env.example src/app
git commit -m "chore: scaffold Next.js calculator app"
```

---

### Task 2: 구매비용 계산 도메인 구현

**Files:**
- Create: `src/features/calculator/domain/types.ts`
- Create: `src/features/calculator/domain/procurement.ts`
- Test: `src/features/calculator/domain/procurement.test.ts`

**Interfaces:**
- Produces: `MaterialSetting`, `PurchaseCostResult`
- Produces: `calculatePurchaseCost(requiredQuantity, setting): PurchaseCostResult`

- [ ] **Step 1: 도메인 타입과 실패 테스트 작성**

Create `src/features/calculator/domain/types.ts`:

```ts
export type SourceMode = 'SELF' | 'PURCHASE' | 'MIXED'
export type IntermediateMode = 'MAKE' | 'BUY' | 'CHEAPEST'

export interface MaterialSetting {
  itemId: string
  sourceMode: SourceMode
  intermediateMode?: IntermediateMode
  ownedQuantity: number
  purchasePackQuantity?: number
  purchasePackPrice?: number
  observedAt?: string
}

export interface PurchaseCostResult {
  requiredQuantity: number
  purchaseQuantity: number
  consumedCost: number
  cashOutlay: number
  leftoverQuantity: number
  unitPrice: number | null
  errors: string[]
}
```

Create `procurement.test.ts` with cases:

```ts
import { describe, expect, it } from 'vitest'
import { calculatePurchaseCost } from './procurement'

describe('calculatePurchaseCost', () => {
  it('직접 수확은 구매비용이 없다', () => {
    expect(calculatePurchaseCost(30, {
      itemId: 'onion', sourceMode: 'SELF', ownedQuantity: 0,
    })).toMatchObject({ purchaseQuantity: 0, consumedCost: 0, cashOutlay: 0 })
  })

  it('64개 1200G 묶음에서 10개 사용 원가와 잔량을 계산한다', () => {
    expect(calculatePurchaseCost(10, {
      itemId: 'tomato', sourceMode: 'PURCHASE', ownedQuantity: 0,
      purchasePackQuantity: 64, purchasePackPrice: 1200,
    })).toMatchObject({ purchaseQuantity: 10, consumedCost: 187.5, cashOutlay: 1200, leftoverQuantity: 54 })
  })

  it('혼합 조달은 보유량을 제외한 부족분만 구매한다', () => {
    expect(calculatePurchaseCost(30, {
      itemId: 'garlic', sourceMode: 'MIXED', ownedQuantity: 18,
      purchasePackQuantity: 32, purchasePackPrice: 1000,
    })).toMatchObject({ purchaseQuantity: 12, consumedCost: 375, cashOutlay: 1000, leftoverQuantity: 20 })
  })

  it('구매 묶음 값이 유효하지 않으면 오류를 반환한다', () => {
    expect(calculatePurchaseCost(1, {
      itemId: 'oil', sourceMode: 'PURCHASE', ownedQuantity: 0,
      purchasePackQuantity: 0, purchasePackPrice: 10,
    }).errors).toContain('구매 묶음 수량은 0보다 커야 합니다.')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- procurement.test.ts`

Expected: `calculatePurchaseCost`가 없어 FAIL.

- [ ] **Step 3: Decimal.js 기반 최소 구현**

Implement this exact public signature and branch structure:

```ts
export function calculatePurchaseCost(
  requiredQuantity: number,
  setting: MaterialSetting,
): PurchaseCostResult {
  if (setting.sourceMode === 'SELF') return zeroPurchase(requiredQuantity)

  const purchaseQuantity = setting.sourceMode === 'MIXED'
    ? Math.max(0, requiredQuantity - setting.ownedQuantity)
    : requiredQuantity
  const validation = validatePack(setting)
  if (validation.length > 0) return invalidPurchase(requiredQuantity, purchaseQuantity, validation)

  const packQuantity = new Decimal(setting.purchasePackQuantity!)
  const packPrice = new Decimal(setting.purchasePackPrice!)
  const unitPrice = packPrice.div(packQuantity)
  const packsToBuy = new Decimal(purchaseQuantity).div(packQuantity).ceil()

  return {
    requiredQuantity,
    purchaseQuantity,
    unitPrice: unitPrice.toNumber(),
    consumedCost: unitPrice.mul(purchaseQuantity).toNumber(),
    cashOutlay: packsToBuy.mul(packPrice).toNumber(),
    leftoverQuantity: packsToBuy.mul(packQuantity).minus(purchaseQuantity).toNumber(),
    errors: [],
  }
}
```

`zeroPurchase`, `validatePack`, and `invalidPurchase` stay private to `procurement.ts`. They must always return finite numeric fields and Korean validation messages, never `NaN` or `Infinity`.

- [ ] **Step 4: 테스트와 타입 검사**

Run:

```powershell
npm test -- procurement.test.ts
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: 커밋**

```powershell
git add src/features/calculator/domain
git commit -m "feat: calculate material purchase costs"
```

---

### Task 3: 레시피 확장과 중간재 비용 선택

**Files:**
- Modify: `src/features/calculator/domain/types.ts`
- Create: `src/features/calculator/domain/recipe-tree.ts`
- Test: `src/features/calculator/domain/recipe-tree.test.ts`

**Interfaces:**
- Produces: `Item`, `Recipe`, `RecipeIngredient`, `Catalog`
- Produces: `expandRecipe(outputItemId, outputQuantity, catalog, settings): ExpandedRecipe`
- Produces: `RecipeCycleError`

- [ ] **Step 1: 카탈로그 타입 추가**

Add:

```ts
export interface Item {
  id: string
  slug: string
  name: string
  category: 'RAW' | 'PROCESSED' | 'DISH' | 'FIXED_INGREDIENT'
  tradeable: boolean
}

export interface RecipeIngredient { itemId: string; quantity: number }
export interface Recipe {
  id: string
  outputItemId: string
  outputQuantity: number
  ingredients: RecipeIngredient[]
}
export interface Catalog { items: Item[]; recipes: Recipe[] }
```

- [ ] **Step 2: 실패 테스트 작성**

Test a dish requiring `tomato-base`, where one base outputs 2 and requires 4 tomatoes. Requesting 3 bases must round recipe batches up to 2 and require 8 tomatoes. Add tests that `BUY` stops recursion, `CHEAPEST` chooses the lower of purchased intermediate cost and expanded raw cost, and `a -> b -> a` throws `RecipeCycleError`.

- [ ] **Step 3: 실패 확인**

Run: `npm test -- recipe-tree.test.ts`

Expected: module missing FAIL.

- [ ] **Step 4: 재귀 확장 구현**

Implement recipe lookup maps once per call, track the active recursion path in a `Set`, calculate required batches with `Math.ceil(requested / recipe.outputQuantity)`, merge equal leaf items, and preserve an explanation tree for the detail page.

For `CHEAPEST`, calculate both valid branches; if either branch lacks price data choose the valid branch, and if both are invalid return a structured missing-price error.

Use this public result shape and recursion boundary:

```ts
export interface ExpandedRecipe {
  leaves: Array<{ itemId: string; quantity: number }>
  tree: RecipeCostNode
  errors: string[]
}

export function expandRecipe(
  outputItemId: string,
  outputQuantity: number,
  catalog: Catalog,
  settings: Map<string, MaterialSetting>,
): ExpandedRecipe {
  const context = createExpansionContext(catalog, settings)
  return expandNode(outputItemId, outputQuantity, context, new Set())
}
```

`expandNode` must add `itemId` to the active path before descending and remove it in `finally`. Encountering an existing active ID throws `new RecipeCycleError([...activePath, itemId])`.

- [ ] **Step 5: 테스트 실행**

Run:

```powershell
npm test -- recipe-tree.test.ts
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 6: 커밋**

```powershell
git add src/features/calculator/domain
git commit -m "feat: expand nested cooking recipes"
```

---

### Task 4: 스킬 적용, 요리 수익, 추천 순위

**Files:**
- Modify: `src/features/calculator/domain/types.ts`
- Create: `src/features/calculator/domain/sale-price.ts`
- Create: `src/features/calculator/domain/calculate-dish.ts`
- Create: `src/features/calculator/domain/recommend.ts`
- Test: `src/features/calculator/domain/sale-price.test.ts`
- Test: `src/features/calculator/domain/calculate-dish.test.ts`
- Test: `src/features/calculator/domain/recommend.test.ts`

**Interfaces:**
- Produces: `SkillEffect`, `SkillProfile`, `CalculationScenario`, `DishCalculation`, `RankedDish`
- Produces: `applySalePriceRules(basePrice, quantity, effects): number`
- Produces: `calculateDish(input): DishCalculation`
- Produces: `rankDishes(calculations, sort): RankedDish[]`

- [ ] **Step 1: 스킬과 결과 타입 작성**

Define effect types `SELL_PRICE_MULTIPLIER`, `BULK_SALE_MULTIPLIER`, `EXPECTED_EXTRA_OUTPUT`, with `value`, `order`, optional `minimumQuantity`, and `rounding: 'FLOOR' | 'ROUND' | 'CEIL' | 'NONE'`.

Define `DishCalculation` with:

```ts
export interface DishCalculation {
  dishId: string
  scenario: 'ALL_PURCHASE' | 'ACTUAL'
  craftQuantity: number
  saleRevenue: number | null
  consumedPurchaseCost: number | null
  cashOutlay: number | null
  netProfit: number | null
  purchaseRoi: number | null
  selfSupplied: Array<{ itemId: string; quantity: number }>
  leftovers: Array<{ itemId: string; quantity: number }>
  errors: string[]
}
```

- [ ] **Step 2: 실패 테스트 작성**

Cover these exact cases:

- base price 1,000, sell multiplier 15%, quantity 1 => 1,150
- bulk multiplier 3%, minimum 3, quantity 2 => no bulk bonus
- same bulk multiplier, quantity 3 => configured order and rounding applied
- expected extra output 25% applied to output quantity => expected revenue and required recipe batches use the documented expected quantity without converting it to a guaranteed integer drop
- purchase cost 0 => ROI is `null` and not Infinity
- missing ingredient price => revenue may exist but profit is `null` and result has an error
- ranking excludes errored calculations and sorts equal values by Korean dish name for deterministic output

- [ ] **Step 3: 실패 확인**

Run: `npm test -- sale-price.test.ts calculate-dish.test.ts recommend.test.ts`

Expected: missing module FAIL.

- [ ] **Step 4: 판매가 계산 구현**

Sort active effects by `order`, apply only effects whose quantity condition matches, and apply the configured rounding after each effect. Do not embed any game-specific multiplier in component code.

```ts
export function applySalePriceRules(
  basePrice: number,
  quantity: number,
  effects: SkillEffect[],
): number {
  const unitPrice = effects
    .filter((effect) => quantity >= (effect.minimumQuantity ?? 0))
    .sort((a, b) => a.order - b.order)
    .reduce((price, effect) => roundDecimal(
      price.mul(new Decimal(1).plus(effect.value)), effect.rounding,
    ), new Decimal(basePrice))

  return unitPrice.mul(quantity).toNumber()
}
```

- [ ] **Step 5: 요리 계산과 순위 구현**

`ALL_PURCHASE` temporarily treats all tradeable leaf materials as `PURCHASE`; `ACTUAL` preserves user settings. Sum consumed costs and cash outlays, return `null` for unavailable metrics, and never rank invalid calculations.

```ts
export function rankDishes(
  calculations: DishCalculation[],
  sort: 'ROI' | 'NET_PROFIT' | 'NAME',
  itemName: (itemId: string) => string,
): DishCalculation[] {
  return calculations
    .filter((result) => result.errors.length === 0 && result.netProfit !== null)
    .toSorted((left, right) => compareDishResult(left, right, sort, itemName))
}
```

`compareDishResult` must place `null` ROI after numeric ROI and use `itemName(left.dishId).localeCompare(itemName(right.dishId), 'ko')` as the final tie-breaker.

- [ ] **Step 6: 도메인 테스트 실행**

Run:

```powershell
npm test -- src/features/calculator/domain
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 7: 커밋**

```powershell
git add src/features/calculator/domain
git commit -m "feat: rank dishes by purchase profitability"
```

---

### Task 5: IndexedDB 사용자 설정 저장소

**Files:**
- Create: `src/features/user-settings/storage/schema.ts`
- Create: `src/features/user-settings/storage/db.ts`
- Create: `src/features/user-settings/storage/repository.ts`
- Create: `src/features/user-settings/storage/export.ts`
- Create: `src/features/user-settings/use-user-settings.ts`
- Test: `src/features/user-settings/storage/repository.test.ts`
- Test: `src/features/user-settings/storage/export.test.ts`

**Interfaces:**
- Produces: `UserSettingsRepository`
- Produces: `exportUserData(): Promise<string>`
- Produces: `importUserData(json: string): Promise<void>`
- Produces: `useUserSettings()` returning `{ settings, ready, updateMaterial, updateSkill, importData, exportData }`

- [ ] **Step 1: fake IndexedDB 테스트 환경 추가**

Run: `npm install --save-dev fake-indexeddb`

Import `fake-indexeddb/auto` from `vitest.setup.ts`.

- [ ] **Step 2: 저장·복원·마이그레이션 실패 테스트 작성**

Test that a `MIXED` material setting survives a repository reload, export/import round-trips unchanged, invalid Zod input is rejected without deleting existing values, and unsupported future schema versions return a readable error.

- [ ] **Step 3: 실패 확인**

Run: `npm test -- src/features/user-settings`

Expected: repository modules missing FAIL.

- [ ] **Step 4: DB 및 저장소 구현**

Create IndexedDB database `dding-farm` with stores `profile`, `materials`, `favorites`, and `catalog_cache`. Set schema version to `1`. Validate every imported record with Zod before opening a write transaction.

```ts
export interface UserSettingsRepository {
  loadProfile(): Promise<UserProfile>
  saveProfile(profile: UserProfile): Promise<void>
  listMaterials(): Promise<MaterialSetting[]>
  saveMaterial(setting: MaterialSetting): Promise<void>
  replaceAll(data: UserDataExport): Promise<void>
  getCatalogCache(): Promise<CatalogCache | null>
  setCatalogCache(cache: CatalogCache): Promise<void>
}

export const dbPromise = openDB<DdingFarmDb>('dding-farm', 1, {
  upgrade(db) {
    db.createObjectStore('profile')
    db.createObjectStore('materials', { keyPath: 'itemId' })
    db.createObjectStore('favorites', { keyPath: 'dishItemId' })
    db.createObjectStore('catalog_cache')
  },
})
```

- [ ] **Step 5: React hook 구현**

The hook must expose `ready=false` until IndexedDB hydration finishes, use immutable updates, persist after state change, and surface a non-destructive `saveError` without clearing screen state.

```ts
export interface UseUserSettingsResult {
  settings: UserSettingsState
  ready: boolean
  saveError: string | null
  updateMaterial(setting: MaterialSetting): Promise<void>
  updateSkill(skillId: string, level: number): Promise<void>
  exportData(): Promise<string>
  importData(json: string): Promise<void>
}
```

- [ ] **Step 6: 테스트 실행**

Run:

```powershell
npm test -- src/features/user-settings
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 7: 커밋**

```powershell
git add package.json package-lock.json vitest.setup.ts src/features/user-settings
git commit -m "feat: persist local calculator settings"
```

---

### Task 6: Supabase 스키마, RLS, 시드 데이터

**Files:**
- Create: `supabase/migrations/202609160001_initial_schema.sql`
- Create: `supabase/seed.sql`
- Create: `src/features/catalog/types.ts`
- Create: `src/lib/env.ts`
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/features/catalog/server/repository.ts`
- Create: `src/features/catalog/server/fixture-catalog.ts`
- Test: `src/features/catalog/server/repository.test.ts`

**Interfaces:**
- Produces: `getPublishedCatalog(now: Date): Promise<PublishedCatalog>`
- Produces: `PublishedCatalog` containing items, recipes, active cycle, prices, skills, and `dataVersion`

- [ ] **Step 1: Supabase CLI와 환경 검증 추가**

Run: `npm install --save-dev supabase`

Create `.env.example`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_USE_FIXTURES=1
```

Create `src/lib/env.ts` with a Zod union: fixture mode may omit Supabase values; non-fixture mode requires both.

- [ ] **Step 2: 저장소 실패 테스트 작성**

Mock a Supabase client response and test that `getPublishedCatalog` selects exactly one `PUBLISHED` cycle satisfying `starts_at <= now < ends_at`, maps rows into the domain `Catalog`, and throws `NoActivePriceCycleError` when none exists.

- [ ] **Step 3: 실패 확인**

Run: `npm test -- repository.test.ts`

Expected: repository missing FAIL.

- [ ] **Step 4: SQL 스키마와 제약 작성**

Create tables from the spec with UUID primary keys, positive checks on quantities and prices, unique `(cycle_id, dish_item_id)`, foreign keys, and an exclusion constraint preventing overlapping published `tstzrange(starts_at, ends_at, '[)')` periods.

Enable RLS on every table. Add public `SELECT` policies for active catalog and published price data. Add write policies requiring JWT claim `app_metadata.role = 'admin'`. Do not create a browser-accessible service-role client.

Use this policy pattern for every administrator-writable table:

```sql
create policy "public can read published price cycles"
on public.price_cycles for select
using (status = 'PUBLISHED');

create policy "admins can manage price cycles"
on public.price_cycles for all to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
```

Use a `tstzrange` exclusion constraint with `gist` for published-cycle overlap and SQL `check (ends_at = starts_at + interval '72 hours')`.

- [ ] **Step 5: 최소 시드 작성**

Seed three representative dishes, their raw/intermediate ingredients, one nested recipe, one active 72-hour fixture cycle, base prices, and two supported skill levels. Mark every seed row with a source URL and fixed verified timestamp so tests are deterministic.

- [ ] **Step 6: 저장소 및 fixture 모드 구현**

`fixture-catalog.ts` exports the same `PublishedCatalog` shape as Supabase. `repository.ts` uses fixtures only when `NEXT_PUBLIC_USE_FIXTURES=1`; otherwise it creates a server Supabase client and validates mapped output with Zod.

```ts
export async function getPublishedCatalog(now: Date): Promise<PublishedCatalog> {
  if (env.NEXT_PUBLIC_USE_FIXTURES === '1') return getFixtureCatalog(now)
  const client = await createServerClient()
  const rows = await selectPublishedCatalogRows(client, now.toISOString())
  return publishedCatalogSchema.parse(mapPublishedCatalog(rows))
}
```

- [ ] **Step 7: 로컬 DB 및 테스트 검증**

Run:

```powershell
npx supabase start
npx supabase db reset
npm test -- repository.test.ts
```

Expected: migrations and seed succeed; repository tests PASS. If Docker is unavailable, run the TypeScript tests now and record the Supabase reset as required before Task 10 completion.

- [ ] **Step 8: 커밋**

```powershell
git add package.json package-lock.json .env.example supabase src/lib src/features/catalog
git commit -m "feat: add shared recipe and price catalog"
```

---

### Task 7: 반응형 앱 셸과 재료 가격 입력

**Files:**
- Create: `src/components/app-shell/app-shell.tsx`
- Create: `src/components/app-shell/app-shell.module.css`
- Create: `src/components/ui/field-error.tsx`
- Create: `src/features/user-settings/ui/material-price-table.tsx`
- Create: `src/features/user-settings/ui/material-price-table.module.css`
- Create: `src/features/user-settings/ui/material-price-card.tsx`
- Create: `src/features/user-settings/ui/settings-form.tsx`
- Create: `src/app/materials/page.tsx`
- Create: `src/app/settings/page.tsx`
- Modify: `src/app/layout.tsx`
- Test: `src/features/user-settings/ui/material-price-table.test.tsx`

**Interfaces:**
- Consumes: `useUserSettings()`, `MaterialSetting`, catalog items
- Produces: accessible user input pages for material settings and skills

- [ ] **Step 1: 재료 입력 컴포넌트 실패 테스트 작성**

Render one tomato row and assert:

- selecting `전부 구매` reveals labeled pack quantity and price inputs
- entering `64` and `1200` displays `18.75 G/개`
- selecting `직접 수확` hides purchase inputs
- invalid zero quantity displays `구매 묶음 수량은 0보다 커야 합니다.` with `role="alert"`

- [ ] **Step 2: 실패 확인**

Run: `npm test -- material-price-table.test.tsx`

Expected: component missing FAIL.

- [ ] **Step 3: 앱 셸 구현**

Implement desktop left navigation and mobile bottom navigation with the approved five routes. The current route must have text and `aria-current="page"`; selection must not rely on color alone.

```tsx
const navigation = [
  { href: '/', label: '오늘의 추천' },
  { href: '/materials', label: '재료 가격' },
  { href: '/settings', label: '내 설정' },
] as const

export function AppShell({ children }: { children: React.ReactNode }) {
  return <div className={styles.shell}>
    <AppNavigation items={navigation} />
    <main id="main-content">{children}</main>
  </div>
}
```

- [ ] **Step 4: 입력 UI 구현**

Use a semantic table at widths above 768px and cards below it. Reuse `calculatePurchaseCost` for unit-price previews so UI math cannot diverge from result math. Ensure input font size is at least 16px on mobile and controls have a minimum 44px touch target.

`MaterialPriceTable` accepts only data and callbacks, not a storage dependency:

```tsx
export interface MaterialPriceTableProps {
  items: Item[]
  settings: Map<string, MaterialSetting>
  onChange(setting: MaterialSetting): void
}
```

- [ ] **Step 5: 내 설정 화면 구현**

Render only skill definitions provided by the catalog. Use labeled selects from level 0 to max level, show each level's verified effect text, and persist through `useUserSettings`.

- [ ] **Step 6: 컴포넌트와 정적 검증**

Run:

```powershell
npm test -- src/features/user-settings/ui
npm run lint
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 7: 커밋**

```powershell
git add src/app src/components src/features/user-settings/ui
git commit -m "feat: add responsive material and skill inputs"
```

---

### Task 8: 오늘의 추천과 요리 상세 화면

**Files:**
- Create: `src/features/calculator/ui/recommendation-dashboard.tsx`
- Create: `src/features/calculator/ui/recommendation-dashboard.module.css`
- Create: `src/features/calculator/ui/scenario-tabs.tsx`
- Create: `src/features/calculator/ui/ranking-table.tsx`
- Create: `src/features/calculator/ui/recommendation-card.tsx`
- Create: `src/features/calculator/ui/cycle-banner.tsx`
- Create: `src/features/calculator/ui/dish-breakdown.tsx`
- Create: `src/features/calculator/use-recommendations.ts`
- Modify: `src/app/page.tsx`
- Create: `src/app/recipes/[slug]/page.tsx`
- Test: `src/features/calculator/ui/recommendation-dashboard.test.tsx`
- Test: `src/features/calculator/ui/dish-breakdown.test.tsx`

**Interfaces:**
- Consumes: `PublishedCatalog`, local settings, `calculateDish`, `rankDishes`
- Produces: `오늘의 추천`, scenario switching, deterministic detail breakdown

- [ ] **Step 1: 추천 화면 실패 테스트 작성**

With a fixed catalog and material settings, assert that:

- `전부 구매 효율` starts selected
- valid dishes are ordered by ROI
- switching to `내 실제 조달` orders by net profit
- a missing ingredient price shows `가격 입력 필요` and is absent from ranked rows
- expired cycle shows `이전 주기 참고값`
- zero purchase cost shows `구매비용 없음`, never `Infinity`

- [ ] **Step 2: 실패 확인**

Run: `npm test -- recommendation-dashboard.test.tsx dish-breakdown.test.tsx`

Expected: component missing FAIL.

- [ ] **Step 3: 추천 hook 구현**

Memoize catalog lookup maps, calculate both scenarios whenever local settings change, and return separate `ranked`, `unavailable`, and `lastCalculatedAt` collections. Do not store derived results in IndexedDB.

```ts
export interface RecommendationSet {
  scenario: CalculationScenario
  ranked: DishCalculation[]
  unavailable: DishCalculation[]
  lastCalculatedAt: string
}

export function useRecommendations(
  catalog: PublishedCatalog,
  settings: UserSettingsState,
): { allPurchase: RecommendationSet; actual: RecommendationSet }
```

- [ ] **Step 4: PC와 모바일 결과 UI 구현**

Above 768px render the ranking as a semantic table. Below 768px render the same data as cards without horizontal scrolling. Keep the first-ranked card visually emphasized with a subtle sage surface; use tomato only for a limited change badge, not for all positive numbers.

- [ ] **Step 5: 상세 근거 구현**

`dish-breakdown.tsx` must render the recipe tree, purchased quantities, self-supplied quantities, consumed costs, cash outlay, leftovers, base and skill-adjusted revenue, net profit, ROI, and every blocking error.

- [ ] **Step 6: 테스트와 빌드**

Run:

```powershell
npm test -- src/features/calculator
npm run lint
npm run build
```

Expected: PASS.

- [ ] **Step 7: 커밋**

```powershell
git add src/app src/features/calculator
git commit -m "feat: show daily dish profitability recommendations"
```

---

### Task 9: 관리자 로그인과 3일 가격 주기 게시

**Files:**
- Create: `src/app/admin/login/page.tsx`
- Create: `src/app/admin/login/actions.ts`
- Create: `src/app/admin/prices/page.tsx`
- Create: `src/app/api/admin/price-cycles/route.ts`
- Create: `src/features/admin-prices/schema.ts`
- Create: `src/features/admin-prices/service.ts`
- Create: `src/features/admin-prices/ui/price-cycle-editor.tsx`
- Create: `src/features/admin-prices/ui/price-cycle-editor.test.tsx`
- Test: `src/features/admin-prices/service.test.ts`

**Interfaces:**
- Produces: `createPriceCycleDraft`, `validatePriceCycleDraft`, `publishPriceCycle`
- Produces: authenticated POST `/api/admin/price-cycles`

- [ ] **Step 1: 관리자 서비스 실패 테스트 작성**

Test that draft creation defaults `endsAt` to exactly 72 hours after `startsAt`, missing active dish prices block publish, zero/negative prices fail, overlapping published intervals fail, and an out-of-range price requires a non-empty source note.

- [ ] **Step 2: UI 실패 테스트 작성**

Render the editor with previous prices and assert that `이전 가격 복사` fills every row, pasted tab-separated `dishSlug price` lines update matching rows, unknown slugs show row errors, and publish stays disabled while validation errors exist.

- [ ] **Step 3: 실패 확인**

Run: `npm test -- src/features/admin-prices`

Expected: service and editor missing FAIL.

- [ ] **Step 4: 관리자 인증 구현**

Use `@supabase/ssr` cookie-based auth. The login server action signs in with email/password and redirects only after `getUser()` succeeds. Every admin page and route re-checks the authenticated user and verifies `app_metadata.role === 'admin'` on the server.

```ts
export async function requireAdmin(): Promise<User> {
  const client = await createServerClient()
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user || user.app_metadata.role !== 'admin') throw new AdminAccessError()
  return user
}
```

- [ ] **Step 5: 가격 주기 서비스와 변경 이력 구현**

Validate with Zod, write draft rows in a transaction/RPC, publish only after re-reading active dishes, and create `change_logs` in the same database operation. Never trust the browser's computed validation result.

```ts
export interface PriceCycleService {
  createDraft(input: PriceCycleDraftInput, adminId: string): Promise<string>
  validateDraft(cycleId: string): Promise<PriceCycleValidation>
  publish(cycleId: string, adminId: string, reason: string): Promise<void>
}
```

The API route calls `requireAdmin()`, parses the body with `priceCycleCommandSchema`, dispatches only `CREATE_DRAFT` or `PUBLISH`, and maps validation failures to HTTP 400 without returning stack traces.

- [ ] **Step 6: 관리자 편집 UI 구현**

Implement previous-cycle copy, TSV paste, per-row change percentage, validation summary, preview, and publish confirmation. Show times explicitly as `Asia/Seoul` and serialize as ISO timestamps.

- [ ] **Step 7: 테스트 실행**

Run:

```powershell
npm test -- src/features/admin-prices
npm run lint
npm run build
```

Expected: PASS.

- [ ] **Step 8: 커밋**

```powershell
git add src/app/admin src/app/api/admin src/features/admin-prices src/lib/supabase
git commit -m "feat: manage three-day cooking price cycles"
```

---

### Task 10: 오프라인 캐시, 내보내기 UI, E2E 및 출시 검증

**Files:**
- Create: `src/features/catalog/use-published-catalog.ts`
- Create: `src/features/user-settings/ui/data-transfer.tsx`
- Create: `src/features/user-settings/ui/data-transfer.test.tsx`
- Create: `e2e/recommendation-flow.spec.ts`
- Create: `e2e/admin-price-cycle.spec.ts`
- Modify: `src/app/settings/page.tsx`
- Modify: `playwright.config.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: catalog repository and IndexedDB `catalog_cache`
- Produces: last-known-good fallback with explicit cache status
- Produces: documented local setup and verified primary user flows

- [ ] **Step 1: 캐시 fallback 실패 테스트 작성**

Mock a network failure after one successful catalog load. Assert that the hook returns cached data with status `CACHED`; with no cache it returns status `UNAVAILABLE` and no recommendations.

- [ ] **Step 2: 데이터 전송 UI 실패 테스트 작성**

Assert that export creates a JSON download containing `schemaVersion: 1`, invalid import displays an error without replacing current settings, and valid import requests confirmation before writing.

- [ ] **Step 3: 실패 확인**

Run: `npm test -- use-published-catalog data-transfer`

Expected: missing implementation FAIL.

- [ ] **Step 4: fallback과 데이터 전송 구현**

Cache only Zod-validated `PublishedCatalog` values. Label cached timestamps in the cycle banner. Use an object URL for export and revoke it after download. Parse and validate the full import before one IndexedDB transaction.

```ts
export type CatalogLoadState =
  | { status: 'LOADING' }
  | { status: 'LIVE'; catalog: PublishedCatalog }
  | { status: 'CACHED'; catalog: PublishedCatalog; cachedAt: string }
  | { status: 'UNAVAILABLE'; message: string }

export function usePublishedCatalog(): CatalogLoadState
```

The export handler creates `new Blob([json], { type: 'application/json' })`, clicks a temporary download link named `dding-farm-settings.json`, removes the link, and calls `URL.revokeObjectURL(url)`.

- [ ] **Step 5: 추천 E2E 작성**

`recommendation-flow.spec.ts` must:

1. start in fixture mode;
2. enter tomato `64개 / 1,200G` and select purchase;
3. set onion to direct harvest;
4. return to recommendations;
5. verify the expected first-ranked fixture dish and visible cost basis;
6. reload and verify inputs persist;
7. repeat the recommendation assertion at a 390×844 viewport.

- [ ] **Step 6: 관리자 E2E 작성**

Against local Supabase, sign in as the seeded admin, copy the previous cycle, change one price, publish the next 72-hour cycle, and verify the public banner and affected dish result use the new price. Mark this test skipped only when `SUPABASE_E2E=0`; CI and release verification must run it with `SUPABASE_E2E=1`.

- [ ] **Step 7: README 작성**

Document exact commands:

```powershell
npm install
npx supabase start
npx supabase db reset
Copy-Item .env.example .env.local
npm run dev
```

Also document fixture mode, Supabase keys, how to create an admin user and set `app_metadata.role`, test commands, and the 3-day price publishing workflow.

- [ ] **Step 8: 전체 검증**

Run:

```powershell
npm test
npm run lint
npx tsc --noEmit
npm run build
npm run test:e2e
git diff --check
git status --short
```

Expected: all tests and checks exit 0; working tree contains only intentionally uncommitted local environment files, which are ignored.

- [ ] **Step 9: 최종 커밋**

```powershell
git add README.md playwright.config.ts src e2e
git commit -m "test: verify calculator release flows"
```

---

## Implementation Order and Review Gates

1. Tasks 1–4 establish the testable calculation core. Review all formulas before UI work.
2. Tasks 5–6 establish local and shared persistence. Review schemas and RLS before exposing admin routes.
3. Tasks 7–8 deliver the public MVP user flow. Review at desktop and 390px mobile widths.
4. Task 9 adds privileged price publishing. Review authentication and transaction boundaries separately.
5. Task 10 proves recovery, portability, accessibility-critical flow, and release readiness.

No task may silently substitute missing prices, unverified skill behavior, or stale price cycles with zero. Such records must remain visibly unavailable until valid data exists.
