import type { MetadataRoute } from 'next'
import { absoluteSiteUrl, SITE_URL } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api'],
    },
    sitemap: absoluteSiteUrl('/sitemap.xml'),
    host: SITE_URL.origin,
  }
}
