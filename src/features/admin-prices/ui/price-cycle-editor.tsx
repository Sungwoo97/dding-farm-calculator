'use client'

import { useState } from 'react'
import { CYCLE_DURATION_MS, priceCycleDraftSchema, validatePriceCycleDraft, type AdminDish, type PublishedInterval } from '../schema'

interface Props {
  dishes: AdminDish[]
  previousPrices: Record<string, number>
  published?: PublishedInterval[]
  initialStartsAt?: string
}
interface Row { value: string; sourceNote: string }

// Seoul has a fixed UTC+09:00 offset; local input never depends on browser timezone.
function seoulInput(instant: string) {
  return new Date(Date.parse(instant) + 9 * 60 * 60 * 1000).toISOString().slice(0, 16)
}

// Render all preview instants explicitly in the configured display timezone.
function displayTime(instant: string) {
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(instant))
}

// Editable rows become immutable snapshots once saved; edits require a new draft.
export function PriceCycleEditor({ dishes, previousPrices, published = [], initialStartsAt }: Props) {
  const [rows, setRows] = useState<Record<string, Row>>(() => Object.fromEntries(dishes.map((dish) => [dish.id, { value: '', sourceNote: '' }])))
  const [startsAt, setStartsAt] = useState(() => seoulInput(initialStartsAt ?? new Date().toISOString()))
  const [sourceUrl, setSourceUrl] = useState('')
  const [reason, setReason] = useState('')
  const [tsv, setTsv] = useState('')
  const [pasteErrors, setPasteErrors] = useState<string[]>([])
  const [cycleId, setCycleId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [publishedHere, setPublishedHere] = useState(false)
  const [message, setMessage] = useState('')
  const draft = { startsAt: `${startsAt}:00+09:00`, sourceUrl, reason, prices: dishes.filter((dish) => rows[dish.id].value !== '').map((dish) => ({ dishItemId: dish.id, basePrice: Number(rows[dish.id].value), sourceNote: rows[dish.id].sourceNote })) }
  const validation = validatePriceCycleDraft(draft, dishes, published)
  const errors = [...pasteErrors, ...validation.errors]
  const canPublish = errors.length === 0 && cycleId !== null && !busy && !publishedHere
  const parsed = priceCycleDraftSchema.safeParse(draft)

  // Invalidate saved identity whenever any part of its input changes.
  function changed() { setCycleId(null); setConfirming(false); setMessage('') }

  // Copy only matching active rows, leaving missing prior values visibly empty.
  function copyPrevious() {
    changed()
    setRows(Object.fromEntries(dishes.map((dish) => [dish.id, { value: previousPrices[dish.id]?.toString() ?? '', sourceNote: '' }])))
    setPasteErrors([])
  }

  // Parse TSV without silently accepting extra columns, duplicate slugs or bad prices.
  function applyPaste() {
    changed()
    const next = { ...rows }
    const issues: string[] = []
    const seen = new Set<string>()
    tsv.split(/\r?\n/).forEach((line, index) => {
      if (!line.trim()) return
      const [slug, value, extra] = line.split('\t').map((part) => part.trim())
      const dish = dishes.find((candidate) => candidate.slug === slug)
      if (!dish) issues.push(`${index + 1}행: 알 수 없는 요리 ${slug}`)
      else if (seen.has(slug)) issues.push(`${index + 1}행: 중복 요리 ${slug}`)
      else if (extra !== undefined || !value || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) issues.push(`${index + 1}행: 양의 정수 가격이 필요합니다.`)
      else { next[dish.id] = { ...next[dish.id], value }; seen.add(slug) }
    })
    setRows(next)
    setPasteErrors(issues)
  }

  // Only the server/DB decides mutation validity; local validation is a preview.
  async function submit(type: 'CREATE_DRAFT' | 'PUBLISH') {
    setBusy(true)
    setMessage('')
    try {
      const command = type === 'CREATE_DRAFT' ? { type, input: priceCycleDraftSchema.parse(draft) } : { type, cycleId, reason }
      const response = await fetch('/api/admin/price-cycles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(command) })
      const result = await response.json()
      if (!response.ok) { setMessage(typeof result.error === 'string' ? result.error : '요청을 처리하지 못했습니다.'); return }
      if (type === 'CREATE_DRAFT') { setCycleId(result.cycleId); setMessage('초안을 저장했습니다.') }
      else { setPublishedHere(true); setMessage('가격 주기를 게시했습니다.') }
    } catch { setMessage('요청을 처리하지 못했습니다. 연결 상태를 확인해 주세요.') }
    finally { setBusy(false); setConfirming(false) }
  }

  return <section style={{ maxWidth: 1100, margin: '2rem auto', padding: 16 }} aria-labelledby="price-editor-title">
    <h1 id="price-editor-title">3일 요리 가격 관리</h1>
    <p>시간대: Asia/Seoul · 시작 포함, 종료 제외 · 정확히 72시간</p>
    <fieldset disabled={busy || publishedHere} style={{ display: 'grid', gap: 12, border: 0, padding: 0 }}>
      <label>시작 시각 (Asia/Seoul)<input aria-label="시작 시각 (Asia/Seoul)" type="datetime-local" value={startsAt} onChange={(event) => { changed(); setStartsAt(event.target.value) }} /></label>
      <label>출처 URL<input type="url" value={sourceUrl} onChange={(event) => { changed(); setSourceUrl(event.target.value) }} /></label>
      <label>변경 사유<input value={reason} onChange={(event) => { changed(); setReason(event.target.value) }} /></label>
      <button type="button" onClick={copyPrevious}>이전 가격 복사</button>
      <label>가격 TSV<textarea value={tsv} placeholder={'dish-slug\t100'} onChange={(event) => { changed(); setTsv(event.target.value); setPasteErrors(['붙여넣기 적용 버튼으로 내용을 검증해 주세요.']) }} /></label>
      <button type="button" onClick={applyPaste}>붙여넣기 적용</button>
      <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <caption>요리별 가격과 확인 근거</caption>
        <thead><tr><th scope="col">요리</th><th scope="col">공식 범위</th><th scope="col">가격</th><th scope="col">이전 대비</th><th scope="col">확인 근거</th></tr></thead>
        <tbody>{dishes.map((dish) => <tr key={dish.id}>
          <th scope="row">{dish.name}<small style={{ display: 'block' }}>{dish.slug}</small></th>
          <td>{dish.officialMinPrice === null ? '공식 범위 미등록' : `${dish.officialMinPrice}–${dish.officialMaxPrice}`}</td>
          <td><input aria-label={`${dish.name} 가격`} type="number" min="1" step="1" max={Number.MAX_SAFE_INTEGER} value={rows[dish.id].value} onChange={(event) => { changed(); setRows({ ...rows, [dish.id]: { ...rows[dish.id], value: event.target.value } }) }} /></td>
          <td>{previousPrices[dish.id] && rows[dish.id].value ? `${((Number(rows[dish.id].value) / previousPrices[dish.id] - 1) * 100).toFixed(1)}%` : '—'}</td>
          <td><input aria-label={`${dish.name} 확인 근거`} value={rows[dish.id].sourceNote} onChange={(event) => { changed(); setRows({ ...rows, [dish.id]: { ...rows[dish.id], sourceNote: event.target.value } }) }} /></td>
        </tr>)}</tbody>
      </table></div>
    </fieldset>
    {errors.length > 0 && <div role="alert"><p>게시 전 확인이 필요합니다.</p><ul>{errors.map((error, index) => <li key={index}>{error}</li>)}</ul></div>}
    {parsed.success && <details><summary>게시 미리보기</summary>
      <p>{displayTime(parsed.data.startsAt)} ~ {displayTime(parsed.data.endsAt)} (Asia/Seoul, 종료 제외)</p>
      <ul>{dishes.map((dish) => <li key={dish.id}>{dish.name}: {rows[dish.id].value || '미입력'} · {rows[dish.id].sourceNote || '근거 없음'}</li>)}</ul>
    </details>}
    <p role="status">{message}</p>
    <div style={{ display: 'flex', gap: 12 }}>
      <button type="button" disabled={!parsed.success || pasteErrors.length > 0 || busy || publishedHere || cycleId !== null} onClick={() => void submit('CREATE_DRAFT')}>초안 저장</button>
      <button type="button" disabled={!canPublish} onClick={() => setConfirming(true)}>게시 확인</button>
    </div>
    {confirming && parsed.success && <div role="dialog" aria-modal="true" aria-labelledby="confirm-publish" style={{ border: '2px solid var(--primary)', padding: 20, marginTop: 20 }}>
      <h2 id="confirm-publish">가격 주기를 게시할까요?</h2>
      <p>{displayTime(parsed.data.startsAt)} ~ {displayTime(new Date(Date.parse(parsed.data.startsAt) + CYCLE_DURATION_MS).toISOString())} (Asia/Seoul)</p>
      <p>{dishes.length}개 요리의 가격이 공개됩니다. 게시 직전에 서버에서 다시 검증합니다.</p>
      <button type="button" disabled={!canPublish} onClick={() => void submit('PUBLISH')}>게시 확정</button>
      <button type="button" disabled={busy} onClick={() => setConfirming(false)}>게시 취소</button>
    </div>}
  </section>
}
