import { describe, expect, it } from 'vitest'
import { geofenceState, haversineMeters } from './geofence'

describe('route geofence', () => {
  it('calculates a plausible distance', () => expect(haversineMeters({ lat: 57.15, lng: 65.53 }, { lat: 57.151, lng: 65.53 })).toBeGreaterThan(100))
  it('uses hysteresis after entry', () => {
    expect(geofenceState(45, 40, false)).toBe(false)
    expect(geofenceState(45, 40, true)).toBe(true)
  })
})
