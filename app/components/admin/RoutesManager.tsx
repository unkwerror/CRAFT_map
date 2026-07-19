'use client'

import { useEffect, useState } from 'react'
import { EDITORIAL_STATUSES, canTransitionEditorialStatus, type EditorialStatus } from '@/lib/editorial-workflow'
import { translitSlug } from '@/lib/translit'
import type { AdminObjectRow } from '@/lib/types'
import ObjectPicker from './ObjectPicker'
import RouteStopsMap from './RouteStopsMap'

interface RouteRow {
  id: string
  slug: string
  title: string
  status: string
  stop_count: number
}

interface StopDraft {
  objectId: string
  arrivalRadiusMeters: number
  recommendedDurationMinutes: string
  introText: string
  directionsText: string
  gpsAutoplay: boolean
}

interface RouteDetail {
  id: string
  slug: string
  title: string
  summary: string | null
  description: string | null
  estimated_duration_minutes: number | null
  distance_meters: number | null
  difficulty: string | null
  stops: Array<{
    object_id: string
    arrival_radius_meters: number
    recommended_duration_minutes: number | null
    intro_text: string | null
    directions_text: string | null
    gps_autoplay: boolean
  }>
}

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

function allowedTransitions(status: string): EditorialStatus[] {
  if (!(EDITORIAL_STATUSES as readonly string[]).includes(status)) return []
  return EDITORIAL_STATUSES.filter(
    (next) => next !== status && canTransitionEditorialStatus(status as EditorialStatus, next)
  )
}

function emptyStop(objectId: string): StopDraft {
  return {
    objectId,
    arrivalRadiusMeters: 40,
    recommendedDurationMinutes: '',
    introText: '',
    directionsText: '',
    gpsAutoplay: false,
  }
}

