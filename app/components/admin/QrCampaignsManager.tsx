'use client'

import { useEffect, useRef, useState } from 'react'
import ObjectPicker, { type ObjectOption } from './ObjectPicker'

interface Campaign {
  id: string
  name: string
  code: string
  target_type: string
  target_id: string
  placement_name: string | null
  print_batch: string | null
  enabled: boolean
  scans: number
}

type TargetType = 'object' | 'event' | 'route' | 'person'

const TARGET_RU: Record<TargetType, string> = {
  object: 'Объект',
  event: 'Мероприятие',
  route: 'Маршрут',
  person: 'Человек',
}

interface CreatedCampaign {
  id: string
  code: string
  name: string
}

export default function QrCampaignsManager() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [options, setOptions] = useState<Record<TargetType, ObjectOption[]>>({
    object: [], event: [], route: [], person: [],
  })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogError, setDialogError] = useState('')
  const [created, setCreated] = useState<CreatedCampaign | null>(null)
  const [name, setName] = useState('')
  const [targetType, setTargetType] = useState<TargetType>('object')
  const [targetId, setTargetId] = useState('')
  const [placement, setPlacement] = useState('')
  const [batch, setBatch] = useState('')
  const openButtonRef = useRef<HTMLButtonElement>(null)
  const dialogCloseRef = useRef<HTMLButtonElement>(null)

  async function load() {
    setLoading(true)
    try {
      const [campaignRows, objects, events, routes, memory] = await Promise.all([
        fetch('/api/admin/qr-campaigns').then((response) => response.json()),
        fetch('/api/admin/objects').then((response) => response.json()),
        fetch('/api/admin/events').then((response) => response.json()),
        fetch('/api/admin/routes').then((response) => response.json()),
        fetch('/api/admin/memory').then((response) => response.json()),
      ])
      setCampaigns(Array.isArray(campaignRows) ? campaignRows : [])
      setOptions({
        object: Array.isArray(objects)
          ? objects.map((row: { id: string; title: string }) => ({ id: row.id, title: row.title }))
          : [],
        event: Array.isArray(events)
          ? events.map((row: { id: string; title: string }) => ({ id: row.id, title: row.title }))
          : [],
        route: Array.isArray(routes)
          ? routes.map((row: { id: string; title: string }) => ({ id: row.id, title: row.title }))
          : [],
        person: Array.isArray(memory?.people)
          ? (memory.people as { id: string; name: string }[]).map((person) => ({ id: person.id, title: person.name }))
          : [],
      })
    } catch {
      setError('Не удалось загрузить кампании')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if (!dialogOpen) return
    dialogCloseRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeDialog()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [dialogOpen])

  function openDialog() {
    setDialogError('')
    setCreated(null)
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    openButtonRef.current?.focus()
  }

  function resetForm() {
    setName('')
    setTargetId('')
    setPlacement('')
    setBatch('')
    setCreated(null)
    setDialogError('')
  }

  async function create(event: React.FormEvent) {
    event.preventDefault()
    setDialogError('')
    if (!targetId) {
      setDialogError('Выберите, куда ведёт QR-код')
      return
    }
    setBusy(true)
    try {
      const response = await fetch('/api/admin/qr-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          targetType,
          targetId,
          placementName: placement || null,
          printBatch: batch || null,
        }),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        setDialogError(body?.error ?? 'Не удалось создать кампанию')
        return
      }
      const result = (await response.json()) as { id: string; code: string }
      setCreated({ id: result.id, code: result.code, name })
      await load()
    } catch {
      setDialogError('Нет соединения с сервером')
    } finally {
      setBusy(false)
    }
  }

  async function toggle(campaign: Campaign) {
    setError('')
    setNotice('')
    setBusy(true)
    try {
      const response = await fetch(`/api/admin/qr-campaigns/${campaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !campaign.enabled }),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        setError(body?.error ?? 'Не удалось изменить кампанию')
        return
      }
      setNotice(campaign.enabled
        ? 'Кампания выключена: QR-переходы остановлены'
        : 'Кампания включена')
      await load()
    } catch {
      setError('Нет соединения с сервером')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {(error || notice) && (
        <p role="status" className={`rounded-lg p-3 text-sm ${error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {error || notice}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          QR ведёт на стабильную короткую ссылку /r/… — код остаётся рабочим при изменении карточек.
        </p>
        <button
          ref={openButtonRef}
          type="button"
          onClick={openDialog}
          className="rounded-lg bg-slate-900 px-4 py-2 text-white"
        >
          Создать QR-код
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-3 text-left">Кампания</th>
              <th className="p-3 text-left">Цель</th>
              <th>Сканы</th>
              <th className="p-3 text-left">Действия</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((campaign) => (
              <tr key={campaign.id} className="border-b align-top last:border-0">
                <td className="p-3 font-medium">
                  {campaign.name}
                  <div className="text-xs text-slate-400">
                    /r/{campaign.code}
                    {campaign.placement_name ? ` · ${campaign.placement_name}` : ''}
                    {campaign.print_batch ? ` · партия ${campaign.print_batch}` : ''}
                  </div>
                  {!campaign.enabled && (
                    <span className="mt-1 inline-block rounded bg-slate-200 px-1.5 text-xs">выключена</span>
                  )}
                </td>
                <td className="p-3 text-xs text-slate-600">
                  {TARGET_RU[campaign.target_type as TargetType] ?? campaign.target_type}
                </td>
                <td className="p-3 text-center">{campaign.scans}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    <a href={`/api/admin/qr-campaigns/${campaign.id}/qr?format=svg`} download className="rounded border px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-50">SVG</a>
                    <a href={`/api/admin/qr-campaigns/${campaign.id}/qr?format=png`} download className="rounded border px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-50">PNG</a>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void toggle(campaign)}
                      className="rounded border px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {campaign.enabled ? 'Выключить' : 'Включить'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading
          ? <p className="p-5 text-slate-500">Загружаем…</p>
          : campaigns.length === 0 && (
            <p className="p-5 text-slate-500">
              Кампаний пока нет. Нажмите «Создать QR-код» — получите короткую ссылку и файл для печати.
            </p>
          )}
      </div>

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50" onClick={closeDialog} aria-hidden />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={created ? 'QR-код создан' : 'Новый QR-код'}
            className="relative w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-slate-900">{created ? 'QR-код создан' : 'Новый QR-код'}</h2>
              <button
                ref={dialogCloseRef}
                type="button"
                onClick={closeDialog}
                aria-label="Закрыть окно"
                className="rounded-lg border px-2.5 py-1 text-sm text-slate-600 hover:bg-slate-50"
              >
                ✕
              </button>
            </div>

            {!created && (
              <form onSubmit={create} className="space-y-3">
                {dialogError && (
                  <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{dialogError}</p>
                )}
                <input
                  required
                  autoFocus
                  placeholder="Название (например: табличка у мемориала)"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-lg border p-2"
                />
                <label className="block text-sm">
                  Куда ведёт QR
                  <select
                    value={targetType}
                    onChange={(event) => {
                      setTargetType(event.target.value as TargetType)
                      setTargetId('')
                    }}
                    className="mt-1 w-full rounded-lg border p-2"
                  >
                    {(Object.keys(TARGET_RU) as TargetType[]).map((type) => (
                      <option key={type} value={type}>{TARGET_RU[type]}</option>
                    ))}
                  </select>
                </label>
                <ObjectPicker
                  objects={options[targetType]}
                  value={targetId}
                  onChange={setTargetId}
                  ariaLabel={`Цель QR-кода: ${TARGET_RU[targetType].toLowerCase()}`}
                  placeholder={`Найти: ${TARGET_RU[targetType].toLowerCase()}…`}
                />
                {options[targetType].length === 0 && (
                  <p className="text-xs text-amber-700">
                    В разделе «{TARGET_RU[targetType]}» пока нет записей — сначала создайте их.
                  </p>
                )}
                <input
                  placeholder="Место установки (необязательно)"
                  value={placement}
                  onChange={(event) => setPlacement(event.target.value)}
                  className="w-full rounded-lg border p-2"
                />
                <input
                  placeholder="Печатная партия (необязательно)"
                  value={batch}
                  onChange={(event) => setBatch(event.target.value)}
                  className="w-full rounded-lg border p-2"
                />
                <button disabled={busy} className="w-full rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50">
                  {busy ? 'Создаём…' : 'Создать QR-код'}
                </button>
              </form>
            )}

            {created && (
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 p-3 text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/admin/qr-campaigns/${created.id}/qr?format=svg`}
                    alt={`QR-код кампании «${created.name}»`}
                    className="mx-auto h-44 w-44"
                  />
                  <p className="mt-2 text-sm font-medium text-slate-700">/r/{created.code}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`/api/admin/qr-campaigns/${created.id}/qr?format=svg`}
                    download
                    className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-center text-sm text-white"
                  >
                    Скачать SVG
                  </a>
                  <a
                    href={`/api/admin/qr-campaigns/${created.id}/qr?format=png`}
                    download
                    className="flex-1 rounded-lg border px-4 py-2 text-center text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Скачать PNG
                  </a>
                </div>
                <p className="text-xs text-slate-500">
                  SVG — для типографии, PNG — для быстрой печати. Сканы будут считаться на этой странице.
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={resetForm} className="flex-1 rounded-lg border px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                    Создать ещё
                  </button>
                  <button type="button" onClick={closeDialog} className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white">
                    Готово
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
