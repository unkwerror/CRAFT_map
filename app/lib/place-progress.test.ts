import { describe, expect, it } from 'vitest'
import {
  PLACE_PROGRESS_STORAGE_KEY,
  emptyPlaceProgress,
  parsePlaceProgress,
  readPlaceProgress,
  togglePlaceProgress,
  writePlaceProgress,
} from './place-progress'

describe('place progress persistence', () => {
  it('rejects malformed and unknown versions', () => {
    expect(parsePlaceProgress('{broken')).toEqual(emptyPlaceProgress())
    expect(parsePlaceProgress(JSON.stringify({ version: 2, favorites: ['a'], visited: [] })))
      .toEqual(emptyPlaceProgress())
  })

  it('deduplicates valid ids and drops damaged values', () => {
    expect(parsePlaceProgress(JSON.stringify({
      version: 1,
      favorites: ['a', 'a', '', null],
      visited: ['b', 4, 'c'],
    }))).toEqual({ version: 1, favorites: ['a'], visited: ['b', 'c'] })
  })

  it('toggles collections without mutating the previous state', () => {
    const initial = { version: 1 as const, favorites: ['a'], visited: [] }
    const added = togglePlaceProgress(initial, 'visited', 'a')
    const removed = togglePlaceProgress(added, 'favorites', 'a')

    expect(initial).toEqual({ version: 1, favorites: ['a'], visited: [] })
    expect(added).toEqual({ version: 1, favorites: ['a'], visited: ['a'] })
    expect(removed).toEqual({ version: 1, favorites: [], visited: ['a'] })
  })

  it('round-trips through a storage-compatible object', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    const state = { version: 1 as const, favorites: ['a'], visited: ['b'] }

    writePlaceProgress(storage, state)

    expect(values.has(PLACE_PROGRESS_STORAGE_KEY)).toBe(true)
    expect(readPlaceProgress(storage)).toEqual(state)
  })
})