export default function RoutesManager() {
  const [routes, setRoutes] = useState<RouteRow[]>([])
  const [objects, setObjects] = useState<AdminObjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [summary, setSummary] = useState('')
  const [minutes, setMinutes] = useState('')
  const [distance, setDistance] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [stops, setStops] = useState<StopDraft[]>([])

  async function load() {
    setLoading(true)
    try {
      const [routesResponse, objectsResponse] = await Promise.all([
        fetch('/api/admin/routes').then((response) => response.json()),
        fetch('/api/admin/objects').then((response) => response.json()),
      ])
      setRoutes(Array.isArray(routesResponse) ? routesResponse : [])
      setObjects(Array.isArray(objectsResponse) ? objectsResponse : [])
    } catch {
      setError('Не удалось загрузить список маршрутов')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function resetForm() {
    setEditingId(null)
    setTitle('')
    setSlug('')
    setSlugTouched(false)
    setSummary('')
    setMinutes('')
    setDistance('')
    setDifficulty('')
    setStops([])
  }

  async function startEdit(id: string) {
    setError('')
    setNotice('')
    try {
      const response = await fetch(`/api/admin/routes/${id}`)
      if (!response.ok) throw new Error()
      const detail = (await response.json()) as RouteDetail
      setEditingId(detail.id)
      setTitle(detail.title)
      setSlug(detail.slug)
      setSlugTouched(true)
      setSummary(detail.summary ?? '')
      setMinutes(detail.estimated_duration_minutes ? String(detail.estimated_duration_minutes) : '')
      setDistance(detail.distance_meters ? String(detail.distance_meters) : '')
      setDifficulty(detail.difficulty ?? '')
      setStops(detail.stops.map((stop) => ({
        objectId: stop.object_id,
        arrivalRadiusMeters: stop.arrival_radius_meters,
        recommendedDurationMinutes: stop.recommended_duration_minutes ? String(stop.recommended_duration_minutes) : '',
        introText: stop.intro_text ?? '',
        directionsText: stop.directions_text ?? '',
        gpsAutoplay: stop.gps_autoplay,
      })))
    } catch {
      setError('Не удалось открыть маршрут для редактирования')
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    try {
      const payload = {
        title,
        slug,
        summary: summary || null,
        estimatedDurationMinutes: minutes ? Number(minutes) : null,
        distanceMeters: distance ? Number(distance) : null,
        difficulty: difficulty || null,
        stops: stops.map((stop) => ({
          objectId: stop.objectId,
          arrivalRadiusMeters: stop.arrivalRadiusMeters,
          recommendedDurationMinutes: stop.recommendedDurationMinutes ? Number(stop.recommendedDurationMinutes) : null,
          introText: stop.introText || null,
          directionsText: stop.directionsText || null,
          gpsAutoplay: stop.gpsAutoplay,
        })),
      }
      const response = await fetch(editingId ? `/api/admin/routes/${editingId}` : '/api/admin/routes', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        setError(body?.error ?? 'Не удалось сохранить')
        return
      }
      setNotice(editingId
        ? 'Маршрут сохранён. Новая версия офлайн-пакета будет собрана автоматически.'
        : 'Черновик маршрута создан')
      resetForm()
      await load()
    } catch {
      setError('Нет соединения с сервером — попробуйте ещё раз')
    } finally {
      setBusy(false)
    }
  }

  async function transition(id: string, status: string) {
    setError('')
    setNotice('')
    setBusy(true)
    try {
      const response = await fetch(`/api/admin/routes/${id}/workflow`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        setError(body?.error ?? 'Не удалось изменить статус')
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

  async function removeRoute(id: string, routeTitle: string) {
    if (!window.confirm(`Удалить маршрут «${routeTitle}»? Действие необратимо.`)) return
    setError('')
    setNotice('')
    setBusy(true)
    try {
      const response = await fetch(`/api/admin/routes/${id}`, { method: 'DELETE' })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        setError(body?.error ?? 'Не удалось удалить')
        return
      }
      setNotice('Маршрут удалён')
      if (editingId === id) resetForm()
      await load()
    } catch {
      setError('Нет соединения с сервером')
    } finally {
      setBusy(false)
    }
  }

  function moveStop(index: number, delta: number) {
    setStops((list) => {
      const target = index + delta
      if (target < 0 || target >= list.length) return list
      const next = [...list]
      const [item] = next.splice(index, 1)
      next.splice(target, 0, item!)
      return next
    })
  }

  function patchStop(index: number, patch: Partial<StopDraft>) {
    setStops((list) => list.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  function toggleStop(objectId: string) {
    setStops((list) => list.some((stop) => stop.objectId === objectId)
      ? list.filter((stop) => stop.objectId !== objectId)
      : [...list, emptyStop(objectId)])
  }

  return (
    <div className="space-y-5">
      {(error || notice) && (
        <p role="status" className={`rounded-lg p-3 text-sm ${error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {error || notice}
        </p>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="font-semibold">
            {editingId ? 'Точки маршрута на карте — редактирование' : 'Соберите маршрут на карте'}
          </h2>
          <p className="text-xs text-slate-500">
            Клик по памятнику добавляет точку, повторный клик по выбранной — убирает. Линия строится автоматически.
          </p>
        </div>
        <div className="mt-3">
          <RouteStopsMap
            objects={objects}
            stopIds={stops.map((stop) => stop.objectId)}
            onToggle={toggleStop}
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
      <div className="space-y-3">
        <div className="rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-3 text-left">Маршрут</th>
                <th>Точки</th>
                <th className="p-3 text-left">Статус и действия</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((route) => (
                <tr key={route.id} className="border-b align-top last:border-0">
                  <td className="p-3 font-medium">
                    {route.title}
                    <div className="text-xs text-slate-400">/routes/{route.slug}</div>
                  </td>
                  <td className="p-3 text-center">{route.stop_count}</td>
                  <td className="p-3">
                    <span className="text-xs text-slate-500">{STATUS_RU[route.status] ?? route.status}</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {allowedTransitions(route.status).map((status) => (
                        <button
                          key={status}
                          type="button"
                          disabled={busy}
                          onClick={() => void transition(route.id, status)}
                          className="rounded border px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          {ACTION_RU[status] ?? status}
                        </button>
                      ))}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void startEdit(route.id)}
                        className="rounded border px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Изменить
                      </button>
                      {route.status !== 'published' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void removeRoute(route.id, route.title)}
                          className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          Удалить
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading
            ? <p className="p-5 text-slate-500">Загружаем…</p>
            : routes.length === 0 && <p className="p-5 text-slate-500">Маршрутов пока нет</p>}
        </div>
      </div>

      <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">{editingId ? 'Редактирование маршрута' : 'Новый черновик'}</h2>
        <input
          required
          placeholder="Название"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value)
            // slug подставляется транслитом, пока редактор не начал править его вручную
            if (!slugTouched && !editingId) setSlug(translitSlug(event.target.value))
          }}
          className="w-full rounded-lg border p-2"
        />
        <input
          required
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          title="Строчные латинские буквы, цифры и дефисы: naprimer-tak"
          placeholder="slug-latinicey"
          value={slug}
          onChange={(event) => {
            setSlug(event.target.value)
            setSlugTouched(true)
          }}
          className="w-full rounded-lg border p-2"
        />
        <textarea
          placeholder="Краткое описание для каталога"
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          rows={2}
          className="w-full rounded-lg border p-2"
        />
        <div className="grid grid-cols-3 gap-2">
          <input type="number" min={1} max={1440} placeholder="Минуты" value={minutes} onChange={(event) => setMinutes(event.target.value)} className="rounded-lg border p-2" aria-label="Длительность в минутах" />
          <input type="number" min={0} step={100} placeholder="Метры" value={distance} onChange={(event) => setDistance(event.target.value)} className="rounded-lg border p-2" aria-label="Длина в метрах" />
          <input placeholder="Сложность" value={difficulty} onChange={(event) => setDifficulty(event.target.value)} className="rounded-lg border p-2" />
        </div>
        <label className="block text-sm">
          Добавить остановку
          <div className="mt-1">
            <ObjectPicker
              objects={objects}
              value=""
              onChange={(id) => {
                if (!id) return
                setStops((list) => list.some((stop) => stop.objectId === id) ? list : [...list, emptyStop(id)])
              }}
              ariaLabel="Поиск объекта для остановки"
              placeholder="Начните вводить название объекта…"
            />
          </div>
        </label>
        <ol className="space-y-2 text-sm">
          {stops.map((stop, index) => (
            <li key={stop.objectId} className="rounded-lg border border-slate-200 p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  {index + 1}. {objects.find((option) => option.id === stop.objectId)?.title ?? 'Объект'}
                </span>
                <span className="flex gap-1">
                  <button type="button" aria-label="Выше" disabled={index === 0} onClick={() => moveStop(index, -1)} className="rounded border px-2 disabled:opacity-30">↑</button>
                  <button type="button" aria-label="Ниже" disabled={index === stops.length - 1} onClick={() => moveStop(index, 1)} className="rounded border px-2 disabled:opacity-30">↓</button>
                  <button type="button" aria-label="Убрать остановку" onClick={() => setStops((list) => list.filter((item) => item.objectId !== stop.objectId))} className="rounded border px-2">×</button>
                </span>
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-slate-500">Параметры остановки</summary>
                <div className="mt-2 space-y-2">
                  <label className="block text-xs">
                    Радиус прихода, м
                    <input type="number" min={10} max={500} value={stop.arrivalRadiusMeters} onChange={(event) => patchStop(index, { arrivalRadiusMeters: Number(event.target.value) || 40 })} className="mt-1 w-full rounded-lg border p-1.5" />
                  </label>
                  <label className="block text-xs">
                    Минут на точке
                    <input type="number" min={1} max={240} value={stop.recommendedDurationMinutes} onChange={(event) => patchStop(index, { recommendedDurationMinutes: event.target.value })} className="mt-1 w-full rounded-lg border p-1.5" />
                  </label>
                  <label className="block text-xs">
                    Вступление на точке
                    <textarea rows={2} value={stop.introText} onChange={(event) => patchStop(index, { introText: event.target.value })} className="mt-1 w-full rounded-lg border p-1.5" />
                  </label>
                  <label className="block text-xs">
                    Как пройти дальше
                    <textarea rows={2} value={stop.directionsText} onChange={(event) => patchStop(index, { directionsText: event.target.value })} className="mt-1 w-full rounded-lg border p-1.5" />
                  </label>
                </div>
              </details>
            </li>
          ))}
        </ol>
        <div className="flex gap-2">
          <button disabled={busy} className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50">
            {busy ? 'Сохраняем…' : editingId ? 'Сохранить' : 'Создать черновик'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="rounded-lg border px-4 py-2">Отменить правку</button>
          )}
        </div>
        <p className="text-xs text-slate-500">
          Публикация — кнопками статуса в таблице. Для публикации нужны минимум две остановки.
        </p>
      </form>
      </div>
    </div>
  )
}
