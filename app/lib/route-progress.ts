export interface GuestRouteProgress {
  routeId: string
  routeVersion: number
  reachedStopIds: string[]
  startedAt: string
  completedAt: string | null
}

// totalStops передаётся вызывающей стороной: когда отмечены все точки, маршрут считается завершённым.
export function markRouteStopReached(progress: GuestRouteProgress, stopId: string, totalStops?: number): GuestRouteProgress {
  if (progress.reachedStopIds.includes(stopId)) return progress
  const reachedStopIds = [...progress.reachedStopIds, stopId]
  const completedAt = progress.completedAt
    ?? (totalStops && reachedStopIds.length >= totalStops ? new Date().toISOString() : null)
  return { ...progress, reachedStopIds, completedAt }
}

export function routeProgressKey(routeId: string): string {
  return `pamyat.route-progress.v1.${routeId}`
}
