import { describe, expect, it } from 'vitest'
import { markRouteStopReached, routeProgressKey } from './route-progress'

describe('guest route progress', () => {
  const progress = { routeId: 'r', routeVersion: 1, reachedStopIds: [], startedAt: '2026-07-18T00:00:00Z', completedAt: null }
  it('does not add a stop twice', () => {
    const reached = markRouteStopReached(progress, 's1')
    expect(markRouteStopReached(reached, 's1')).toBe(reached)
  })
  it('uses a stable per-route key', () => expect(routeProgressKey('abc')).toBe('pamyat.route-progress.v1.abc'))
  it('marks the route completed only when every stop is reached', () => {
    const one = markRouteStopReached(progress, 's1', 2)
    expect(one.completedAt).toBeNull()
    const both = markRouteStopReached(one, 's2', 2)
    expect(both.completedAt).not.toBeNull()
    expect(markRouteStopReached(both, 's2', 2)).toBe(both)
  })
})

