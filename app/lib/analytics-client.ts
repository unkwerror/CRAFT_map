const KEY = 'pamyat.analytics.session.v1'

function sessionId(): string | null {
  try {
    const current = window.sessionStorage.getItem(KEY)
    if (current) return current
    const bytes = crypto.getRandomValues(new Uint8Array(18))
    const created = btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
    window.sessionStorage.setItem(KEY, created)
    return created
  } catch {
    return null
  }
}

export function trackPublicEvent(eventName: 'map_open' | 'place_open', entityId?: string): void {
  const id = sessionId()
  if (!id) return
  const body = JSON.stringify({
    eventName, schemaVersion: 1, timestamp: new Date().toISOString(), sessionId: id,
    entityType: entityId ? 'object' : null, entityId: entityId ?? null,
    deviceCategory: window.innerWidth < 600 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'desktop',
  })
  if (navigator.sendBeacon) navigator.sendBeacon('/api/v1/analytics/events', new Blob([body], { type: 'application/json' }))
  else void fetch('/api/v1/analytics/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true })
}
