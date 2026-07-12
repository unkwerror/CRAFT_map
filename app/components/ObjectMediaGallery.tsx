'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Photo, Video } from '@/lib/types'
import ModelViewer from './ModelViewer'

type MediaItem =
  | { key: string; type: 'photo'; src: string; thumb: string; label: string }
  | { key: string; type: 'video'; src: string; poster?: string; label: string }

interface Props {
  objectId: string
  title: string
  photos: Photo[]
  videos: Video[]
  modelUrl: string | null
}

/** Компактная галерея карточки: прямой выбор медиа, клавиатура, свайп и отдельный 3D-режим. */
export default function ObjectMediaGallery({ objectId, title, photos, videos, modelUrl }: Props) {
  const media = useMemo<MediaItem[]>(() => [
    ...photos.map((photo, index) => ({
      key: `photo-${index}-${photo.original}`,
      type: 'photo' as const,
      src: photo.original,
      thumb: photo.thumb || photo.original,
      label: photo.alt?.trim() || `${title}, фотография ${index + 1}`,
    })),
    ...videos.map((video, index) => ({
      key: `video-${index}-${video.src}`,
      type: 'video' as const,
      src: video.src,
      poster: video.poster,
      label: video.alt?.trim() || `${title}, видео ${index + 1}`,
    })),
  ], [photos, videos, title])
  const [mediaIdx, setMediaIdx] = useState(0)
  const [view, setView] = useState<'media' | '3d'>('media')
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const item = media[mediaIdx]

  useEffect(() => {
    setMediaIdx(0)
    setView(media.length === 0 && modelUrl ? '3d' : 'media')
  }, [objectId, media.length, modelUrl])

  const previous = () => {
    if (media.length > 1) setMediaIdx((index) => (index - 1 + media.length) % media.length)
  }
  const next = () => {
    if (media.length > 1) setMediaIdx((index) => (index + 1) % media.length)
  }

  if (!media.length && !modelUrl) {
    return (
      <div className="object-gallery-placeholder flex aspect-[16/10] w-full items-center justify-center bg-[var(--surface-2)] text-[var(--ink-subtle)] md:aspect-[4/3]">
        <svg width="38" height="38" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z" stroke="currentColor" strokeWidth="1.3" />
          <circle cx="12" cy="10" r="2" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      </div>
    )
  }

  return (
    <section className="object-gallery bg-black/20" aria-label="Фото, видео и 3D-модель">
      {modelUrl && media.length > 0 && (
        <div className="object-gallery__switch absolute left-3 top-3 z-10 flex gap-0.5 rounded-xl border border-white/10 bg-black/45 p-0.5 text-[11px] font-semibold text-white/75 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setView('media')}
            aria-pressed={view === 'media'}
            className={`min-h-9 rounded-[9px] px-3 transition-colors ${view === 'media' ? 'bg-white text-slate-900' : 'hover:text-white'}`}
          >
            Медиа
          </button>
          <button
            type="button"
            onClick={() => setView('3d')}
            aria-pressed={view === '3d'}
            className={`min-h-9 rounded-[9px] px-3 transition-colors ${view === '3d' ? 'bg-white text-slate-900' : 'hover:text-white'}`}
          >
            3D
          </button>
        </div>
      )}

      <div
        className="object-gallery__stage relative aspect-[16/10] w-full overflow-hidden outline-none md:aspect-[4/3]"
        tabIndex={view === 'media' && media.length > 1 ? 0 : -1}
        role={view === 'media' && media.length > 1 ? 'group' : undefined}
        aria-roledescription={view === 'media' && media.length > 1 ? 'карусель' : undefined}
        aria-label={view === 'media' && item ? `${item.type === 'video' ? 'Видео' : 'Фото'} ${mediaIdx + 1} из ${media.length}` : undefined}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') {
            event.preventDefault()
            previous()
          }
          if (event.key === 'ArrowRight') {
            event.preventDefault()
            next()
          }
        }}
        onTouchStart={(event) => {
          const target = event.target as HTMLElement
          if (target.closest('video, button, input')) return
          const touch = event.touches[0]
          if (touch) touchStart.current = { x: touch.clientX, y: touch.clientY }
        }}
        onTouchEnd={(event) => {
          const start = touchStart.current
          const touch = event.changedTouches[0]
          touchStart.current = null
          if (!start || !touch || media.length < 2) return
          const dx = touch.clientX - start.x
          const dy = touch.clientY - start.y
          if (Math.abs(dx) < 44 || Math.abs(dx) < Math.abs(dy) * 1.2) return
          if (dx > 0) previous()
          else next()
        }}
      >
        {view === '3d' && modelUrl ? (
          <ModelViewer src={modelUrl} alt={title} />
        ) : item?.type === 'video' ? (
          <video
            key={item.key}
            src={item.src}
            poster={item.poster}
            controls
            playsInline
            preload="metadata"
            aria-label={item.label}
            className="object-media h-full w-full bg-black object-contain"
          />
        ) : item ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={item.key}
            src={item.src}
            alt={item.label}
            decoding="async"
            className="object-media h-full w-full object-cover"
          />
        ) : null}

        {view === 'media' && item && (
          <span className={`pointer-events-none absolute left-3 rounded-lg border border-white/10 bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white/90 backdrop-blur ${item.type === 'video' ? 'bottom-14' : 'bottom-3'}`}>
            {item.type === 'video' ? 'Видео' : 'Фото'} · {mediaIdx + 1}/{media.length}
          </span>
        )}

        {view === 'media' && media.length > 1 && (
          <>
            <button type="button" onClick={previous} aria-label="Предыдущее медиа" className="btn-ghost absolute left-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 text-lg sm:flex">‹</button>
            <button type="button" onClick={next} aria-label="Следующее медиа" className="btn-ghost absolute right-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 text-lg sm:flex">›</button>
          </>
        )}
      </div>

      {view === 'media' && media.length > 1 && (
        <div className="object-gallery__rail scrollbar-none flex gap-2 overflow-x-auto bg-[var(--surface)]/96 px-3 py-2.5" aria-label="Выбор фото или видео">
          {media.map((mediaItem, index) => (
            <button
              key={mediaItem.key}
              type="button"
              onClick={() => setMediaIdx(index)}
              aria-label={`Показать ${mediaItem.type === 'video' ? 'видео' : 'фото'} ${index + 1}`}
              aria-current={index === mediaIdx ? 'true' : undefined}
              className={`object-gallery__thumb relative h-12 w-16 shrink-0 overflow-hidden rounded-lg ${index === mediaIdx ? 'object-gallery__thumb--active' : ''}`}
            >
              {mediaItem.type === 'photo' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaItem.thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : mediaItem.poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaItem.poster} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full w-full place-items-center bg-black/65 text-white" aria-hidden>▶</span>
              )}
              {mediaItem.type === 'video' && mediaItem.poster && (
                <span className="absolute inset-0 grid place-items-center bg-black/20 text-xs text-white" aria-hidden>▶</span>
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
