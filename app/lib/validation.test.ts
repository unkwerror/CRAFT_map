import { describe, expect, it } from 'vitest'
import { objectInputSchema } from './validation'

const validObject = {
  title: 'Памятник',
  categoryId: 'memory',
  lng: 65.53,
  lat: 57.15,
}

describe('objectInputSchema', () => {
  it('applies safe defaults', () => {
    const result = objectInputSchema.parse(validObject)
    expect(result.sortWeight).toBe(0)
    expect(result.photos).toEqual([])
    expect(result.published).toBe(true)
  })

  it('accepts and preserves sort weight', () => {
    expect(objectInputSchema.parse({ ...validObject, sortWeight: 25 }).sortWeight).toBe(25)
  })

  it('rejects coordinates outside the globe', () => {
    expect(objectInputSchema.safeParse({ ...validObject, lat: 100 }).success).toBe(false)
  })
})
