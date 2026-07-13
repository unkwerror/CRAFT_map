import { z } from 'zod'

const metricNames = ['TTFB', 'FCP', 'LCP', 'FID', 'CLS', 'INP'] as const

export const webVitalSchema = z.object({
  id: z.string().min(1).max(200),
  name: z.enum(metricNames),
  value: z.number().finite().min(0).max(60 * 60 * 1000),
  rating: z.enum(['good', 'needs-improvement', 'poor']),
  navigationType: z.string().max(50).optional(),
  path: z.string().startsWith('/').max(500),
})

export type WebVitalPayload = z.infer<typeof webVitalSchema>
