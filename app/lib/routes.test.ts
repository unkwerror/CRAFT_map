import { describe, expect, it } from 'vitest'
import { routeInputSchema } from './routes'

describe('route validation', () => {
  const base = { slug: 'center-60', title: 'Центр за час' }
  it('does not publish fewer than two stops', () => {
    expect(routeInputSchema.safeParse({ ...base, status: 'published', stops: [] }).success).toBe(false)
  })
  it('accepts a draft without stops', () => expect(routeInputSchema.safeParse(base).success).toBe(true))
})

