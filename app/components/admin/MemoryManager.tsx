'use client'

import { useEffect, useState } from 'react'
import { EDITORIAL_STATUSES, canTransitionEditorialStatus, type EditorialStatus } from '@/lib/editorial-workflow'
import { translitSlug } from '@/lib/translit'
import type { AdminObjectRow } from '@/lib/types'
import ObjectFieldWithMap from './ObjectFieldWithMap'

interface Person {
  id: string
  slug: string
  name: string
  editorialStatus: string
}
interface TimelineRow {
  id: string
  objectId: string
  objectTitle: string
  title: string
  dateFrom: string | null
  editorialStatus: string
}
interface EventRow {
  id: string
  slug: string
  title: string
  dateFrom: string | null
  editorialStatus: string
}
interface MediaRow {
  id: string
  objectTitle: string
  altText: string
  hasCurrentPair: boolean
  editorialStatus: string
}
interface Relation {
  objectId: string
  objectTitle: string
  personId: string
  personName: string
  relationType: string
}
interface SourceRow {
  id: string
  title: string
}
type WorkflowEntity = 'person' | 'historical_event' | 'timeline_entry' | 'archive_media'

const STATUS_RU: Record<string, string> = {
  draft: 'черновик',
  review: 'на проверке',
  changes_requested: 'на доработке',
  approved: 'одобрено',
  published: 'опубликовано',
  archived: 'в архиве',
}
const ACTION_RU: Record<string, string> = {
  draft: 'В черновики',
  review: 'На проверку',
  changes_requested: 'Вернуть на доработку',
  approved: 'Одобрить',
  published: 'Опубликовать',
  archived: 'В архив',
}
const ENTRY_TYPE_RU: Record<string, string> = {
  creation: 'Создание',
  opening: 'Открытие',
  move: 'Перенос',
  damage: 'Утрата или повреждение',
  restoration: 'Реставрация',
  commemoration: 'Памятная дата',
  other: 'Другое',
}
const VERIFICATION_RU: Record<string, string> = {
  unverified: 'Не проверено',
  needs_review: 'На проверке у редакции',
  verified: 'Проверено',
}

function allowedTransitions(status: string): EditorialStatus[] {
  if (!(EDITORIAL_STATUSES as readonly string[]).includes(status)) return []
  return EDITORIAL_STATUSES.filter(
    (next) => next !== status && canTransitionEditorialStatus(status as EditorialStatus, next)
  )
}

