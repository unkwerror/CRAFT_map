import { z } from 'zod'
import type { RouteLeg } from './route-legs'

export const routeModeSchema = z.enum(['walking', 'bicycle', 'car'])
export const routeInputSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120),
  title: z.string().trim().min(1).max(300),
  summary: z.string().trim().max(1000).nullish(),
  description: z.string().max(20000).nullish(),
  coverUrl: z.string().regex(/^\/uploads\/[a-zA-Z0-9._-]+$/).nullish(),
  theme: z.string().trim().max(200).nullish(),
  mode: routeModeSchema.default('walking'),
  estimatedDurationMinutes: z.number().int().min(1).max(1440).nullish(),
  distanceMeters: z.number().int().min(0).max(1_000_000).nullish(),
  difficulty: z.string().trim().max(100).nullish(),
  ageGroup: z.string().trim().max(100).nullish(),
  accessibilityProfile: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
  status: z.enum(['draft','review','changes_requested','approved','published','archived']).default('draft'),
  stops: z.array(z.object({
    objectId: z.string().uuid(),
    arrivalRadiusMeters: z.number().int().min(10).max(500).default(40),
    recommendedDurationMinutes: z.number().int().min(1).max(240).nullish(),
    introText: z.string().max(5000).nullish(),
    directionsText: z.string().max(5000).nullish(),
    gpsAutoplay: z.boolean().default(false),
  })).max(100).default([]),
}).superRefine((route, ctx) => {
  if (route.status === 'published' && route.stops.length < 2) {
    ctx.addIssue({ code: 'custom', path: ['stops'], message: 'Для публикации нужны минимум две остановки' })
  }
  if (new Set(route.stops.map((stop) => stop.objectId)).size !== route.stops.length) {
    ctx.addIssue({ code: 'custom', path: ['stops'], message: 'Остановка не может повторяться' })
  }
})

export interface PublicRouteStop {
  id: string; objectId: string; title: string; address: string | null
  lat: number; lng: number; position: number; arrivalRadiusMeters: number
  recommendedDurationMinutes: number | null; introText: string | null
  directionsText: string | null; audioUrl: string | null; audioText: string | null
  shortAudioUrl?: string | null; shortAudioText?: string | null
  fullAudioUrl?: string | null; fullAudioText?: string | null
  /** Превью первого фото объекта — для обзорного списка точек на странице маршрута. */
  thumb?: string | null
}

export interface PublicRoute {
  id: string; slug: string; title: string; summary: string | null; description: string | null
  coverUrl: string | null; theme: string | null; mode: 'walking' | 'bicycle' | 'car'
  estimatedDurationMinutes: number | null; distanceMeters: number | null
  difficulty: string | null; ageGroup: string | null; accessibilityProfile: Record<string, unknown>
  offlinePackageVersion: number; stops: PublicRouteStop[]
  /** Сегменты между точками по улицам (или прямые с оценкой) и суммарное пешеходное время. */
  legs?: RouteLeg[]
  walkSeconds?: number | null
  walkMeters?: number | null
}

