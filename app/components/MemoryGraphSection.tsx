'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useId, useState } from 'react'

type Relation = {
  slug: string
  name?: string
  title?: string
  relationType: string
  dateFrom?: string | null
  approximate?: boolean
}

type TimelineEntry = {
  id: string
  entryType: string
  dateFrom: string | null
  dateTo: string | null
  approximate: boolean
  title: string
  description: string | null
  media: Array<{ id: string; fileUrl: string; currentFileUrl: string | null; altText: string; rightsStatus: string }>
}

const dateLabel = (entry: TimelineEntry) => {
  if (!entry.dateFrom) return 'Дата не указана'
  const from = new Date(`${entry.dateFrom}T00:00:00`).toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' })
  const to = entry.dateTo && entry.dateTo !== entry.dateFrom
    ? new Date(`${entry.dateTo}T00:00:00`).toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' })
    : null
  return `${entry.approximate ? 'Около ' : ''}${from}${to ? ` — ${to}` : ''}`
}

export default function MemoryGraphSection({ objectId }: { objectId: string }) {
  const [relations, setRelations] = useState<{ people: Relation[]; events: Relation[] } | null>(null)
  const [timeline, setTimeline] = useState<TimelineEntry[] | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      fetch(`/api/v1/places/${objectId}/relations`, { signal: controller.signal }).then((r) => r.ok ? r.json() : { people: [], events: [] }),
      fetch(`/api/v1/places/${objectId}/timeline`, { signal: controller.signal }).then((r) => r.ok ? r.json() : []),
    ]).then(([nextRelations, nextTimeline]) => {
      setRelations(nextRelations)
      setTimeline(nextTimeline)
    }).catch(() => undefined)
    return () => controller.abort()
  }, [objectId])

  if (!relations || !timeline || (!relations.people.length && !relations.events.length && !timeline.length)) return null
  return <section className="fade-in-rise space-y-4 rounded-2xl border border-[var(--hairline)] bg-white/[0.025] p-4" aria-labelledby={`memory-${objectId}`}>
    <h3 id={`memory-${objectId}`} className="text-[15px] font-semibold">Городская память</h3>
    {(relations.people.length > 0 || relations.events.length > 0) && <div>
      <h4 className="text-sm font-semibold">Люди и события</h4>
      <ul className="mt-2 space-y-2 text-sm">
        {relations.people.map((person) => <li key={`person-${person.slug}`}><Link className="text-[var(--accent)] hover:underline" href={`/people/${person.slug}`}>{person.name}</Link><span className="text-[var(--ink-muted)]"> · {person.relationType}</span></li>)}
        {relations.events.map((event) => <li key={`event-${event.slug}`}><span className="font-medium">{event.title}</span><span className="text-[var(--ink-muted)]"> · {event.relationType}</span></li>)}
      </ul>
    </div>}
    {timeline.length > 0 && <div>
      <h4 className="text-sm font-semibold">Хронология</h4>
      <ol className="mt-3 space-y-4 border-l border-[var(--hairline-strong)] pl-4">
        {timeline.map((entry) => <li key={entry.id}>
          <p className="text-xs text-[var(--ink-subtle)]">{dateLabel(entry)}</p>
          <p className="mt-1 text-sm font-semibold">{entry.title}</p>
          {entry.description && <p className="mt-1 whitespace-pre-line text-sm text-[var(--ink-muted)]">{entry.description}</p>}
          {entry.media.map((media) => <ThenNowFigure key={media.id} media={media} />)}
        </li>)}
      </ol>
    </div>}
  </section>
}

type MediaItem = TimelineEntry['media'][number]

function ThenNowFigure({ media }: { media: MediaItem }) {
  const [position, setPosition] = useState(50)
  const [separate, setSeparate] = useState(false)
  const sliderId = useId()
  const caption = <figcaption className="mt-1 text-xs text-[var(--ink-subtle)]">{media.altText} · права: {media.rightsStatus}</figcaption>
  if (!media.currentFileUrl) return <figure className="mt-3">
    <a href={media.fileUrl} target="_blank" rel="noreferrer" className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"><Image unoptimized width={900} height={600} src={media.fileUrl} alt={`Тогда: ${media.altText}`} className="max-h-64 w-full rounded-xl object-cover" /></a>
    {caption}
  </figure>
  return <figure className="mt-3">
    {separate
      ? <div>
          <div className="grid gap-2 sm:grid-cols-2">
            <a href={media.fileUrl} target="_blank" rel="noreferrer" className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"><Image unoptimized width={900} height={600} src={media.fileUrl} alt={`Тогда: ${media.altText}`} className="max-h-64 w-full rounded-xl object-cover" /></a>
            <a href={media.currentFileUrl} target="_blank" rel="noreferrer" className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"><Image unoptimized width={900} height={600} src={media.currentFileUrl} alt={`Сейчас: ${media.altText}`} className="max-h-64 w-full rounded-xl object-cover" /></a>
          </div>
          <p className="mt-1 text-xs text-[var(--ink-subtle)]">Слева — архивный вид, справа — современный. Каждое изображение открывается отдельно.</p>
        </div>
      : <div>
          <div className="relative aspect-[3/2] overflow-hidden rounded-xl">
            <Image unoptimized width={900} height={600} src={media.currentFileUrl} alt={`Сейчас: ${media.altText}`} className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
              <Image unoptimized width={900} height={600} src={media.fileUrl} alt={`Тогда: ${media.altText}`} className="h-full w-full object-cover" />
            </div>
            <div aria-hidden className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white/80" style={{ left: `${position}%` }} />
          </div>
          <label htmlFor={sliderId} className="sr-only">Сравнение архивного и современного вида: влево — современный, вправо — архивный</label>
          <input id={sliderId} type="range" min={0} max={100} value={position} onChange={(event) => setPosition(Number(event.target.value))} aria-valuetext={`Архивный вид открыт на ${position}%`} className="mt-2 w-full accent-[var(--accent)]" />
        </div>}
    <button type="button" onClick={() => setSeparate((v) => !v)} className="mt-2 text-xs text-[var(--accent)] hover:underline">{separate ? 'Показать сравнение ползунком' : 'Показать фото отдельно'}</button>
    {caption}
  </figure>
}
