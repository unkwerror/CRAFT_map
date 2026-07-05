'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import MiniMap from '@/components/admin/MiniMap'
import type { CategoryDto, GeocodeStatus, ImportReviewRow } from '@/lib/types'

const STATUS_LABELS: Record<GeocodeStatus, { text: string; cls: string }> = {
  failed: { text: 'не найден', cls: 'bg-red-100 text-red-700' },
  pending: { text: 'не геокодирован', cls: 'bg-orange-100 text-orange-700' },
  medium: { text: 'приблизительно', cls: 'bg-amber-100 text-amber-700' },
  high: { text: 'точно', cls: 'bg-sky-100 text-sky-700' },
  verified: { text: 'подтверждён', cls: 'bg-green-100 text-green-700' },
}

const FLAG_LABELS: Record<string, string> = {
  board_note_net_na_karte: 'На доске: «НЕТ НА КАРТЕ» — уточнить у КРАФТ',
  'possible_duplicate_of_same_monument_FD20-3031': 'Возможный дубль (паровоз ФД20-3031)',
  from_board_sticky_note: 'Со стикера доски — данные неполные',
  board_note_photo_placeholder: 'Фото временное — заменить',
}

interface Props {
  role: 'admin' | 'editor'
}

/** Режим «Проверка импорта»: список по срочности + мини-карта для правки координаты */
export default function ImportReview({ role }: Props) {
  const [rows, setRows] = useState<ImportReviewRow[]>([])
  const [categories, setCategories] = useState<CategoryDto[]>([])
  const [showVerified, setShowVerified] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ lng: number; lat: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/categories').then((r) => r.json()).then(setCategories).catch(() => {})
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/admin/import-review${showVerified ? '?all=1' : ''}`)
      .then((r) => r.json())
      .then((data: ImportReviewRow[]) => setRows(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }, [showVerified])

  useEffect(load, [load])

  const selected = rows.find((r) => r.id === selectedId) ?? null
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  function select(row: ImportReviewRow) {
    setSelectedId(row.id)
    setDraft(null)
  }

  async function patch(row: ImportReviewRow, body: Record<string, unknown>) {
    setBusy(true)
    const res = await fetch(`/api/admin/import-review/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setBusy(false)
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      window.alert(data?.error ?? 'Не удалось сохранить')
      return false
    }
    return true
  }

  async function saveCoord(row: ImportReviewRow) {
    if (!draft) return
    if (await patch(row, draft)) {
      setDraft(null)
      load()
    }
  }

  async function confirm(row: ImportReviewRow) {
    const body = draft ? { ...draft, verify: true } : { verify: true }
    if (await patch(row, body)) {
      setDraft(null)
      // перейти к следующему непроверенному
      const idx = rows.findIndex((r) => r.id === row.id)
      const next = rows.find((r, i) => i > idx && r.geocodeStatus !== 'verified')
      setSelectedId(next?.id ?? null)
      load()
    }
  }

  async function remove(row: ImportReviewRow) {
    if (!window.confirm(`Удалить «${row.title}» безвозвратно? Обычно так убирают дубль.`)) return
    setBusy(true)
    const res = await fetch(`/api/admin/objects/${row.id}`, { method: 'DELETE' })
    setBusy(false)
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      window.alert(data?.error ?? 'Не удалось удалить')
      return
    }
    if (selectedId === row.id) setSelectedId(null)
    load()
  }

  const remaining = rows.filter((r) => r.geocodeStatus !== 'verified').length
  const coord = draft ?? (selected?.lng !== null && selected?.lat !== null && selected
    ? { lng: selected.lng, lat: selected.lat }
    : null)
  const districtMismatch =
    selected?.importDistrict &&
    selected.districtName &&
    selected.importDistrict !== selected.districtName

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <span className="text-slate-500">
          {loading ? 'Загрузка…' : `Осталось проверить: ${remaining}`}
        </span>
        <label className="flex cursor-pointer items-center gap-1.5 text-slate-600">
          <input
            type="checkbox"
            checked={showVerified}
            onChange={(e) => setShowVerified(e.target.checked)}
          />
          показывать подтверждённые
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(320px,2fr)_3fr]">
        {/* список: failed → pending → medium → high */}
        <div className="max-h-[75vh] space-y-2 overflow-y-auto pr-1">
          {!loading && rows.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-400">
              Всё проверено 🎉
            </div>
          )}
          {rows.map((row) => {
            const st = STATUS_LABELS[row.geocodeStatus]
            const cat = catById.get(row.categoryId)
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => select(row)}
                className={`block w-full rounded-xl border bg-white p-3 text-left text-sm transition-colors ${
                  row.id === selectedId
                    ? 'border-slate-900 ring-1 ring-slate-900'
                    : 'border-slate-200 hover:border-slate-400'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">
                    <span className="mr-1.5 text-xs text-slate-400">#{row.sourceId}</span>
                    {row.title}
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${st.cls}`}>
                    {st.text}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: cat?.color ?? '#999' }}
                  />
                  {cat?.title ?? row.categoryId}
                  {row.address && <span className="truncate">· {row.address}</span>}
                </div>
                {row.importFlags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {row.importFlags.map((f) => (
                      <span key={f} className="rounded bg-violet-100 px-1.5 py-0.5 text-xs text-violet-700">
                        {FLAG_LABELS[f] ?? f}
                      </span>
                    ))}
                  </div>
                )}
                {row.nearby.length > 0 && (
                  <div className="mt-1.5 text-xs text-red-600">
                    ⚠ рядом:{' '}
                    {row.nearby.map((n) => `«${n.title}» (${n.dist} м)`).join(', ')}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* карточка проверки */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          {!selected && (
            <div className="flex h-full min-h-48 items-center justify-center text-slate-400">
              Выберите объект из списка
            </div>
          )}
          {selected && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="text-lg font-bold">{selected.title}</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${STATUS_LABELS[selected.geocodeStatus].cls}`}
                >
                  {STATUS_LABELS[selected.geocodeStatus].text}
                </span>
              </div>

              <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
                <dt className="text-slate-500">Адрес с доски</dt>
                <dd>{selected.address ?? '—'}</dd>
                <dt className="text-slate-500">Округ на доске</dt>
                <dd>
                  {selected.importDistrict ?? '—'}
                  {districtMismatch && (
                    <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">
                      по координате: {selected.districtName}
                    </span>
                  )}
                </dd>
                <dt className="text-slate-500">Запрос геокодера</dt>
                <dd className="text-slate-600">{selected.geocodeQuery ?? '—'}</dd>
                <dt className="text-slate-500">Что нашлось</dt>
                <dd className="text-slate-600">{selected.geocodeNote ?? '—'}</dd>
              </dl>

              {selected.photos.length > 0 && (
                <div className="flex gap-2 overflow-x-auto">
                  {selected.photos.map((p) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={p.thumb}
                      src={p.thumb}
                      alt={p.alt ?? selected.title}
                      className="h-20 w-28 shrink-0 rounded-lg border border-slate-200 object-cover"
                    />
                  ))}
                </div>
              )}

              {selected.description && (
                <p className="max-h-28 overflow-y-auto text-sm text-slate-600">
                  {selected.description}
                </p>
              )}

              <div>
                <div className="mb-1 text-sm text-slate-500">
                  Координата ставится кликом по карте, маркер можно перетащить
                  {coord && (
                    <span className="ml-2 font-mono text-xs text-slate-400">
                      {coord.lat.toFixed(6)}, {coord.lng.toFixed(6)}
                    </span>
                  )}
                </div>
                <MiniMap
                  key={selected.id}
                  lng={coord?.lng ?? null}
                  lat={coord?.lat ?? null}
                  onChange={(lng, lat) => setDraft({ lng, lat })}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={busy || !coord}
                  onClick={() => confirm(selected)}
                  className="rounded-lg bg-green-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50"
                >
                  ✓ Подтверждено — на карту
                </button>
                <button
                  type="button"
                  disabled={busy || !draft}
                  onClick={() => saveCoord(selected)}
                  className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  Сохранить точку без подтверждения
                </button>
                <span className="ml-auto flex gap-3 text-sm">
                  <Link
                    href={`/admin/objects/${selected.id}/edit`}
                    className="text-slate-600 underline hover:text-slate-900"
                  >
                    Открыть форму
                  </Link>
                  {role === 'admin' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => remove(selected)}
                      className="text-red-600 underline hover:text-red-800"
                    >
                      Удалить (дубль)
                    </button>
                  )}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
