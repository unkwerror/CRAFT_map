import type { MetadataRoute } from 'next'
import { pg } from '@/lib/db'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { absoluteSiteUrl } from '@/lib/seo'

export const dynamic = 'force-dynamic'

interface SitemapObjectRow {
  id: string
  updated_at: Date | string
}

interface SitemapEventRow {
  id: string
  updated_at: Date | string
}

interface SitemapSlugRow {
  slug: string
  updated_at: Date | string
}

// В standalone-бандле postgres-js отдаёт timestamptz строкой — приводим к Date явно.
const toDate = (value: Date | string | undefined): Date | undefined =>
  value === undefined ? undefined : new Date(value)

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routesEnabled = isFeatureEnabled('routes_enabled')
  const peopleEnabled = isFeatureEnabled('knowledge_graph_enabled')
  const [rows, eventRows, routeRows, peopleRows] = await Promise.all([
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
    routesEnabled
      ? pg<SitemapSlugRow[]>`
        select slug, updated_at
        from routes
        where status = 'published'
        order by updated_at desc`
      : Promise.resolve<SitemapSlugRow[]>([]),
    peopleEnabled
      ? pg<SitemapSlugRow[]>`
        select slug, updated_at
        from people
        where editorial_status = 'published'
        order by updated_at desc`
      : Promise.resolve<SitemapSlugRow[]>([]),
  ])

  const home: MetadataRoute.Sitemap[number] = {
    url: absoluteSiteUrl('/'),
    lastModified: [
      toDate(rows[0]?.updated_at),
      toDate(eventRows[0]?.updated_at),
      toDate(routeRows[0]?.updated_at),
      toDate(peopleRows[0]?.updated_at),
    ]
      .filter((value): value is Date => Boolean(value))
      .sort((left, right) => right.getTime() - left.getTime())[0],
    changeFrequency: 'daily',
    priority: 1,
  }

  return [
    home,
    ...(routesEnabled
      ? [{
          url: absoluteSiteUrl('/routes'),
          lastModified: toDate(routeRows[0]?.updated_at),
          changeFrequency: 'weekly' as const,
          priority: 0.6,
        }]
      : []),
    ...(peopleEnabled
      ? [{
          url: absoluteSiteUrl('/people'),
          lastModified: toDate(peopleRows[0]?.updated_at),
          changeFrequency: 'weekly' as const,
          priority: 0.6,
        }]
      : []),
    ...rows.map((row) => ({
      url: absoluteSiteUrl(`/object/${row.id}`),
      lastModified: toDate(row.updated_at),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    ...eventRows.map((row) => ({
      url: absoluteSiteUrl(`/event/${row.id}`),
      lastModified: toDate(row.updated_at),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...routeRows.map((row) => ({
      url: absoluteSiteUrl(`/routes/${row.slug}`),
      lastModified: toDate(row.updated_at),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...peopleRows.map((row) => ({
      url: absoluteSiteUrl(`/people/${row.slug}`),
      lastModified: toDate(row.updated_at),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ]
}
