import { type PublishedCatalog } from '../types'
import { mapPublishedCatalog } from './catalog-mapper'
import rows from './fixture-rows.json'

// Fixed synthetic catalog for local development and tests. Callers must use a
// time inside 2026-09-16 00:00+09 <= now < 2026-09-19 00:00+09.
export function getFixtureCatalog(now: Date): PublishedCatalog {
  return mapPublishedCatalog(rows, now)
}
