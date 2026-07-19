import { haversineMeters } from './geofence'

export interface RouteLegPoint {
  lng: number
  lat: number
}

/** Сегмент маршрута между соседними точками: геометрия по улицам (osrm) или прямая (straight). */
export interface RouteLeg {
  coordinates: [number, number][]
  seconds: number
  meters: number
  source: 'osrm' | 'straight'
}

/** Пешеход: 4,7 км/ч; для прямой добавляем коэффициент обхода кварталов. */
const WALK_SPEED_MPS = 4.7 / 3.6
const DETOUR_FACTOR = 1.3

export function straightLeg(from: RouteLegPoint, to: RouteLegPoint): RouteLeg {
  const direct = haversineMeters({ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng })
  const meters = Math.round(direct * DETOUR_FACTOR)
  return {
    coordinates: [[from.lng, from.lat], [to.lng, to.lat]],
    seconds: Math.round(meters / WALK_SPEED_MPS),
    meters,
    source: 'straight',
  }
}

/** Собирает сегменты: сохранённый уличный путь, а где его нет — прямая с оценкой времени. */
export function buildLegs(
  stops: Array<RouteLegPoint & { pathToNext?: RouteLeg | null }>
): RouteLeg[] {
  const legs: RouteLeg[] = []
  for (let index = 0; index < stops.length - 1; index++) {
    const stored = stops[index]!.pathToNext
    legs.push(
      stored && Array.isArray(stored.coordinates) && stored.coordinates.length >= 2
        ? stored
        : straightLeg(stops[index]!, stops[index + 1]!)
    )
  }
  return legs
}

export function totalWalk(legs: RouteLeg[]): { seconds: number; meters: number } {
  return legs.reduce(
    (sum, leg) => ({ seconds: sum.seconds + leg.seconds, meters: sum.meters + leg.meters }),
    { seconds: 0, meters: 0 }
  )
}

export function formatWalkMinutes(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60))
  return `≈${minutes} мин`
}
