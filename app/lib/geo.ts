export interface Coordinates {
  lat: number
  lng: number
}

const EARTH_RADIUS_METERS = 6_371_008.8

function toRadians(degrees: number): number {
  return degrees * Math.PI / 180
}

/** Расстояние по поверхности Земли между двумя координатами. */
export function haversineDistanceMeters(from: Coordinates, to: Coordinates): number {
  const values = [from.lat, from.lng, to.lat, to.lng]
  if (!values.every(Number.isFinite)) return Number.POSITIVE_INFINITY

  const fromLat = toRadians(from.lat)
  const toLat = toRadians(to.lat)
  const latitudeDelta = toRadians(to.lat - from.lat)
  const longitudeDelta = toRadians(to.lng - from.lng)
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(longitudeDelta / 2) ** 2
  const bounded = Math.min(1, Math.max(0, a))
  const centralAngle = 2 * Math.atan2(Math.sqrt(bounded), Math.sqrt(1 - bounded))
  return EARTH_RADIUS_METERS * centralAngle
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return ''
  if (meters < 1_000) return `${Math.round(meters / 10) * 10} м`
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(meters / 1_000)} км`
}
