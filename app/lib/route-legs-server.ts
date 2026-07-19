import { pg } from './db'
import { straightLeg, type RouteLeg, type RouteLegPoint } from './route-legs'

/**
 * Self-hosted OSRM (пешеходный профиль) во внутренней docker-сети.
 * Внешние роутинг-API проектом запрещены; без OSRM_URL и при его недоступности
 * маршруты живут на прямых сегментах с оценкой времени по расстоянию.
 */
const OSRM_URL = process.env.OSRM_URL?.replace(/\/$/, '') ?? ''
const OSRM_TIMEOUT_MS = 2500
const OSRM_MUTE_AFTER_FAILURE_MS = 60_000
const MAX_HEAL_STOPS = 40

let osrmMutedUntil = 0

interface OsrmRouteResponse {
  code: string
  routes?: Array<{
    distance: number
    duration: number
    geometry: { coordinates: [number, number][] }
  }>
}

async function osrmFootLeg(from: RouteLegPoint, to: RouteLegPoint): Promise<RouteLeg | null> {
  if (!OSRM_URL || Date.now() < osrmMutedUntil) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS)
  try {
    const url = `${OSRM_URL}/route/v1/foot/${from.lng},${from.lat};${to.lng},${to.lat}` +
      '?overview=full&geometries=geojson&steps=false&alternatives=false'
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) {
      osrmMutedUntil = Date.now() + OSRM_MUTE_AFTER_FAILURE_MS
      return null
    }
    const payload = await response.json() as OsrmRouteResponse
    const route = payload.code === 'Ok' ? payload.routes?.[0] : undefined
    if (!route || !Array.isArray(route.geometry?.coordinates) || route.geometry.coordinates.length < 2) {
      return null
    }
    return {
      coordinates: route.geometry.coordinates,
      seconds: Math.max(1, Math.round(route.duration)),
      meters: Math.max(1, Math.round(route.distance)),
      source: 'osrm',
    }
  } catch {
    osrmMutedUntil = Date.now() + OSRM_MUTE_AFTER_FAILURE_MS
    return null
  } finally {
    clearTimeout(timer)
  }
}

interface StopRow extends RouteLegPoint {
  id: string
  pathToNext: RouteLeg | null
}

async function loadStopRows(routeId: string): Promise<StopRow[]> {
  return pg<StopRow[]>`
    select rs.id, st_x(o.geom) as lng, st_y(o.geom) as lat, rs.path_to_next as "pathToNext"
    from route_stops rs
    join objects o on o.id = rs.object_id
    where rs.route_id = ${routeId}
    order by rs.position`
}

/**
 * Пересчитывает уличные сегменты маршрута и сохраняет их в route_stops.
 * Ошибки не пробрасываются: сохранение маршрута важнее геометрии,
 * недостающие сегменты долечатся при следующем чтении.
 */
export async function refreshRouteLegs(routeId: string): Promise<void> {
  try {
    const stops = await loadStopRows(routeId)
    for (let index = 0; index < stops.length; index++) {
      const current = stops[index]!
      const next = stops[index + 1]
      const leg = next ? await osrmFootLeg(current, next) : null
      await pg`
        update route_stops set
          path_to_next = ${leg ? JSON.stringify(leg) : null}::jsonb,
          walk_seconds_to_next = ${leg?.seconds ?? null},
          walk_meters_to_next = ${leg?.meters ?? null}
        where id = ${current.id}`
    }
  } catch (error) {
    console.error('refreshRouteLegs', error)
  }
}

/**
 * Сегменты маршрута для публичной выдачи: сохранённые уличные пути,
 * недостающие — одна попытка долечить через OSRM, иначе прямые с оценкой.
 */
export async function ensureRouteLegs(
  routeId: string,
  stops: Array<RouteLegPoint & { pathToNext?: RouteLeg | null }>
): Promise<RouteLeg[]> {
  const legs: RouteLeg[] = []
  let healed = false
  for (let index = 0; index < stops.length - 1; index++) {
    const stored = stops[index]!.pathToNext
    if (stored && Array.isArray(stored.coordinates) && stored.coordinates.length >= 2) {
      legs.push(stored)
      continue
    }
    let leg: RouteLeg | null = null
    if (stops.length <= MAX_HEAL_STOPS) {
      leg = await osrmFootLeg(stops[index]!, stops[index + 1]!)
      if (leg) healed = true
    }
    legs.push(leg ?? straightLeg(stops[index]!, stops[index + 1]!))
  }
  if (healed) {
    // Сохраняем то, что удалось долечить, чтобы следующие запросы читали из БД.
    void persistLegs(routeId, legs).catch((error) => console.error('persistLegs', error))
  }
  return legs
}

async function persistLegs(routeId: string, legs: RouteLeg[]): Promise<void> {
  const stops = await loadStopRows(routeId)
  for (let index = 0; index < stops.length - 1 && index < legs.length; index++) {
    const leg = legs[index]!
    if (leg.source !== 'osrm') continue
    await pg`
      update route_stops set
        path_to_next = ${JSON.stringify(leg)}::jsonb,
        walk_seconds_to_next = ${leg.seconds},
        walk_meters_to_next = ${leg.meters}
      where id = ${stops[index]!.id}`
  }
}
