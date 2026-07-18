import { z } from 'zod'

export const shortLinkCodeSchema = z.string().regex(/^[A-Za-z0-9_-]{6,32}$/)

// Маршруты и люди адресуются slug-ом: без него ссылка не строится (страниц по UUID нет).
export function shortLinkTargetPath(type: string, id: string, slug?: string | null): string | null {
  if (type === 'object') return `/object/${id}`
  if (type === 'event') return `/event/${id}`
  if (type === 'route') return slug ? `/routes/${slug}` : null
  if (type === 'person') return slug ? `/people/${slug}` : null
  return null
}
