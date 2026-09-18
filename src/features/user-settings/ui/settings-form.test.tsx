import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { PublishedCatalog } from '@/features/catalog/types'
import { defaultUserProfile, userSettingsRepository } from '@/features/user-settings/storage/repository'

import { SettingsForm } from './settings-form'

const expectedOutputSkill: PublishedCatalog['skills'][number] = {
  id: '10000000-0000-4000-8000-000000000051',
  slug: 'extra-output',
  name: '추가 생산',
  appliesTo: 'DISH',
  maxLevel: 1,
  sourceUrl: 'https://example.com/skill',
  verifiedAt: '2026-09-18T00:00:00.000Z',
  levels: [{
    level: 1,
    rulesVersion: 'test-v1',
    sourceUrl: 'https://example.com/skill-level',
    verifiedAt: '2026-09-18T00:00:00.000Z',
    effect: {
      type: 'EXPECTED_EXTRA_OUTPUT',
      value: 0.25,
      minimumQuantity: 10,
      order: 1,
      rounding: 'NONE',
      verified: true,
    },
  }],
}

describe('SettingsForm', () => {
  beforeEach(async () => {
    await userSettingsRepository.replaceAll({
      schemaVersion: 1,
      profile: defaultUserProfile,
      materials: [],
      favorites: [],
      catalogCache: null,
    })
  })

  afterEach(cleanup)

  it('describes conditional expected output as a proportional increase', async () => {
    render(<SettingsForm skills={[expectedOutputSkill]} />)

    expect(await screen.findByText(
      '레벨 1: 기대 생산량 +25%, 10개 이상 (NONE)',
    )).toBeInTheDocument()
  })
})
