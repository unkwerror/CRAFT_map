export const PLACE_PROGRESS_VERSION = 1 as const
export const PLACE_PROGRESS_STORAGE_KEY = 'craft-map-place-progress'
export const PLACE_PROGRESS_EVENT = 'craft-map-place-progress-change'

export interface PlaceProgressState {
  version: typeof PLACE_PROGRESS_VERSION
  favorites: string[]
  visited: string[]
}

export type PlaceProgressCollection = 'favorites' | 'visited'

export function emptyPlaceProgress(): PlaceProgressState {
  return { version: PLACE_PROGRESS_VERSION, favorites: [], visited: [] }
}

function sanitizeIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const unique = new Set<string>()
  for (const item of value) {
    if (typeof item !== 'string' || !item.trim() || item.length > 256) continue
    unique.add(item)
    if (unique.size === 5_000) break
  }
  return [...unique]
}

export function normalizePlaceProgress(value: unknown): PlaceProgressState {
  if (!value || typeof value !== 'object') return emptyPlaceProgress()
  const candidate = value as Partial<PlaceProgressState>
  if (candidate.version !== PLACE_PROGRESS_VERSION) return emptyPlaceProgress()
  return {
    version: PLACE_PROGRESS_VERSION,
    favorites: sanitizeIds(candidate.favorites),
    visited: sanitizeIds(candidate.visited),
  }
}

export function parsePlaceProgress(raw: string | null): PlaceProgressState {
  if (!raw) return emptyPlaceProgress()
  try {
    return normalizePlaceProgress(JSON.parse(raw) as unknown)
  } catch {
    return emptyPlaceProgress()
  }
}

export function readPlaceProgress(storage: Pick<Storage, 'getItem'>): PlaceProgressState {
  return parsePlaceProgress(storage.getItem(PLACE_PROGRESS_STORAGE_KEY))
}

export function writePlaceProgress(
  storage: Pick<Storage, 'setItem'>,
  state: PlaceProgressState
): PlaceProgressState {
  const normalized = normalizePlaceProgress(state)
  storage.setItem(PLACE_PROGRESS_STORAGE_KEY, JSON.stringify(normalized))
  return normalized
}

export function togglePlaceProgress(
  state: PlaceProgressState,
  collection: PlaceProgressCollection,
  objectId: string
): PlaceProgressState {
  const normalized = normalizePlaceProgress(state)
  if (!objectId) return normalized
  const values = normalized[collection]
  const nextValues = values.includes(objectId)
    ? values.filter((id) => id !== objectId)
    : [...values, objectId]
  return { ...normalized, [collection]: nextValues }
}
