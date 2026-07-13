import type { MetadataRoute } from 'next'
import { pg } from '@/lib/db'
import { absoluteSiteUrl } from '@/lib/seo'

export const dynamic = 'force-dynamic'

interface SitemapObjectRow {
  id: string
  updated_at: Date
}

interface SitemapEventRow {
  id: string
  updated_at: Date
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [rows, eventRows] = await Promise.all([
    pg<SitemapObjectRow[]>`
      select id, updated_at
      from objects
      where published
      order by updated_at desc`,
    pg<SitemapEventRow[]>`
      select e.id, e.updated_at
      from events e
      join objects o on o.id = e.object_id
      where e.published and o.published
      order by e.updated_at desc`,
  ])

  const home: MetadataRoute.Sitemap[number] = {
    url: absoluteSiteUrl('/'),
    lastModified: [rows[0]?.updated_at, eventRows[0]?.updated_at]
      .filter((value): value is Date => Boolean(value))
      .sort((left, right) => right.getTime() - left.getTime())[0],
    changeFrequency: 'daily',
    priority: 1,
  }

  return [
    home,
    ...rows.map((row) => ({
      url: absoluteSiteUrl(`/object/${row.id}`),
      lastModified: row.updated_at,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    ...eventRows.map((row) => ({
      url: absoluteSiteUrl(`/event/${row.id}`),
      lastModified: row.updated_at,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ]
}
