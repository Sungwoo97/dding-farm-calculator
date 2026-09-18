'use client'

import { useMemo } from 'react'

import { calculateDish } from '@/features/calculator/domain/calculate-dish'
import { calculatePurchaseCost } from '@/features/calculator/domain/procurement'
import { expandRecipe, type RecipeCostNode } from '@/features/calculator/domain/recipe-tree'
import { applySalePriceRules } from '@/features/calculator/domain/sale-price'
import type { CalculationScenario, MaterialSetting } from '@/features/calculator/domain/types'
import { selectedSkillProfile } from '@/features/calculator/use-recommendations'
import type { PublishedCatalog } from '@/features/catalog/types'
import { useUserSettings } from '@/features/user-settings/use-user-settings'

import { calculationErrorText, formatGold, formatRoi, numberFormat } from './presentation'
import styles from './recommendation-dashboard.module.css'

function settingsForScenario(
  catalog: PublishedCatalog,
  settings: Map<string, MaterialSetting>,
  scenario: CalculationScenario,
): Map<string, MaterialSetting> {
  if (scenario === 'ACTUAL') return settings

  const adjusted = new Map(settings)
  for (const item of catalog.items) {
    if (!item.tradeable) continue
    const setting = adjusted.get(item.id)
    adjusted.set(item.id, setting
      ? { ...setting, sourceMode: 'PURCHASE', ownedQuantity: 0 }
      : { itemId: item.id, sourceMode: 'PURCHASE', ownedQuantity: 0 })
  }
  return adjusted
}

function strategyLabel(strategy: RecipeCostNode['strategy']): string {
  switch (strategy) {
    case 'MAKE': return '만들기'
    case 'BUY': return '구매하기'
    case 'CHEAPEST': return '최저 비용 선택'
    case 'LEAF': return '재료'
  }
}

function RecipeNode({
  node,
  itemName,
}: {
  node: RecipeCostNode
  itemName: (itemId: string) => string
}) {
  const label = `${itemName(node.itemId)} ${numberFormat.format(node.requestedQuantity)}개 ${strategyLabel(node.strategy)}`
  return (
    <li role="treeitem" aria-label={label} aria-selected="false">
      <span className={styles.recipeNodeLabel}>
        {label}{node.batches === undefined ? '' : ` · ${node.batches}회 제작`}
      </span>
      {node.children.length > 0 ? (
        <ul role="group">
          {node.children.map((child, index) => (
            <RecipeNode key={`${child.itemId}-${index}`} node={child} itemName={itemName} />
          ))}
        </ul>
      ) : null}
      {node.alternatives ? (
        <details>
          <summary>구매와 제작 대안 비교</summary>
          <ul role="group">
            <RecipeNode node={node.alternatives.buy} itemName={itemName} />
            <RecipeNode node={node.alternatives.make} itemName={itemName} />
          </ul>
        </details>
      ) : null}
    </li>
  )
}

