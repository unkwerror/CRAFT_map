import { describe, expect, it } from 'vitest'
import { analyticsEventSchema } from './analytics'

describe('analyticsEventSchema', () => {
  const valid = {
    eventName: 'place_open', schemaVersion: 1, timestamp: '2026-07-18T10:00:00.000Z',
    sessionId: 'abcdefghijklmnop', entityType: 'object',
    entityId: '1b4e28ba-2fa1-4f62-8e02-4d0d8c6edaaa',
  }
  it('accepts allowlisted data', () => expect(analyticsEventSchema.safeParse(valid).success).toBe(true))
  it('rejects free text and unknown fields', () => {
    expect(analyticsEventSchema.safeParse({ ...valid, question: 'private text' }).success).toBe(false)
  })
})

