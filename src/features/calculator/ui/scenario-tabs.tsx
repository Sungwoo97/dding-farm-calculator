import type { CalculationScenario } from '../domain/types'

import styles from './recommendation-dashboard.module.css'

const scenarios: Array<{ value: CalculationScenario; label: string; description: string }> = [
  { value: 'ALL_PURCHASE', label: '전부 구매 효율', description: '모든 재료를 구매할 때의 투자 효율' },
  { value: 'ACTUAL', label: '내 실제 조달', description: '자가 조달과 보유량을 반영한 순이익' },
]

export function ScenarioTabs({
  value,
  onChange,
}: {
  value: CalculationScenario
  onChange: (scenario: CalculationScenario) => void
}) {
  return (
    <div className={styles.tabs} role="tablist" aria-label="계산 기준">
      {scenarios.map((scenario) => (
        <button
          key={scenario.value}
          type="button"
          role="tab"
          aria-label={scenario.label}
          aria-selected={value === scenario.value}
          aria-controls="recommendation-results"
          onClick={() => onChange(scenario.value)}
        >
          <strong>{scenario.label}</strong>
          <span>{scenario.description}</span>
        </button>
      ))}
    </div>
  )
}
