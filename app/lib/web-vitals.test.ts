import { describe, expect, it } from 'vitest'
import { webVitalSchema } from './web-vitals'

describe('webVitalSchema', () => {
  it('accepts bounded browser metrics and rejects arbitrary events', () => {
    expect(webVitalSchema.safeParse({
      id: 'v1-1', name: 'LCP', value: 1800, rating: 'good', path: '/object/1',
    }).success).toBe(true)
    expect(webVitalSchema.safeParse({
      id: 'v1-1', name: 'password', value: 1, rating: 'good', path: '/',
    }).success).toBe(false)
  })
})
