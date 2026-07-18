'use client'
import { useEffect, useState } from 'react'

type Manifest = { routeUrl: string; approxTotalBytes?: number; assets: Array<{ photos: unknown; audioUrl: string | null }> }

const formatBytes = (bytes: number) => bytes >= 1024 * 1024
  ? `${(bytes / 1024 / 1024).toFixed(1)} МБ`
  : `${Math.max(1, Math.round(bytes / 1024))} КБ`

export default function OfflineRoutePackage({ slug, version }: { slug: string; version: number }) {
  const key = `pamyat-route-${slug}-v${version}`
  const [status, setStatus] = useState<'idle'|'loading'|'ready'|'error'>('idle')
  const [progress, setProgress] = useState('')
  const [manifest, setManifest] = useState<Manifest | null>(null)

  // Устаревшие версии пакета удаляются, чтобы не копить квоту хранилища.
  async function dropStaleVersions() {
    const keys = await caches.keys()
    await Promise.all(keys.filter((name) => name.startsWith(`pamyat-route-${slug}-v`) && name !== key).map((name) => caches.delete(name)))
  }
  useEffect(() => {
    if (!('caches' in window)) return
    void caches.has(key).then((v) => v && setStatus('ready')).catch(() => {})
    void dropStaleVersions().catch(() => {})
    void fetch(`/api/v1/routes/${slug}/offline-manifest`).then((r) => r.ok ? r.json() : null).then((m) => m && setManifest(m as Manifest)).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, slug])

  async function download() {
    if (!('caches' in window)) return setStatus('error')
    setStatus('loading')
    try {
      let fresh = manifest
      if (!fresh) {
        const response = await fetch(`/api/v1/routes/${slug}/offline-manifest`)
        if (!response.ok) throw new Error()
        fresh = await response.json() as Manifest
      }
      setManifest(fresh)
      const urls = new Set<string>([fresh.routeUrl, `/routes/${slug}`])
      for (const asset of fresh.assets) {
        if (asset.audioUrl) urls.add(asset.audioUrl)
        if (Array.isArray(asset.photos)) for (const raw of asset.photos) {
          const photo = raw as { thumb?: string }
          if (photo?.thumb) urls.add(photo.thumb)
        }
      }
      const cache = await caches.open(key); let done = 0
      for (const url of urls) { const item = await fetch(url); if (item.ok) await cache.put(url, item); setProgress(`${++done} из ${urls.size}`) }
      await dropStaleVersions()
      setStatus('ready')
    } catch { await caches.delete(key); setStatus('error') }
  }
  async function remove() { await caches.delete(key); setStatus('idle'); setProgress('') }
  const size = manifest?.approxTotalBytes ? ` (~${formatBytes(manifest.approxTotalBytes)})` : ''
  return <section className="mt-4 rounded-xl border border-[var(--hairline)] p-4"><h2 className="font-semibold">Офлайн-пакет</h2><p className="mt-1 text-sm text-[var(--ink-muted)]">Карточки, превью и аудио маршрута{size ? ` — примерно ${formatBytes(manifest!.approxTotalBytes!)}` : ''}.</p><div className="mt-3">{status !== 'ready' ? <button onClick={download} disabled={status === 'loading'} className="min-h-11 rounded-xl border border-[var(--hairline)] px-4">{status === 'loading' ? `Загрузка ${progress}` : `Скачать${size}`}</button> : <button onClick={remove} className="min-h-11 rounded-xl border border-[var(--hairline)] px-4">Удалить пакет</button>}</div>{status === 'error' && <p role="status" className="mt-2 text-sm text-red-300">Не удалось сохранить пакет. Проверьте сеть и свободное место.</p>}</section>
}
