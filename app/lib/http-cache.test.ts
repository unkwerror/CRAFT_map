import { describe, expect, it } from 'vitest'
import { publicJsonResponse } from './http-cache'

const options = { maxAge: 30, staleWhileRevalidate: 300 }

describe('publicJsonResponse', () => {
  it('returns deterministic ETag and public cache headers', async () => {
    const request = new Request('https://example.test/api/data')
    const first = publicJsonResponse(request, { value: 1 }, options)
    const second = publicJsonResponse(request, { value: 1 }, options)

    expect(first.status).toBe(200)
    expect(first.headers.get('etag')).toBe(second.headers.get('etag'))
    expect(first.headers.get('etag')).toMatch(/^W\/["].+["]$/)
    expect(first.headers.get('cache-control')).toBe(
      'public, max-age=30, stale-while-revalidate=300'
    )
    expect(await first.json()).toEqual({ value: 1 })
  })

  it('returns 304 for a matching weak ETag and changes it with the payload', () => {
    const initial = publicJsonResponse(
      new Request('https://example.test/api/data'),
      { value: 1 },
      options
    )
    const etag = initial.headers.get('etag') ?? ''
    const notModified = publicJsonResponse(
      new Request('https://example.test/api/data', { headers: { 'If-None-Match': etag } }),
      { value: 1 },
      options
    )
    const changed = publicJsonResponse(
      new Request('https://example.test/api/data'),
      { value: 2 },
      options
    )

    expect(notModified.status).toBe(304)
    expect(notModified.body).toBeNull()
    expect(changed.headers.get('etag')).not.toBe(etag)
  })
})
