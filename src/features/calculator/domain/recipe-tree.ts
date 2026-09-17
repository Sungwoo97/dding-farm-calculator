import { calculatePurchaseCost } from './procurement'
import type { Catalog, MaterialSetting, Recipe } from './types'

export interface RecipeCostNode {
  itemId: string
  requestedQuantity: number
  strategy: 'LEAF' | 'MAKE' | 'BUY' | 'CHEAPEST'
  cost: number | null
  batches?: number
  recipeId?: string
  children: RecipeCostNode[]
  alternatives?: {
    buy: RecipeCostNode
    make: RecipeCostNode
  }
}

export interface ExpandedRecipe {
  leaves: Array<{ itemId: string; quantity: number }>
  tree: RecipeCostNode
  errors: string[]
}

export class RecipeCycleError extends Error {
  readonly path: string[]

  constructor(path: string[]) {
    super(`Recipe cycle detected: ${path.join(' -> ')}`)
    this.name = 'RecipeCycleError'
    this.path = path
  }
}

interface ExpansionContext {
  recipesByOutputItemId: Map<string, Recipe>
  settings: Map<string, MaterialSetting>
}

interface ExpansionResult extends ExpandedRecipe {
  cost: number | null
}

export function expandRecipe(
  outputItemId: string,
  outputQuantity: number,
  catalog: Catalog,
  settings: Map<string, MaterialSetting>,
): ExpandedRecipe {
  const context = createExpansionContext(catalog, settings)
  const result = expandNode(outputItemId, outputQuantity, context, new Set())
  return {
    leaves: result.leaves,
    tree: result.tree,
    errors: result.errors,
  }
}

function createExpansionContext(
  catalog: Catalog,
  settings: Map<string, MaterialSetting>,
): ExpansionContext {
  return {
    recipesByOutputItemId: new Map(catalog.recipes.map((recipe) => [recipe.outputItemId, recipe])),
    settings,
  }
}

function expandNode(
  itemId: string,
  requestedQuantity: number,
  context: ExpansionContext,
  activePath: Set<string>,
): ExpansionResult {
  if (activePath.has(itemId)) throw new RecipeCycleError([...activePath, itemId])

  activePath.add(itemId)
  try {
    const recipe = context.recipesByOutputItemId.get(itemId)
    if (!recipe) return purchaseLeaf(itemId, requestedQuantity, context.settings)

    const mode = context.settings.get(itemId)?.intermediateMode ?? 'MAKE'
    if (mode === 'BUY') return purchaseLeaf(itemId, requestedQuantity, context.settings, 'BUY')

    if (mode === 'CHEAPEST') {
      const buy = purchaseLeaf(itemId, requestedQuantity, context.settings, 'BUY')
      const make = expandMake(itemId, requestedQuantity, recipe, context, activePath)
      const buyValid = isValid(buy)
      const makeValid = isValid(make)

      if (buyValid && (!makeValid || buy.cost! <= make.cost!)) {
        return { ...buy, tree: { ...buy.tree, alternatives: { buy: buy.tree, make: make.tree } } }
      }
      if (makeValid) {
        return { ...make, tree: { ...make.tree, alternatives: { buy: buy.tree, make: make.tree } } }
      }

      return {
        leaves: [],
        tree: {
          itemId,
          requestedQuantity,
          strategy: 'CHEAPEST',
          cost: null,
          children: [],
          alternatives: { buy: buy.tree, make: make.tree },
        },
        cost: null,
        errors: [`MISSING_PRICE:${itemId}`],
      }
    }

    return expandMake(itemId, requestedQuantity, recipe, context, activePath)
  } finally {
    activePath.delete(itemId)
  }
}

function expandMake(
  itemId: string,
  requestedQuantity: number,
  recipe: Recipe,
  context: ExpansionContext,
  activePath: Set<string>,
): ExpansionResult {
  if (!Number.isFinite(recipe.outputQuantity) || recipe.outputQuantity <= 0) {
    return invalidResult(itemId, requestedQuantity, 'MAKE', `INVALID_RECIPE_OUTPUT:${recipe.id}`)
  }
  if (
    recipe.ingredients.length === 0
    || recipe.ingredients.some((ingredient) => !Number.isFinite(ingredient.quantity) || ingredient.quantity <= 0)
  ) {
    return invalidResult(itemId, requestedQuantity, 'MAKE', `INVALID_RECIPE:${recipe.id}`)
  }

  const batches = Math.ceil(requestedQuantity / recipe.outputQuantity)
  if (!Number.isFinite(batches) || batches < 0) {
    return invalidResult(itemId, requestedQuantity, 'MAKE', `INVALID_REQUESTED_QUANTITY:${itemId}`)
  }

  const children = recipe.ingredients.map((ingredient) => expandNode(
    ingredient.itemId,
    ingredient.quantity * batches,
    context,
    activePath,
  ))
  const errors = children.flatMap((child) => child.errors)
  const cost = errors.length === 0 && children.every((child) => child.cost !== null)
    ? children.reduce((total, child) => total + child.cost!, 0)
    : null

  return {
    leaves: mergeLeaves(children.flatMap((child) => child.leaves)),
    tree: {
      itemId,
      requestedQuantity,
      strategy: 'MAKE',
      cost,
      recipeId: recipe.id,
      batches,
      children: children.map((child) => child.tree),
    },
    cost,
    errors,
  }
}

function purchaseLeaf(
  itemId: string,
  requestedQuantity: number,
  settings: Map<string, MaterialSetting>,
  strategy: 'LEAF' | 'BUY' = 'LEAF',
): ExpansionResult {
  const setting = settings.get(itemId)
  if (!setting) return invalidResult(itemId, requestedQuantity, strategy, `MISSING_PRICE:${itemId}`)

  const purchase = calculatePurchaseCost(requestedQuantity, setting)
  if (purchase.errors.length > 0) {
    return invalidResult(itemId, requestedQuantity, strategy, `MISSING_PRICE:${itemId}`)
  }

  return {
    leaves: [{ itemId, quantity: requestedQuantity }],
    tree: { itemId, requestedQuantity, strategy, cost: purchase.consumedCost, children: [] },
    cost: purchase.consumedCost,
    errors: [],
  }
}

function invalidResult(
  itemId: string,
  requestedQuantity: number,
  strategy: 'LEAF' | 'MAKE' | 'BUY',
  error: string,
): ExpansionResult {
  return {
    leaves: [],
    tree: { itemId, requestedQuantity, strategy, cost: null, children: [] },
    cost: null,
    errors: [error],
  }
}

function isValid(result: ExpansionResult): boolean {
  return result.errors.length === 0 && result.cost !== null
}

function mergeLeaves(leaves: Array<{ itemId: string; quantity: number }>): Array<{ itemId: string; quantity: number }> {
  const quantities = new Map<string, number>()
  for (const leaf of leaves) quantities.set(leaf.itemId, (quantities.get(leaf.itemId) ?? 0) + leaf.quantity)
  return [...quantities].map(([itemId, quantity]) => ({ itemId, quantity }))
}
