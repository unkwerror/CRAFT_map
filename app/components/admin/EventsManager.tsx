'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AdminEventRow, AdminObjectRow, EventStatus } from '@/lib/types'
import EventObjectPicker from './EventObjectPicker'

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500'

interface FormState {
  id: string | null // null — создание
  objectId: string
  title: string
  description: string
  startsOn: string
  endsOn: string
  startsAt: string
  endsAt: string
  timezone: string
  venue: string
  organizer: string
  priceInfo: string
  registrationUrl: string
  accessibility: string
  status: EventStatus
  published: boolean
}

const emptyForm: FormState = {
  id: null,
  objectId: '',
  title: '',
  description: '',
  startsOn: '',
  endsOn: '',
  startsAt: '',
  endsAt: '',
  timezone: 'Asia/Yekaterinburg',
  venue: '',
  organizer: '',
  priceInfo: '',
  registrationUrl: '',
  accessibility: '',
  status: 'scheduled',
  published: true,
}

/** Мероприятия у памятников: ручной ввод администратором (список + форма) */
export default function EventsManager() {
  const [events, setEvents] = useState<AdminEventRow[]>([])
  const [objects, setObjects] = useState<AdminObjectRow[]>([])
  const [form, setForm] = useState<FormState | null>(null)
  const [error, setError] = useState('')
  const [objectError, setObjectError] = useState('')
  const [objectsLoading, setObjectsLoading] = useState(true)
  const [objectsLoadError, setObjectsLoadError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    fetch('/api/admin/events')
      .then((r) => r.json())
      .then(setEvents)
      .catch(() => setEvents([]))
  }, [])

  useEffect(() => {
    load()
    setObjectsLoading(true)
    setObjectsLoadError('')
    fetch('/api/admin/objects?sort=title&dir=asc')
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status))
        return response.json() as Promise<AdminObjectRow[]>
      })
      .then((data) => setObjects(Array.isArray(data) ? data : []))
      .catch(() => {
        setObjects([])
        setObjectsLoadError('Не удалось загрузить памятники')
      })
      .finally(() => setObjectsLoading(false))
  }, [load])

  const objectOptions = useMemo(
    () => [...objects].sort((a, b) => a.title.localeCompare(b.title, 'ru')),
    [objects]
  )

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    if (!form.objectId) {
      setObjectError('Выберите памятник из списка или на карте')
      return
    }
    setBusy(true)
    setError('')
    setObjectError('')
    const payload = {
      objectId: form.objectId,
      title: form.title,
      description: form.description || null,
      startsOn: form.startsOn,
      endsOn: form.endsOn || form.startsOn,
      startsAt: form.startsAt || null,
      endsAt: form.endsAt || null,
      timezone: form.timezone,
      venue: form.venue || null,
      organizer: form.organizer || null,
      priceInfo: form.priceInfo || null,
      registrationUrl: form.registrationUrl || null,
      accessibility: form.accessibility || null,
      status: form.status,
      published: form.published,
    }
    const res = await fetch(form.id ? `/api/admin/events/${form.id}` : '/api/admin/events', {
      method: form.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setBusy(false)
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      setError(body?.error ?? 'Не удалось сохранить')
      return
    }
    setForm(null)
    load()
  }

  async function remove(id: string) {
    if (!window.confirm('Удалить мероприятие?')) return
    await fetch(`/api/admin/events/${id}`, { method: 'DELETE' })
    load()
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          Памятники с мероприятием на сегодня выделяются на карте пульсацией.
        </p>
        <button
          type="button"
          onClick={() => {
            setError('')
            setObjectError('')
            setForm({ ...emptyForm })
          }}
          className="min-h-11 shrink-0 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          + Мероприятие
        </button>
      </div>

      {form && (
        <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">{form.id ? 'Редактирование' : 'Новое мероприятие'}</h2>

          <EventObjectPicker
            objects={objectOptions}
            value={form.objectId}
            onChange={(objectId) => {
              setObjectError('')
              setForm({ ...form, objectId })
            }}
            loading={objectsLoading}
            loadError={objectsLoadError}
            error={objectError}
            disabled={busy}
          />

          <label className="block">
            <span className="mb-1 block text-sm font-medium">Название *</span>
            <input
              required
              maxLength={300}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Например: Митинг памяти к 9 Мая"
              className={inputCls}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium">Описание</span>
            <textarea
              rows={3}
              maxLength={5000}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={inputCls}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1 block text-sm font-medium">Дата начала *</span>
              <input
                required
                type="date"
                value={form.startsOn}
                onChange={(e) => setForm({ ...form, startsOn: e.target.value })}
                className={inputCls}
              />
            </label>
            <label>
              <span className="mb-1 block text-sm font-medium">Дата окончания</span>
              <input
                type="date"
                value={form.endsOn}
                min={form.startsOn}
                onChange={(e) => setForm({ ...form, endsOn: e.target.value })}
                className={inputCls}
              />
              <span className="mt-1 block text-xs text-slate-500">Пусто — один день</span>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1 block text-sm font-medium">Время начала</span>
              <input
                type="time"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                className={inputCls}
              />
            </label>
            <label>
              <span className="mb-1 block text-sm font-medium">Время окончания</span>
              <input
                type="time"
                value={form.endsAt}
                min={form.startsOn === (form.endsOn || form.startsOn) ? form.startsAt : undefined}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                className={inputCls}
              />
              <span className="mt-1 block text-xs text-slate-500">Часовой пояс: Тюмень (UTC+5)</span>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1 block text-sm font-medium">Площадка</span>
              <input
                maxLength={500}
                value={form.venue}
                onChange={(e) => setForm({ ...form, venue: e.target.value })}
                placeholder="Например: Сквер Победы"
                className={inputCls}
              />
            </label>
            <label>
              <span className="mb-1 block text-sm font-medium">Организатор</span>
              <input
                maxLength={300}
                value={form.organizer}
                onChange={(e) => setForm({ ...form, organizer: e.target.value })}
                className={inputCls}
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1 block text-sm font-medium">Стоимость</span>
              <input
                maxLength={200}
                value={form.priceInfo}
                onChange={(e) => setForm({ ...form, priceInfo: e.target.value })}
                placeholder="Бесплатно или 500 ₽"
                className={inputCls}
              />
            </label>
            <label>
              <span className="mb-1 block text-sm font-medium">Ссылка на регистрацию</span>
              <input
                type="url"
                maxLength={1000}
                value={form.registrationUrl}
                onChange={(e) => setForm({ ...form, registrationUrl: e.target.value })}
                placeholder="https://…"
                className={inputCls}
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-medium">Доступность</span>
            <textarea
              rows={2}
              maxLength={2000}
              value={form.accessibility}
              onChange={(e) => setForm({ ...form, accessibility: e.target.value })}
              placeholder="Пандус, сурдоперевод, доступная парковка…"
              className={inputCls}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1 block text-sm font-medium">Статус</span>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as EventStatus })}
                className={inputCls}
              >
                <option value="scheduled">Запланировано</option>
                <option value="postponed">Перенесено</option>
                <option value="cancelled">Отменено</option>
              </select>
            </label>
            <label className="flex min-h-11 items-center gap-2 self-end rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) => setForm({ ...form, published: e.target.checked })}
              />
              Опубликовано в афише
            </label>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {busy ? 'Сохраняем…' : 'Сохранить'}
            </button>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm hover:bg-slate-100"
            >
              Отмена
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Даты</th>
              <th className="px-4 py-3">Мероприятие</th>
              <th className="px-4 py-3">Памятник</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {events.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  Мероприятий пока нет
                </td>
              </tr>
            )}
            {events.map((e) => {
              const active = e.startsOn <= today && today <= e.endsOn
              const past = e.endsOn < today
              return (
                <tr key={e.id} className={`border-b border-slate-100 ${past ? 'opacity-50' : ''}`}>
                  <td className="whitespace-nowrap px-4 py-3">
                    {e.startsOn === e.endsOn ? e.startsOn : `${e.startsOn} — ${e.endsOn}`}
                    {e.startsAt && (
                      <span className="block text-xs text-slate-500">
                        {e.startsAt}{e.endsAt ? `–${e.endsAt}` : ''}
                      </span>
                    )}
                    {active && (
                      <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        сегодня
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{e.title}</span>
                    <span className="ml-2 inline-flex gap-1 align-middle">
                      {e.status !== 'scheduled' && (
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${e.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                          {e.status === 'cancelled' ? 'отменено' : 'перенесено'}
                        </span>
                      )}
                      {!e.published && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">черновик</span>
                      )}
                    </span>
                    {e.description && (
                      <span className="block max-w-md truncate text-xs text-slate-500">{e.description}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{e.objectTitle}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setError('')
                        setObjectError('')
                        setForm({
                          id: e.id,
                          objectId: e.objectId,
                          title: e.title,
                          description: e.description ?? '',
                          startsOn: e.startsOn,
                          endsOn: e.endsOn,
                          startsAt: e.startsAt ?? '',
                          endsAt: e.endsAt ?? '',
                          timezone: e.timezone,
                          venue: e.venue ?? '',
                          organizer: e.organizer ?? '',
                          priceInfo: e.priceInfo ?? '',
                          registrationUrl: e.registrationUrl ?? '',
                          accessibility: e.accessibility ?? '',
                          status: e.status,
                          published: e.published,
                        })
                      }}
                      className="rounded px-2 py-1 text-slate-600 hover:bg-slate-100"
                    >
                      Изменить
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(e.id)}
                      className="rounded px-2 py-1 text-red-600 hover:bg-red-50"
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
