'use client'

import type { PublishedCatalog } from '@/features/catalog/types'
import { useUserSettings } from '@/features/user-settings/use-user-settings'

import styles from './settings-form.module.css'

type Skill = PublishedCatalog['skills'][number]
type SkillLevel = Skill['levels'][number]

function effectText(level: SkillLevel): string {
  const { effect } = level
  const percent = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(effect.value * 100)
  const minimum = effect.minimumQuantity === undefined ? '' : `, ${effect.minimumQuantity}개 이상`
  if (effect.type === 'EXPECTED_EXTRA_OUTPUT') {
    return `기대 생산량 +${percent}%${minimum} (${effect.rounding})`
  }

  if (effect.type === 'BULK_SALE_MULTIPLIER') {
    return `대량 판매 가격 +${percent}%${minimum} (${effect.rounding})`
  }
  return `판매 가격 +${percent}% (${effect.rounding})`
}

export function SettingsForm({ skills }: { skills: Skill[] }) {
  const { settings, ready, saveError, updateSkill } = useUserSettings()

  if (!ready) return <p role="status">저장된 설정을 불러오는 중입니다.</p>

  return (
    <form className={styles.form} onSubmit={(event) => event.preventDefault()}>
      {saveError ? <p role="alert">설정을 저장하지 못했습니다: {saveError}</p> : null}
      {skills.map((skill) => {
        const selectedLevel = settings.profile.skills[skill.id] ?? 0
        const selectedDefinition = skill.levels.find((level) => level.level === selectedLevel && level.effect.verified)

        return (
          <fieldset key={skill.id} className={styles.skill}>
            <legend>{skill.name}</legend>
            <label htmlFor={`skill-${skill.id}`}>레벨</label>
            <select
              id={`skill-${skill.id}`}
              value={selectedLevel}
              onChange={(event) => void updateSkill(skill.id, Number(event.target.value))}
            >
              {Array.from({ length: skill.maxLevel + 1 }, (_, level) => (
                <option key={level} value={level}>레벨 {level}</option>
              ))}
            </select>
            <p className={styles.currentEffect} aria-live="polite">
              현재 효과: {selectedDefinition ? effectText(selectedDefinition) : '효과 없음'}
            </p>
            <ul className={styles.effects} aria-label={`${skill.name} 검증된 레벨별 효과`}>
              {skill.levels.filter((level) => level.effect.verified).map((level) => (
                <li key={level.level}>레벨 {level.level}: {effectText(level)}</li>
              ))}
            </ul>
          </fieldset>
        )
      })}
    </form>
  )
}
