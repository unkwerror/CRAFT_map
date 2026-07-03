'use client'

import { useRef, useState } from 'react'
import type { Photo } from '@/lib/types'

interface Props {
  photos: Photo[]
  onChange: (photos: Photo[]) => void
}

/** Drag-n-drop загрузка фото: сервер делает оригинал ≤1600px + превью 400px (webp) */
export default function PhotoUpload({ photos, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState(0)
  const [error, setError] = useState('')

  async function uploadFiles(files: FileList | File[]) {
    setError('')
    for (const file of Array.from(files)) {
      setBusy((n) => n + 1)
      try {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
        const body = (await res.json()) as Photo & { error?: string }
        if (!res.ok) throw new Error(body.error ?? 'Ошибка загрузки')
        onChange([...photosRef(), { original: body.original, thumb: body.thumb }])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка загрузки')
      } finally {
        setBusy((n) => n - 1)
      }
    }
  }

  // актуальный список на момент завершения запроса (параллельные загрузки)
  const latest = useRef(photos)
  latest.current = photos
  const photosRef = () => latest.current

  function setAlt(idx: number, alt: string) {
    onChange(photos.map((p, i) => (i === idx ? { ...p, alt: alt || undefined } : p)))
  }

  function remove(idx: number) {
    onChange(photos.filter((_, i) => i !== idx))
  }

  function move(idx: number, delta: -1 | 1) {
    const next = [...photos]
    const target = idx + delta
    const a = next[idx]
    const b = next[target]
    if (!a || !b) return
    next[idx] = b
    next[target] = a
    onChange(next)
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          uploadFiles(e.dataTransfer.files)
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-sm transition-colors ${
          dragOver ? 'border-slate-600 bg-slate-100' : 'border-slate-300 bg-white hover:bg-slate-50'
        }`}
      >
        <span className="text-slate-600">
          {busy > 0 ? `Загрузка… (${busy})` : 'Перетащите фото сюда или нажмите для выбора'}
        </span>
        <span className="mt-1 text-xs text-slate-400">JPG/PNG/WebP до 15 МБ</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) uploadFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {photos.length > 0 && (
        <ul className="mt-3 space-y-2">
          {photos.map((p, i) => (
            <li key={p.original} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.thumb} alt="" className="h-14 w-14 shrink-0 rounded-md object-cover" />
              <input
                value={p.alt ?? ''}
                onChange={(e) => setAlt(i, e.target.value)}
                placeholder="Подпись (alt)…"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-slate-500"
              />
              <div className="flex shrink-0 items-center gap-1 text-slate-500">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} title="Выше"
                  className="rounded px-1.5 py-1 hover:bg-slate-100 disabled:opacity-30">↑</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === photos.length - 1} title="Ниже"
                  className="rounded px-1.5 py-1 hover:bg-slate-100 disabled:opacity-30">↓</button>
                <button type="button" onClick={() => remove(i)} title="Убрать"
                  className="rounded px-1.5 py-1 text-red-600 hover:bg-red-50">✕</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
