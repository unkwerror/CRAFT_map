import { describe, expect, it } from 'vitest'
import { formatDistance, haversineDistanceMeters } from './geo'

describe('haversineDistanceMeters', () => {
  it('returns zero for the same point and is symmetric', () => {
    const tyumen = { lat: 57.153, lng: 65.5343 }
    const nearby = { lat: 57.161, lng: 65.548 }

    expect(haversineDistanceMeters(tyumen, tyumen)).toBe(0)
    expect(haversineDistanceMeters(tyumen, nearby)).toBeCloseTo(
      haversineDistanceMeters(nearby, tyumen),
      8
    )
  })

  it('matches the known length of one latitude degree', () => {
    expect(haversineDistanceMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }))
      .toBeCloseTo(111_195, -1)
  })

  it('does not let invalid coordinates break distance sorting', () => {
    expect(haversineDistanceMeters({ lat: Number.NaN, lng: 0 }, { lat: 1, lng: 1 }))
      .toBe(Number.POSITIVE_INFINITY)
  })
})

describe('formatDistance', () => {
  it('formats walking distances in metres and kilometres', () => {
    expect(formatDistance(347)).toBe('350 м')
    expect(formatDistance(1_240)).toBe('1,2 км')
  })
})
