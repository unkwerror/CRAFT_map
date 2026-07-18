import { describe, expect, it } from 'vitest'
import { calculateReadiness, type ReadinessInput } from './readiness'

const complete: ReadinessInput = {
  hasCoordinates: true,
  address: 'ул. Республики, 1',
  photos: [{ alt: 'Памятник' }],
  sourceCount: 1,
  mediaRightsStatus: 'cleared',
  audioStatus: 'ready',
  accessibilityAttributes: { wheelchair: true },
  hasShortVariant: true,
  verificationStatus: 'verified',
}

describe('calculateReadiness', () => {
  it('returns 100 for a complete card', () => {
    expect(calculateReadiness(complete)).toEqual({ score: 100, missing: [] })
  })

  it('returns stable reasons for missing fields', () => {
    const result = calculateReadiness({ ...complete, sourceCount: 0, audioStatus: 'stale' })
    expect(result.score).toBe(80)
    expect(result.missing).toEqual(['Нет источников', 'Аудио отсутствует или устарело'])
  })
})

