'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import MiniMap from './MiniMap'
import PhotoUpload from './PhotoUpload'
import ModelUpload from './ModelUpload'
import type { CategoryDto, ObjectFull, Photo } from '@/lib/types'

interface Props {
  categories: CategoryDto[]
  initial?: ObjectFull
}

export default function ObjectForm({ categories, initial }: Props) {
  const router = useRouter()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? categories[0]?.id ?? '')
  const [address, setAddress] = useState(initial?.address ?? '')
  const [lng, setLng] = useState<number | null>(initial?.lng ?? null)
  const [lat, setLat] = useState<number | null>(initial?.lat ?? null)
  const [photos, setPhotos] = useState<Photo[]>(initial?.photos ?? [])
  const [modelUrl, setModelUrl] = useState<string | null>(initial?.modelUrl ?? null)
  const [published, setPublished] = useState(initial?.published ?? true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (lng === null || lat === null) {
      setError('Поставьте точку на карте')
      return
    }
    setBusy(true)
    setError('')

    const payload = {
      title,
      description: description || null,
      categoryId,
      address: address || null,
      lng,
      lat,
      photos,
      modelUrl,
      published,
      sortWeight: 0,
    }
    const res = await fetch(
      initial ? `/api/admin/objects/${initial.id}` : '/api/admin/objects',
      {
        method: initial ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    )
    setBusy(false)
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      setError(body?.error ?? 'Не удалось сохранить')
      return
    }
    router.push('/admin')
    router.refresh()
  }

  const inputCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500'

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Название *</span>
          <input required maxLength={300} value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Категория *</span>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Адрес</span>
          <input maxLength={500} value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Описание</span>
          <textarea
            rows={7}
            maxLength={10000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputCls}
          />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="h-4 w-4"
          />
          Опубликован (виден на карте)
        </label>

        <div>
          <span className="mb-1 block text-sm font-medium">Фотографии</span>
          <PhotoUpload photos={photos} onChange={setPhotos} />
        </div>

        <div>
          <span className="mb-1 block text-sm font-medium">3D-модель (.glb)</span>
          <ModelUpload modelUrl={modelUrl} onChange={setModelUrl} />
        </div>
      </div>

      <div className="space-y-3">
        <span className="block text-sm font-medium">Координата — кликните по карте *</span>
        <MiniMap
          lng={lng}
          lat={lat}
          onChange={(newLng, newLat) => {
            setLng(newLng)
            setLat(newLat)
          }}
        />
        <div className="flex gap-3">
          <label className="flex-1">
            <span className="mb-1 block text-xs text-slate-500">Долгота</span>
            <input
              type="number"
              step="0.000001"
              value={lng ?? ''}
              onChange={(e) => setLng(e.target.value === '' ? null : Number(e.target.value))}
              className={inputCls}
            />
          </label>
          <label className="flex-1">
            <span className="mb-1 block text-xs text-slate-500">Широта</span>
            <input
              type="number"
              step="0.000001"
              value={lat ?? ''}
              onChange={(e) => setLat(e.target.value === '' ? null : Number(e.target.value))}
              className={inputCls}
            />
          </label>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {busy ? 'Сохраняем…' : initial ? 'Сохранить изменения' : 'Создать объект'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/admin')}
            className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm hover:bg-slate-100"
          >
            Отмена
          </button>
        </div>
      </div>
    </form>
  )
}
