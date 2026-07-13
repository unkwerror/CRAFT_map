import { describe, expect, it } from 'vitest'
import { parseRecentSearches } from './SearchBar'

describe('parseRecentSearches', () => {
  it('returns an empty history for missing or malformed storage', () => {
    expect(parseRecentSearches(null)).toEqual([])
    expect(parseRecentSearches('{broken')).toEqual([])
    expect(parseRecentSearches('{"kind":"object"}')).toEqual([])
  })

  it('keeps only valid unique entries and limits the history to five', () => {
    const raw = JSON.stringify([
      { kind: 'object', id: 'object-1' },
      { kind: 'object', id: 'object-1' },
      { kind: 'category', id: 'history' },
      { kind: 'district', id: '2' },
      { kind: 'unknown', id: 'bad' },
      { kind: 'object', id: '' },
      { kind: 'object', id: 'object-2' },
      { kind: 'object', id: 'object-3' },
      { kind: 'object', id: 'object-4' },
    ])

    expect(parseRecentSearches(raw)).toEqual([
      { kind: 'object', id: 'object-1' },
      { kind: 'category', id: 'history' },
      { kind: 'district', id: '2' },
      { kind: 'object', id: 'object-2' },
      { kind: 'object', id: 'object-3' },
    ])
  })
})
