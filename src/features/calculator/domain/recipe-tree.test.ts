import { describe, expect, it } from 'vitest'
import type { Catalog, MaterialSetting } from './types'
import { expandRecipe, RecipeCycleError } from './recipe-tree'

const items: Catalog['items'] = [
  { id: 'tomato', slug: 'tomato', name: 'Tomato', category: 'RAW', tradeable: true },
  { id: 'tomato-base', slug: 'tomato-base', name: 'Tomato base', category: 'PROCESSED', tradeable: true },
  { id: 'dish', slug: 'dish', name: 'Dish', category: 'DISH', tradeable: true },
]

const tomatoBaseRecipe = {
  id: 'tomato-base-recipe',
  outputItemId: 'tomato-base',
  outputQuantity: 2,
  ingredients: [{ itemId: 'tomato', quantity: 4 }],
}

function settings(...entries: MaterialSetting[]): Map<string, MaterialSetting> {
  return new Map(entries.map((entry) => [entry.itemId, entry]))
}

describe('expandRecipe', () => {
  it('rounds recipe batches up before expanding the ingredients', () => {
    const result = expandRecipe('tomato-base', 3, {
      items,
      recipes: [tomatoBaseRecipe],
    }, settings({ itemId: 'tomato', sourceMode: 'SELF', ownedQuantity: 0 }))

    expect(result.leaves).toEqual([{ itemId: 'tomato', quantity: 8 }])
    expect(result.tree).toMatchObject({
      itemId: 'tomato-base',
      requestedQuantity: 3,
      batches: 2,
      children: [{ itemId: 'tomato', requestedQuantity: 8 }],
    })
    expect(result.errors).toEqual([])
  })

  it('stops recursion when an intermediate is configured to buy', () => {
    const result = expandRecipe('tomato-base', 3, {
      items,
      recipes: [tomatoBaseRecipe],
    }, settings({
      itemId: 'tomato-base', sourceMode: 'PURCHASE', intermediateMode: 'BUY', ownedQuantity: 0,
      purchasePackQuantity: 1, purchasePackPrice: 100,
    }))

    expect(result.leaves).toEqual([{ itemId: 'tomato-base', quantity: 3 }])
    expect(result.tree).toMatchObject({ itemId: 'tomato-base', strategy: 'BUY', children: [] })
    expect(result.errors).toEqual([])
  })

  it('chooses the lower-cost valid branch for a cheapest intermediate', () => {
    const result = expandRecipe('tomato-base', 2, {
      items,
      recipes: [tomatoBaseRecipe],
    }, settings(
      {
        itemId: 'tomato-base', sourceMode: 'PURCHASE', intermediateMode: 'CHEAPEST', ownedQuantity: 0,
        purchasePackQuantity: 1, purchasePackPrice: 100,
      },
      {
        itemId: 'tomato', sourceMode: 'PURCHASE', ownedQuantity: 0,
        purchasePackQuantity: 1, purchasePackPrice: 10,
      },
    ))

    expect(result.leaves).toEqual([{ itemId: 'tomato', quantity: 4 }])
    expect(result.tree).toMatchObject({ itemId: 'tomato-base', strategy: 'MAKE', cost: 40 })
    expect(result.errors).toEqual([])
  })

  it('chooses the purchasable branch when the make branch has no price', () => {
    const result = expandRecipe('tomato-base', 2, {
      items,
      recipes: [tomatoBaseRecipe],
    }, settings({
      itemId: 'tomato-base', sourceMode: 'PURCHASE', intermediateMode: 'CHEAPEST', ownedQuantity: 0,
      purchasePackQuantity: 1, purchasePackPrice: 100,
    }))

    expect(result.leaves).toEqual([{ itemId: 'tomato-base', quantity: 2 }])
    expect(result.tree).toMatchObject({ itemId: 'tomato-base', strategy: 'BUY', cost: 200 })
    expect(result.errors).toEqual([])
  })

  it('returns a missing-price error when neither cheapest branch is valid', () => {
    const result = expandRecipe('tomato-base', 2, {
      items,
      recipes: [tomatoBaseRecipe],
    }, settings({ itemId: 'tomato-base', sourceMode: 'PURCHASE', intermediateMode: 'CHEAPEST', ownedQuantity: 0 }))

    expect(result.leaves).toEqual([])
    expect(result.errors).toEqual(['MISSING_PRICE:tomato-base'])
    expect(result.tree).toMatchObject({ itemId: 'tomato-base', strategy: 'CHEAPEST', cost: null })
  })

  it('rejects a recipe with no ingredients instead of treating it as free', () => {
    const result = expandRecipe('tomato-base', 1, {
      items,
      recipes: [{ ...tomatoBaseRecipe, id: 'empty-recipe', ingredients: [] }],
    }, settings())

    expect(result.leaves).toEqual([])
    expect(result.tree).toMatchObject({ itemId: 'tomato-base', strategy: 'MAKE', cost: null })
    expect(result.errors).toEqual(['INVALID_RECIPE:empty-recipe'])
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects recipe ingredient quantity %p',
    (quantity) => {
      const result = expandRecipe('tomato-base', 1, {
        items,
        recipes: [{
          ...tomatoBaseRecipe,
          id: 'invalid-quantity-recipe',
          ingredients: [{ itemId: 'tomato', quantity }],
        }],
      }, settings({ itemId: 'tomato', sourceMode: 'SELF', ownedQuantity: 0 }))

      expect(result.leaves).toEqual([])
      expect(result.tree).toMatchObject({ itemId: 'tomato-base', strategy: 'MAKE', cost: null })
      expect(result.errors).toEqual(['INVALID_RECIPE:invalid-quantity-recipe'])
    },
  )

  it('throws RecipeCycleError for a recipe cycle', () => {
    const catalog: Catalog = {
      items: [
        { id: 'a', slug: 'a', name: 'A', category: 'PROCESSED', tradeable: true },
        { id: 'b', slug: 'b', name: 'B', category: 'PROCESSED', tradeable: true },
      ],
      recipes: [
        { id: 'a-recipe', outputItemId: 'a', outputQuantity: 1, ingredients: [{ itemId: 'b', quantity: 1 }] },
        { id: 'b-recipe', outputItemId: 'b', outputQuantity: 1, ingredients: [{ itemId: 'a', quantity: 1 }] },
      ],
    }

    expect(() => expandRecipe('a', 1, catalog, settings())).toThrow(RecipeCycleError)
  })
})
