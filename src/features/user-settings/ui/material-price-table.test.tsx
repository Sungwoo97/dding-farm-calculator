import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Item, MaterialSetting } from '@/features/calculator/domain/types'

import { MaterialPriceTable } from './material-price-table'

afterEach(cleanup)

const tomato: Item = {
  id: 'tomato',
  slug: 'tomato',
  name: '토마토',
  category: 'RAW',
  tradeable: true,
}

function MaterialPriceTableHarness({
  initialSetting = {
    itemId: tomato.id,
    sourceMode: 'SELF',
    ownedQuantity: 0,
  },
  onSettingChange = () => undefined,
}: {
  initialSetting?: MaterialSetting
  onSettingChange?: (setting: MaterialSetting) => void
} = {}) {
  const [settings, setSettings] = useState<Map<string, MaterialSetting>>(
    new Map([
      [tomato.id, initialSetting],
    ]),
  )

  return (
    <MaterialPriceTable
      items={[tomato]}
      settings={settings}
      onChange={(setting) => {
        onSettingChange(setting)
        setSettings((current) => new Map(current).set(setting.itemId, setting))
      }}
    />
  )
}

describe('MaterialPriceTable', () => {
  it('shows purchase inputs and derives a unit price for a purchased material', () => {
    render(<MaterialPriceTableHarness />)

    fireEvent.change(screen.getByRole('combobox', { name: '토마토 조달 방식' }), {
      target: { value: 'PURCHASE' },
    })

    const quantity = screen.getByRole('spinbutton', { name: '토마토 구매 묶음 수량' })
    const price = screen.getByRole('spinbutton', { name: '토마토 구매 묶음 가격' })

    fireEvent.change(quantity, { target: { value: '64' } })
    fireEvent.change(price, { target: { value: '1200' } })

    expect(screen.getByText('18.75 G/개')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('combobox', { name: '토마토 조달 방식' }), {
      target: { value: 'SELF' },
    })

    expect(screen.queryByRole('spinbutton', { name: '토마토 구매 묶음 수량' })).not.toBeInTheDocument()
    expect(screen.queryByRole('spinbutton', { name: '토마토 구매 묶음 가격' })).not.toBeInTheDocument()
  })

  it('reports a zero purchase quantity as an accessible error', () => {
    render(<MaterialPriceTableHarness />)

    fireEvent.change(screen.getByRole('combobox', { name: '토마토 조달 방식' }), {
      target: { value: 'PURCHASE' },
    })
    fireEvent.change(screen.getByRole('spinbutton', { name: '토마토 구매 묶음 수량' }), {
      target: { value: '0' },
    })

    expect(screen.getByRole('alert')).toHaveTextContent('구매 묶음 수량은 0보다 커야 합니다.')
  })

  it('removes an invalid hidden purchase value when changing to self harvest', () => {
    const onSettingChange = vi.fn()
    render(<MaterialPriceTableHarness onSettingChange={onSettingChange} />)

    const source = screen.getByRole('combobox', { name: '토마토 조달 방식' })
    fireEvent.change(source, { target: { value: 'PURCHASE' } })
    fireEvent.change(screen.getByRole('spinbutton', { name: '토마토 구매 묶음 수량' }), {
      target: { value: '0' },
    })
    fireEvent.change(source, { target: { value: 'SELF' } })

    expect(onSettingChange).toHaveBeenLastCalledWith({
      itemId: tomato.id,
      sourceMode: 'SELF',
      ownedQuantity: 0,
    })
  })

  it('preserves valid owned and purchase values across a self-harvest round trip', () => {
    const onSettingChange = vi.fn()
    const initialSetting: MaterialSetting = {
      itemId: tomato.id,
      sourceMode: 'MIXED',
      ownedQuantity: 7,
      purchasePackQuantity: 64,
      purchasePackPrice: 1200,
      observedAt: '2026-09-18T00:00:00.000Z',
    }
    render(
      <MaterialPriceTableHarness
        initialSetting={initialSetting}
        onSettingChange={onSettingChange}
      />,
    )

    const source = screen.getByRole('combobox', { name: '토마토 조달 방식' })
    fireEvent.change(source, { target: { value: 'SELF' } })

    expect(onSettingChange).toHaveBeenLastCalledWith({
      ...initialSetting,
      sourceMode: 'SELF',
    })

    fireEvent.change(source, { target: { value: 'MIXED' } })

    expect(screen.getByRole('spinbutton', { name: '토마토 보유 수량' })).toHaveValue(7)
    expect(screen.getByRole('spinbutton', { name: '토마토 구매 묶음 수량' })).toHaveValue(64)
    expect(screen.getByRole('spinbutton', { name: '토마토 구매 묶음 가격' })).toHaveValue(1200)
  })
})
