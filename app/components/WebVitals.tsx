'use client'

import { useReportWebVitals } from 'next/web-vitals'

const reportMetric: Parameters<typeof useReportWebVitals>[0] = (metric) => {
  const body = JSON.stringify({
    id: metric.id,
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    navigationType: metric.navigationType,
    path: window.location.pathname,
  })
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/metrics/web-vitals', new Blob([body], { type: 'application/json' }))
    return
  }
  void fetch('/api/metrics/web-vitals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  })
}

export default function WebVitals() {
  useReportWebVitals(reportMetric)
  return null
}