export default function MemoryManager() {
  const [people, setPeople] = useState<Person[]>([])
  const [timeline, setTimeline] = useState<TimelineRow[]>([])
  const [events, setEvents] = useState<EventRow[]>([])
  const [media, setMedia] = useState<MediaRow[]>([])
  const [relations, setRelations] = useState<Relation[]>([])
  const [objects, setObjects] = useState<AdminObjectRow[]>([])
  const [sources, setSources] = useState<SourceRow[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  // Человек
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [aliases, setAliases] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [deathYear, setDeathYear] = useState('')
  const [shortBio, setShortBio] = useState('')
  const [biography, setBiography] = useState('')
  const [portraitUrl, setPortraitUrl] = useState('')
  const [verification, setVerification] = useState('unverified')

  // Хроника
  const [objectId, setObjectId] = useState('')
  const [entryType, setEntryType] = useState('other')
  const [timelineTitle, setTimelineTitle] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [approximate, setApproximate] = useState(false)

  // Связь человек—место
  const [relationObjectId, setRelationObjectId] = useState('')
  const [personId, setPersonId] = useState('')
  const [relationType, setRelationType] = useState('')

  // Историческое событие
  const [eventTitle, setEventTitle] = useState('')
  const [eventSlug, setEventSlug] = useState('')
  const [eventSlugTouched, setEventSlugTouched] = useState(false)
  const [eventDate, setEventDate] = useState('')
  const [eventApproximate, setEventApproximate] = useState(false)

  // Связь события с местом или человеком
  const [linkTarget, setLinkTarget] = useState<'object' | 'person'>('object')
  const [linkObjectId, setLinkObjectId] = useState('')
  const [linkPersonId, setLinkPersonId] = useState('')
  const [linkEventId, setLinkEventId] = useState('')
  const [linkRelationType, setLinkRelationType] = useState('')

  // Архивное фото
  const [mediaObjectId, setMediaObjectId] = useState('')
  const [mediaTimelineId, setMediaTimelineId] = useState('')
  const [mediaFileUrl, setMediaFileUrl] = useState('')
  const [mediaCurrentUrl, setMediaCurrentUrl] = useState('')
  const [mediaSourceId, setMediaSourceId] = useState('')
  const [mediaRights, setMediaRights] = useState('')
  const [mediaAlt, setMediaAlt] = useState('')
  const [mediaDate, setMediaDate] = useState('')
  const [mediaApproximate, setMediaApproximate] = useState(false)

  async function load() {
    const [memoryResponse, objectsResponse, sourcesResponse] = await Promise.all([
      fetch('/api/admin/memory').then((response) => response.json()),
      fetch('/api/admin/objects').then((response) => response.json()),
      fetch('/api/admin/sources').then((response) => response.json()),
    ])
    setPeople(Array.isArray(memoryResponse.people) ? memoryResponse.people : [])
    setTimeline(Array.isArray(memoryResponse.timeline) ? memoryResponse.timeline : [])
    setEvents(Array.isArray(memoryResponse.events) ? memoryResponse.events : [])
    setMedia(Array.isArray(memoryResponse.media) ? memoryResponse.media : [])
    setRelations(Array.isArray(memoryResponse.relations) ? memoryResponse.relations : [])
    setObjects(Array.isArray(objectsResponse) ? objectsResponse : [])
    setSources(Array.isArray(sourcesResponse) ? sourcesResponse : [])
  }

  useEffect(() => {
    void load()
  }, [])

  async function submit(body: unknown, reset: () => void, successMessage: string) {
    setError('')
    setNotice('')
    setBusy(true)
    try {
      const response = await fetch('/api/admin/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        const parsed = (await response.json().catch(() => null)) as { error?: string } | null
        setError(parsed?.error ?? 'Не удалось сохранить')
        return
      }
      reset()
      setNotice(successMessage)
      await load()
    } catch {
      setError('Нет соединения с сервером — попробуйте ещё раз')
    } finally {
      setBusy(false)
    }
  }

  async function transition(entity: WorkflowEntity, id: string, status: string) {
    setError('')
    setNotice('')
    setBusy(true)
    try {
      const response = await fetch('/api/admin/memory/workflow', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity, id, status }),
      })
      if (!response.ok) {
        const parsed = (await response.json().catch(() => null)) as { error?: string } | null
        setError(parsed?.error ?? 'Не удалось изменить статус')
        return
      }
      setNotice('Статус обновлён')
      await load()
    } catch {
      setError('Нет соединения с сервером')
    } finally {
      setBusy(false)
    }
  }

  async function upload(file: File | undefined, apply: (url: string) => void) {
    if (!file) return
    setError('')
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch('/api/admin/upload', { method: 'POST', body: formData })
    if (!response.ok) {
      const parsed = (await response.json().catch(() => null)) as { error?: string } | null
      setError(parsed?.error ?? 'Не удалось загрузить изображение')
      return
    }
    const parsed = (await response.json()) as { original: string }
    apply(parsed.original)
  }

  const mediaTimeline = timeline.filter((entry) => entry.objectId === mediaObjectId)
  const inputClass = 'w-full rounded-lg border p-2'
  const submitClass = 'rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50'

  return (
    <div className="space-y-6">
      {(error || notice) && (
        <p role="status" className={`rounded-lg p-3 text-sm ${error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {error || notice}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void submit(
              {
                kind: 'person',
                person: {
                  name,
                  slug,
                  aliases: aliases.split(',').map((alias) => alias.trim()).filter(Boolean),
                  birthYear: birthYear ? Number(birthYear) : null,
                  deathYear: deathYear ? Number(deathYear) : null,
                  shortBio: shortBio || null,
                  biography: biography || null,
                  portraitUrl: portraitUrl || null,
                  verificationStatus: verification,
                },
              },
              () => {
                setName(''); setSlug(''); setSlugTouched(false); setAliases('')
                setBirthYear(''); setDeathYear(''); setShortBio(''); setBiography('')
                setPortraitUrl(''); setVerification('unverified')
              },
              'Человек сохранён в черновики'
            )
          }}
          className="space-y-3 rounded-xl border bg-white p-4"
        >
          <h2 className="font-semibold">Новый человек</h2>
          <input
            required
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              if (!slugTouched) setSlug(translitSlug(event.target.value))
            }}
            placeholder="Имя"
            className={inputClass}
          />
          <input
            required
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            value={slug}
            onChange={(event) => {
              setSlug(event.target.value)
              setSlugTouched(true)
            }}
            placeholder="slug-latinicey"
            title="Строчные латинские буквы, цифры и дефисы; подставляется из имени автоматически"
            className={inputClass}
          />
          <input value={aliases} onChange={(event) => setAliases(event.target.value)} placeholder="Псевдонимы через запятую" className={inputClass} />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" min={1} max={3000} value={birthYear} onChange={(event) => setBirthYear(event.target.value)} placeholder="Год рождения" aria-label="Год рождения" className="rounded-lg border p-2" />
            <input type="number" min={1} max={3000} value={deathYear} onChange={(event) => setDeathYear(event.target.value)} placeholder="Год смерти" aria-label="Год смерти" className="rounded-lg border p-2" />
          </div>
          <textarea value={shortBio} onChange={(event) => setShortBio(event.target.value)} rows={2} placeholder="Краткий очерк (виден в списке)" className={inputClass} />
          <textarea value={biography} onChange={(event) => setBiography(event.target.value)} rows={4} placeholder="Полная биография" className={inputClass} />
          <label className="block text-sm">
            Портрет{portraitUrl && ' — загружен'}
            <input type="file" accept="image/*" onChange={(event) => void upload(event.target.files?.[0], setPortraitUrl)} className="mt-1 w-full text-xs" />
          </label>
          <label className="block text-sm">
            Статус проверки сведений
            <select value={verification} onChange={(event) => setVerification(event.target.value)} className={`mt-1 ${inputClass}`}>
              {Object.entries(VERIFICATION_RU).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <button disabled={busy} className={submitClass}>Создать черновик</button>
        </form>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (!objectId) {
              setError('Выберите объект для записи хронологии')
              return
            }
            void submit(
              { kind: 'timeline', entry: { objectId, entryType, title: timelineTitle, dateFrom: dateFrom || null, approximate } },
              () => { setTimelineTitle(''); setDateFrom(''); setApproximate(false); setEntryType('other') },
              'Запись хронологии сохранена в черновики'
            )
          }}
          className="space-y-3 rounded-xl border bg-white p-4"
        >
          <h2 className="font-semibold">Событие хронологии</h2>
          <ObjectFieldWithMap objects={objects} value={objectId} onChange={setObjectId} ariaLabel="Объект для записи хронологии" dialogTitle="Объект записи хронологии" />
          <label className="block text-sm">
            Тип события
            <select value={entryType} onChange={(event) => setEntryType(event.target.value)} className={`mt-1 ${inputClass}`}>
              {Object.entries(ENTRY_TYPE_RU).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <input required value={timelineTitle} onChange={(event) => setTimelineTitle(event.target.value)} placeholder="Название события" className={inputClass} />
          <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} aria-label="Дата события" className={inputClass} />
          <label className="flex gap-2 text-sm">
            <input type="checkbox" checked={approximate} onChange={(event) => setApproximate(event.target.checked)} />
            Приблизительная дата
          </label>
          <button disabled={busy} className={submitClass}>Создать черновик</button>
        </form>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (!relationObjectId) {
              setError('Выберите объект для связи с человеком')
              return
            }
            void submit(
              { kind: 'objectPerson', objectId: relationObjectId, personId, relationType },
              () => setRelationType(''),
              'Связь человека с местом добавлена'
            )
          }}
          className="space-y-3 rounded-xl border bg-white p-4"
        >
          <h2 className="font-semibold">Связать человека с местом</h2>
          <ObjectFieldWithMap objects={objects} value={relationObjectId} onChange={setRelationObjectId} ariaLabel="Объект для связи с человеком" dialogTitle="Место для связи с человеком" />
          <select required value={personId} onChange={(event) => setPersonId(event.target.value)} className={inputClass}>
            <option value="">Выберите человека</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>{person.name}</option>
            ))}
          </select>
          <input required value={relationType} onChange={(event) => setRelationType(event.target.value)} placeholder="Например: автор памятника" className={inputClass} />
          <button disabled={busy} className={submitClass}>Добавить связь</button>
        </form>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            void submit(
              { kind: 'event', event: { slug: eventSlug, title: eventTitle, dateFrom: eventDate || null, approximate: eventApproximate } },
              () => { setEventTitle(''); setEventSlug(''); setEventSlugTouched(false); setEventDate(''); setEventApproximate(false) },
              'Историческое событие сохранено в черновики'
            )
          }}
          className="space-y-3 rounded-xl border bg-white p-4"
        >
          <h2 className="font-semibold">Историческое событие</h2>
          <input
            required
            value={eventTitle}
            onChange={(event) => {
              setEventTitle(event.target.value)
              if (!eventSlugTouched) setEventSlug(translitSlug(event.target.value))
            }}
            placeholder="Название события"
            className={inputClass}
          />
          <input
            required
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            value={eventSlug}
            onChange={(event) => {
              setEventSlug(event.target.value)
              setEventSlugTouched(true)
            }}
            placeholder="slug-latinicey"
            title="Строчные латинские буквы, цифры и дефисы; подставляется из названия автоматически"
            className={inputClass}
          />
          <input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} aria-label="Дата события" className={inputClass} />
          <label className="flex gap-2 text-sm">
            <input type="checkbox" checked={eventApproximate} onChange={(event) => setEventApproximate(event.target.checked)} />
            Приблизительная дата
          </label>
          <button disabled={busy} className={submitClass}>Создать черновик</button>
        </form>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (linkTarget === 'object' && !linkObjectId) {
              setError('Выберите объект для связи с событием')
              return
            }
            void submit(
              linkTarget === 'object'
                ? { kind: 'objectEvent', objectId: linkObjectId, eventId: linkEventId, relationType: linkRelationType }
                : { kind: 'personEvent', personId: linkPersonId, eventId: linkEventId, relationType: linkRelationType },
              () => setLinkRelationType(''),
              'Связь события добавлена'
            )
          }}
          className="space-y-3 rounded-xl border bg-white p-4"
        >
          <h2 className="font-semibold">Связать событие</h2>
          <select value={linkTarget} onChange={(event) => setLinkTarget(event.target.value as 'object' | 'person')} className={inputClass} aria-label="С кем связать событие">
            <option value="object">С местом</option>
            <option value="person">С человеком</option>
          </select>
          {linkTarget === 'object' ? (
            <ObjectFieldWithMap objects={objects} value={linkObjectId} onChange={setLinkObjectId} ariaLabel="Объект для связи с событием" dialogTitle="Место для связи с событием" />
          ) : (
            <select required value={linkPersonId} onChange={(event) => setLinkPersonId(event.target.value)} className={inputClass}>
              <option value="">Выберите человека</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>{person.name}</option>
              ))}
            </select>
          )}
          <select required value={linkEventId} onChange={(event) => setLinkEventId(event.target.value)} className={inputClass}>
            <option value="">Выберите событие</option>
            {events.map((eventRow) => (
              <option key={eventRow.id} value={eventRow.id}>{eventRow.title}</option>
            ))}
          </select>
          <input required value={linkRelationType} onChange={(event) => setLinkRelationType(event.target.value)} placeholder="Например: посвящён событию" className={inputClass} />
          <button disabled={busy} className={submitClass}>Добавить связь</button>
        </form>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (!mediaObjectId) {
              setError('Выберите объект архивного фото')
              return
            }
            void submit(
              {
                kind: 'archiveMedia',
                media: {
                  objectId: mediaObjectId,
                  timelineEntryId: mediaTimelineId || null,
                  captureFrom: mediaDate || null,
                  approximate: mediaApproximate,
                  fileUrl: mediaFileUrl,
                  currentFileUrl: mediaCurrentUrl || null,
                  sourceId: mediaSourceId,
                  rightsStatus: mediaRights,
                  altText: mediaAlt,
                },
              },
              () => {
                setMediaTimelineId(''); setMediaFileUrl(''); setMediaCurrentUrl('')
                setMediaRights(''); setMediaAlt(''); setMediaDate(''); setMediaApproximate(false)
              },
              'Архивное фото сохранено в черновики'
            )
          }}
          className="space-y-3 rounded-xl border bg-white p-4"
        >
          <h2 className="font-semibold">Архивное фото «тогда/сейчас»</h2>
          <ObjectFieldWithMap
            objects={objects}
            value={mediaObjectId}
            onChange={(id) => {
              setMediaObjectId(id)
              setMediaTimelineId('')
            }}
            ariaLabel="Объект архивного фото"
            dialogTitle="Объект архивного фото"
          />
          <select value={mediaTimelineId} onChange={(event) => setMediaTimelineId(event.target.value)} className={inputClass} aria-label="Привязка к записи хронологии">
            <option value="">Без привязки к хронологии</option>
            {mediaTimeline.map((entry) => (
              <option key={entry.id} value={entry.id}>{entry.title}</option>
            ))}
          </select>
          <label className="block text-sm">
            Архивное фото{mediaFileUrl && ' — загружено'}
            <input type="file" accept="image/*" onChange={(event) => void upload(event.target.files?.[0], setMediaFileUrl)} className="mt-1 w-full text-xs" />
          </label>
          <label className="block text-sm">
            Современное фото (необязательно){mediaCurrentUrl && ' — загружено'}
            <input type="file" accept="image/*" onChange={(event) => void upload(event.target.files?.[0], setMediaCurrentUrl)} className="mt-1 w-full text-xs" />
          </label>
          <select required value={mediaSourceId} onChange={(event) => setMediaSourceId(event.target.value)} className={inputClass}>
            <option value="">Источник фотографии</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>{source.title}</option>
            ))}
          </select>
          {sources.length === 0 && (
            <p className="text-xs text-amber-700">
              Сначала добавьте источник в карточке объекта: публикация архивного фото без источника невозможна.
            </p>
          )}
          <input required value={mediaRights} onChange={(event) => setMediaRights(event.target.value)} placeholder="Права: например, из фондов музея" className={inputClass} />
          <input required value={mediaAlt} onChange={(event) => setMediaAlt(event.target.value)} placeholder="Alt-текст: что изображено" className={inputClass} />
          <input type="date" value={mediaDate} onChange={(event) => setMediaDate(event.target.value)} aria-label="Дата съёмки" className={inputClass} />
          <label className="flex gap-2 text-sm">
            <input type="checkbox" checked={mediaApproximate} onChange={(event) => setMediaApproximate(event.target.checked)} />
            Приблизительная дата съёмки
          </label>
          <button disabled={busy || !mediaFileUrl} className={submitClass}>Создать черновик</button>
        </form>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <List title="Люди" entity="person" busy={busy} onTransition={transition}
          rows={people.map((person) => ({ id: person.id, title: person.name, subtitle: `/${person.slug}`, status: person.editorialStatus }))} />
        <List title="Хронология" entity="timeline_entry" busy={busy} onTransition={transition}
          rows={timeline.map((entry) => ({ id: entry.id, title: entry.title, subtitle: `${entry.objectTitle} · ${entry.dateFrom ?? 'без даты'}`, status: entry.editorialStatus }))} />
        <List title="События" entity="historical_event" busy={busy} onTransition={transition}
          rows={events.map((eventRow) => ({ id: eventRow.id, title: eventRow.title, subtitle: `/${eventRow.slug} · ${eventRow.dateFrom ?? 'без даты'}`, status: eventRow.editorialStatus }))} />
        <List title="Архивные фото" entity="archive_media" busy={busy} onTransition={transition}
          rows={media.map((item) => ({ id: item.id, title: item.altText, subtitle: `${item.objectTitle}${item.hasCurrentPair ? ' · пара «тогда/сейчас»' : ''}`, status: item.editorialStatus }))} />
        <section className="rounded-xl border bg-white p-4">
          <h2 className="font-semibold">Связи людей и мест</h2>
          {relations.length ? (
            <ul className="mt-3 max-h-96 space-y-2 overflow-auto text-sm">
              {relations.map((relation, index) => (
                <li key={`${relation.objectId}-${relation.personId}-${index}`} className="border-b pb-2">
                  <p className="font-medium">{relation.personName}</p>
                  <p className="text-xs text-slate-500">{relation.objectTitle} · {relation.relationType}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Пока пусто</p>
          )}
        </section>
      </div>
    </div>
  )
}

interface Row {
  id: string
  title: string
  subtitle: string
  status: string
}

function List({ title, entity, rows, busy, onTransition }: {
  title: string
  entity: WorkflowEntity
  rows: Row[]
  busy: boolean
  onTransition: (entity: WorkflowEntity, id: string, status: string) => Promise<void>
}) {
  return (
    <section className="rounded-xl border bg-white p-4">
      <h2 className="font-semibold">{title}</h2>
      {rows.length ? (
        <ul className="mt-3 max-h-96 space-y-3 overflow-auto text-sm">
          {rows.map((row) => (
            <li key={row.id} className="border-b pb-2">
              <p className="font-medium">{row.title}</p>
              <p className="text-xs text-slate-500">{row.subtitle} · {STATUS_RU[row.status] ?? row.status}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {allowedTransitions(row.status).map((status) => (
                  <button
                    key={status}
                    type="button"
                    disabled={busy}
                    onClick={() => void onTransition(entity, row.id, status)}
                    className="rounded border px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {ACTION_RU[status] ?? status}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">Пока пусто</p>
      )}
    </section>
  )
}
