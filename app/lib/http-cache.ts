import { createHash } from 'node:crypto'

interface PublicCacheOptions {
  maxAge: number
  staleWhileRevalidate: number
}

function matchesEtag(header: string | null, etag: string): boolean {
  if (!header) return false
  return header
    .split(',')
    .map((candidate) => candidate.trim())
    .some((candidate) => candidate === '*' || candidate === etag || `W/${candidate}` === etag)
}

/** JSON-ответ с детерминированным weak ETag и коротким публичным кэшем. */
export function publicJsonResponse(
  request: Pick<Request, 'headers'>,
  payload: unknown,
  options: PublicCacheOptions
): Response {
  const body = JSON.stringify(payload)
  const digest = createHash('sha256').update(body).digest('base64url')
  const etag = `W/"${digest}"`
  const cacheControl =
    `public, max-age=${options.maxAge}, stale-while-revalidate=${options.staleWhileRevalidate}`
  const headers = {
    'Cache-Control': cacheControl,
    ETag: etag,
    Vary: 'Accept-Encoding',
  }

  if (matchesEtag(request.headers.get('if-none-match'), etag)) {
    return new Response(null, { status: 304, headers })
  }

  return new Response(body, {
    status: 200,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
  })
}
