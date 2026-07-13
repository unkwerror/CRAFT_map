/* Частичный offline-режим: shell, публичные данные и уже открытые медиа. */
const VERSION = 'craft-map-v2'
const STATIC_CACHE = `${VERSION}-static`
const DATA_CACHE = `${VERSION}-data`
const MEDIA_CACHE = `${VERSION}-media`
const SHELL = ['/', '/offline', '/manifest.webmanifest', '/icon.svg']

function isPrivatePath(pathname) {
  return pathname === '/admin' || pathname.startsWith('/admin/') ||
    pathname === '/api/admin' || pathname.startsWith('/api/admin/') ||
    pathname === '/api/auth' || pathname.startsWith('/api/auth/')
}

function mayStore(response) {
  if (!response.ok) return false
  const cacheControl = (response.headers.get('cache-control') || '').toLowerCase()
  return !cacheControl.includes('no-store') && !cacheControl.includes('private')
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith('craft-map-') && !key.startsWith(VERSION))
        .map((key) => caches.delete(key))
    ))
  )
  self.clients.claim()
})

async function networkFirst(request, cacheName, fallback) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (mayStore(response)) await cache.put(request, response.clone())
    else if (response.status === 404 || response.status === 410) await cache.delete(request)
    return response
  } catch {
    return (await cache.match(request)) || (fallback ? await caches.match(fallback) : Response.error())
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  const network = fetch(request).then(async (response) => {
    if (mayStore(response)) await cache.put(request, response.clone())
    else if (response.status === 404 || response.status === 410) await cache.delete(request)
    return response
  }).catch(() => null)
  return cached || (await network) || Response.error()
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (mayStore(response)) await cache.put(request, response.clone())
  else if (response.status === 404 || response.status === 410) await cache.delete(request)
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Админка и Auth.js всегда идут только в сеть: персональные HTML/API не попадают в Cache API.
  if (isPrivatePath(url.pathname)) return

  // PMTiles использует Range; Cache API не должен подменять частичные ответы полным файлом.
  if (request.headers.has('range') || url.pathname.startsWith('/tiles/')) return

  if (request.mode === 'navigate') {
    // Для query-состояний карты (`?view=events`, `?object=…`) достаточно shell `/`:
    // адресная строка остаётся прежней, а клиент восстановит состояние из неё.
    const fallback = url.pathname === '/' ? '/' : '/offline'
    event.respondWith(networkFirst(request, STATIC_CACHE, fallback))
    return
  }
  if (/^\/api\/(objects(?:\/[^/]+)?|districts|events)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, DATA_CACHE))
    return
  }
  if (url.pathname.startsWith('/uploads/')) {
    event.respondWith(cacheFirst(request, MEDIA_CACHE))
    return
  }
  if (url.pathname.startsWith('/_next/static/') || url.pathname === '/icon.svg') {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
  }
})
