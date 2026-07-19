import { describe, expect, it } from 'vitest'
import { buildLegs, formatWalkMinutes, straightLeg, totalWalk, type RouteLeg } from './route-legs'

// ~1,1 км по прямой вдоль улицы Республики
const A = { lng: 65.534, lat: 57.152 }
const B = { lng: 65.552, lat: 57.152 }

describe('straightLeg', () => {
  it('считает метры с коэффициентом обхода и время по скорости пешехода', () => {
    const leg = straightLeg(A, B)
    expect(leg.source).toBe('straight')
    expect(leg.coordinates).toEqual([[A.lng, A.lat], [B.lng, B.lat]])
    expect(leg.meters).toBeGreaterThan(1200)
    expect(leg.meters).toBeLessThan(1600)
    // 4,7 км/ч ≈ 1,3 м/с
    expect(leg.seconds).toBe(Math.round(leg.meters / (4.7 / 3.6)))
  })
})

describe('buildLegs', () => {
  it('использует сохранённый уличный путь, а без него — прямую', () => {
    const stored: RouteLeg = { coordinates: [[1, 2], [1.5, 2.2], [2, 3]], seconds: 700, meters: 900, source: 'osrm' }
    const legs = buildLegs([
      { ...A, pathToNext: stored },
      { ...B, pathToNext: null },
      { lng: 65.56, lat: 57.16 },
    ])
    expect(legs).toHaveLength(2)
    expect(legs[0]).toEqual(stored)
    expect(legs[1]!.source).toBe('straight')
  })

  it('одна точка — ноль сегментов', () => {
    expect(buildLegs([A])).toEqual([])
  })
})

describe('totalWalk', () => {
  it('суммирует секунды и метры', () => {
    const legs = buildLegs([A, B, { lng: 65.56, lat: 57.16 }])
    const total = totalWalk(legs)
    expect(total.seconds).toBe(legs[0]!.seconds + legs[1]!.seconds)
    expect(total.meters).toBe(legs[0]!.meters + legs[1]!.meters)
  })
})

describe('formatWalkMinutes', () => {
  it('короткий сегмент — минимум одна минута', () => expect(formatWalkMinutes(20)).toBe('≈1 мин'))
  it('округляет к ближайшей минуте', () => expect(formatWalkMinutes(290)).toBe('≈5 мин'))
  it('больше часа — часы и минуты', () => expect(formatWalkMinutes(11350)).toBe('≈3 ч 9 мин'))
  it('ровно час — без минут', () => expect(formatWalkMinutes(3600)).toBe('≈1 ч'))
})
