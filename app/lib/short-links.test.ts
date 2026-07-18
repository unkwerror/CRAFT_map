import { describe, expect, it } from 'vitest'
import { shortLinkCodeSchema, shortLinkTargetPath } from './short-links'

describe('short links', () => {
  it('accepts opaque codes only', () => {
    expect(shortLinkCodeSchema.safeParse('Tyumen_01').success).toBe(true)
    expect(shortLinkCodeSchema.safeParse('../https://evil.test').success).toBe(false)
  })
  it('maps only internal target types', () => {
    expect(shortLinkTargetPath('object', 'id')).toBe('/object/id')
    expect(shortLinkTargetPath('external', 'https://evil.test')).toBeNull()
  })
  it('routes and people need a slug, not a uuid', () => {
    expect(shortLinkTargetPath('route', 'uuid')).toBeNull()
    expect(shortLinkTargetPath('route', 'uuid', 'voennaya-istoriya')).toBe('/routes/voennaya-istoriya')
    expect(shortLinkTargetPath('person', 'uuid', 'ivan-petrov')).toBe('/people/ivan-petrov')
  })
})
