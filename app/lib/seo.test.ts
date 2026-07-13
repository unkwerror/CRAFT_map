import { describe, expect, it } from 'vitest'
import { absoluteSiteUrl, serializeJsonLd } from './seo'

describe('absoluteSiteUrl', () => {
  it('builds canonical URLs on the production domain', () => {
    expect(absoluteSiteUrl('/object/123')).toBe(
      'https://xn--80ayho4cq.site/object/123'
    )
  })

  it('keeps already absolute media URLs', () => {
    expect(absoluteSiteUrl('https://cdn.example/photo.webp')).toBe(
      'https://cdn.example/photo.webp'
    )
  })
})

describe('serializeJsonLd', () => {
  it('escapes markup without changing the parsed JSON value', () => {
    const value = { description: '</script><script>alert(1)</script>' }
    const serialized = serializeJsonLd(value)

    expect(serialized).not.toContain('<')
    expect(JSON.parse(serialized)).toEqual(value)
  })
})
