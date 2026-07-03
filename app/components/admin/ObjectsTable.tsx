'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AdminObjectRow, CategoryDto } from '@/lib/types'

interface DistrictOption {
  id: number
  name: string
}

interface Props {
  role: 'admin' | 'editor'
}

export default function ObjectsTable({ role }: Props) {
  const [rows, setRows] = useState<AdminObjectRow[]>([])
  const [categories, setCategories] = useState<CategoryDto[]>([])
  const [districts, setDistricts] = useState<DistrictOption[]>([])
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [category, setCategory] = useState('')
  const [district, setDistrict] = useState('')
  const [published, setPublished] = useState('')
  const [sort, setSort] = useState<string>('updated_at')
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/categories').then((r) => r.json()).then(setCategories).catch(() => {})
    fetch('/api/districts')
      .then((r) => r.json())
      .then((fc: GeoJSON.FeatureCollection) =>
        setDistricts(fc.features.map((f) => f.properties as DistrictOption))
      )
      .catch(() => {})
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300)
    return () => clearTimeout(t)
  }, [q])

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (debouncedQ) params.set('q', debouncedQ)
    if (category) params.set('category', category)
    if (district) params.set('district', district)
    if (published) params.set('published', published)
    params.set('sort', sort)
    params.set('dir', dir)
    fetch(`/api/admin/objects?${params}`)
      .then((r) => r.json())
      .then((data: AdminObjectRow[]) => setRows(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }, [debouncedQ, category, district, published, sort, dir])

  useEffect(load, [load])

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  async function togglePublished(row: AdminObjectRow) {
    await fetch(`/api/admin/objects/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ published: !row.published }),
    })
    load()
  }

  async function remove(row: AdminObjectRow) {
    if (!window.confirm(`Удалить «${row.title}» безвозвратно?\nДля скрытия с карты используйте «Скрыть».`)) return
    const res = await fetch(`/api/admin/objects/${row.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      window.alert(body?.error ?? 'Не удалось удалить')
    }
    load()
  }

  function clickSort(key: string) {
    if (sort === key) setDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSort(key)
      setDir(key === 'title' ? 'asc' : 'desc')
    }
  }

  const inputCls =
    'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-slate-500'

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск по названию…"
          className={`${inputCls} w-56`}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
          <option value="">Все категории</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <select value={district} onChange={(e) => setDistrict(e.target.value)} className={inputCls}>
          <option value="">Все округа</option>
          {districts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select value={published} onChange={(e) => setPublished(e.target.value)} className={inputCls}>
          <option value="">Все статусы</option>
          <option value="true">Опубликованные</option>
          <option value="false">Скрытые</option>
        </select>

        <div className="ml-auto flex gap-2">
          <a
            href="/api/admin/export?format=csv"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            CSV
          </a>
          <a
            href="/api/admin/export?format=geojson"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            GeoJSON
          </a>
          <Link
            href="/admin/objects/new"
            className="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
          >
            + Добавить объект
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2.5">
                <button type="button" onClick={() => clickSort('title')} className="hover:text-slate-900">
                  Название {sort === 'title' ? (dir === 'asc' ? '↑' : '↓') : ''}
                </button>
              </th>
              <th className="px-3 py-2.5">Категория</th>
              <th className="px-3 py-2.5">Округ</th>
              <th className="px-3 py-2.5">Фото</th>
              <th className="px-3 py-2.5">
                <button type="button" onClick={() => clickSort('updated_at')} className="hover:text-slate-900">
                  Обновлён {sort === 'updated_at' ? (dir === 'asc' ? '↑' : '↓') : ''}
                </button>
              </th>
              <th className="px-3 py-2.5">Статус</th>
              <th className="px-3 py-2.5 text-right">Действия</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
                  Загрузка…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
                  Ничего не найдено
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((row) => {
                const cat = catById.get(row.categoryId)
                return (
                  <tr key={row.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="max-w-xs px-3 py-2.5">
                      <Link href={`/admin/objects/${row.id}/edit`} className="font-medium hover:underline">
                        {row.title}
                      </Link>
                      {row.address && <div className="truncate text-xs text-slate-400">{row.address}</div>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: cat?.color ?? '#999' }}
                        />
                        {cat?.title ?? row.categoryId}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">{row.districtName ?? '—'}</td>
                    <td className="px-3 py-2.5 text-slate-500">{row.photoCount || '—'}</td>
                    <td className="px-3 py-2.5 text-slate-500">
                      {new Date(row.updatedAt).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-3 py-2.5">
                      {row.published ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                          опубликован
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
                          скрыт
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      <Link
                        href={`/admin/objects/${row.id}/edit`}
                        className="text-slate-600 underline hover:text-slate-900"
                      >
                        Изменить
                      </Link>
                      <button
                        type="button"
                        onClick={() => togglePublished(row)}
                        className="ml-3 text-slate-600 underline hover:text-slate-900"
                      >
                        {row.published ? 'Скрыть' : 'Показать'}
                      </button>
                      {role === 'admin' && (
                        <button
                          type="button"
                          onClick={() => remove(row)}
                          className="ml-3 text-red-600 underline hover:text-red-800"
                        >
                          Удалить
                        </button>
                      )}
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