export function DishBreakdown({
  catalog,
  dishId,
  scenario = 'ACTUAL',
}: {
  catalog: PublishedCatalog
  dishId: string
  scenario?: CalculationScenario
}) {
  const { settings, ready, saveError } = useUserSettings()
  const itemsById = useMemo(
    () => new Map(catalog.items.map((item) => [item.id, item])),
    [catalog],
  )
  const detail = useMemo(() => {
    const craftQuantity = settings.profile.defaultCraftQuantity
    const basePrice = catalog.prices.find((price) => price.dishItemId === dishId)?.basePrice ?? null
    const effectiveSettings = settingsForScenario(catalog, settings.materials, scenario)
    const skillProfile = selectedSkillProfile(catalog, settings)
    const calculation = calculateDish({
      dishId,
      scenario,
      craftQuantity,
      basePrice,
      catalog,
      settings: settings.materials,
      skillProfile,
    })

    let recipe: ReturnType<typeof expandRecipe> | null = null
    try {
      recipe = expandRecipe(dishId, craftQuantity, catalog, effectiveSettings)
    } catch {
      recipe = null
    }

    const procurement = (recipe?.leaves ?? []).map((leaf) => {
      const material = effectiveSettings.get(leaf.itemId)
      const purchase = material ? calculatePurchaseCost(leaf.quantity, material) : null
      return {
        ...leaf,
        purchase,
        selfSuppliedQuantity: purchase ? leaf.quantity - purchase.purchaseQuantity : 0,
      }
    })

    return {
      calculation,
      recipe,
      procurement,
      baseRevenue: basePrice === null ? null : applySalePriceRules(basePrice, craftQuantity, []),
    }
  }, [catalog, dishId, scenario, settings])

  if (!ready) return <p role="status">저장된 설정을 불러와 계산 근거를 만드는 중입니다.</p>

  const dish = itemsById.get(dishId)
  const itemName = (itemId: string) => itemsById.get(itemId)?.name ?? itemId

  return (
    <article className={styles.breakdown}>
      <header>
        <p className={styles.eyebrow}>{scenario === 'ALL_PURCHASE' ? '전부 구매 기준' : '내 실제 조달 기준'}</p>
        <h1>{dish?.name ?? dishId} 계산 근거</h1>
        <p>제작 수량 {numberFormat.format(detail.calculation.craftQuantity)}개 기준입니다.</p>
      </header>

      {saveError ? <p role="alert">설정을 불러오지 못했습니다: {saveError}</p> : null}
      {detail.calculation.errors.length > 0 ? (
        <section className={styles.errorBox} role="alert" aria-label="계산할 수 없는 이유">
          <strong>계산할 수 없는 이유</strong>
          <ul className={styles.errorList}>
            {detail.calculation.errors.map((error) => (
              <li key={error}>{calculationErrorText(error, itemsById)}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={styles.breakdownSection}>
        <h2>레시피 구성</h2>
        {detail.recipe ? (
          <ul className={styles.recipeTree} role="tree" aria-label="레시피 구성">
            <RecipeNode node={detail.recipe.tree} itemName={itemName} />
          </ul>
        ) : <p>레시피 트리를 표시할 수 없습니다.</p>}
      </section>

      <section className={styles.breakdownSection} role="region" aria-label="재료 조달 내역">
        <h2>재료 조달 내역</h2>
        {detail.procurement.length > 0 ? (
          <ul className={styles.procurementList}>
            {detail.procurement.map((entry) => (
              <li key={entry.itemId} aria-label={`${itemName(entry.itemId)} 조달 내역`}>
                <strong>{itemName(entry.itemId)} · 필요 {numberFormat.format(entry.quantity)}개</strong>
                {entry.purchase ? (
                  <div className={styles.procurementMetrics}>
                    <span>구매 {numberFormat.format(entry.purchase.purchaseQuantity)}개</span>
                    <span>자가 조달 {numberFormat.format(entry.selfSuppliedQuantity)}개</span>
                    <span>소모 원가 {formatGold(entry.purchase.consumedCost)}</span>
                    <span>현금 지출 {formatGold(entry.purchase.cashOutlay)}</span>
                    <span>잔여 {numberFormat.format(entry.purchase.leftoverQuantity)}개</span>
                  </div>
                ) : <span>가격 입력 필요</span>}
              </li>
            ))}
          </ul>
        ) : <p>계산 가능한 조달 내역이 없습니다.</p>}
      </section>

      <section className={styles.breakdownSection} role="region" aria-label="수익 계산">
        <h2>수익 계산</h2>
        <dl className={styles.summaryGrid}>
          <div><dt>기본 판매 수익</dt><dd>{formatGold(detail.baseRevenue)}</dd></div>
          <div><dt>스킬 적용 판매 수익</dt><dd>{formatGold(detail.calculation.saleRevenue)}</dd></div>
          <div><dt>소모 구매 원가</dt><dd>{formatGold(detail.calculation.consumedPurchaseCost)}</dd></div>
          <div><dt>실제 지출액</dt><dd>{formatGold(detail.calculation.cashOutlay)}</dd></div>
          <div><dt>순이익</dt><dd>{formatGold(detail.calculation.netProfit)}</dd></div>
          <div><dt>구매 ROI</dt><dd>{formatRoi(detail.calculation.purchaseRoi, detail.calculation.consumedPurchaseCost)}</dd></div>
        </dl>
      </section>
    </article>
  )
}
