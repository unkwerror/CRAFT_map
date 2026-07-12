'use client'

import { useRef, useState } from 'react'
import type { Video } from '@/lib/types'

interface Props {
  videos: Video[]
  onChange: (videos: Video[]) => void
}

/** Загрузка видео для галереи карточки (mp4/webm, ≤100 МБ, без транскодинга) */
export default function VideoUpload({ videos, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(0)
  const [error, setError] = useState('')

  // актуальный список на момент завершения запроса (параллельные загрузки)
  const latest = useRef(videos)
  latest.current = videos

  async function uploadFiles(files: FileList | File[]) {
    setError('')
    for (const file of Array.from(files)) {
      setBusy((n) => n + 1)
      try {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('kind', 'video')
        const res = await fetch('/api/admin/upload-media', { method: 'POST', body: fd })
        const body = (await res.json()) as { url?: string; error?: string }
        if (!res.ok || !body.url) throw new Error(body.error ?? 'Ошибка загрузки')
        onChange([...latest.current, { src: body.url }])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка загрузки')
      } finally {
        setBusy((n) => n - 1)
      }
    }
  }

  function setAlt(idx: number, alt: string) {
    onChange(videos.map((v, i) => (i === idx ? { ...v, alt: alt || undefined } : v)))
  }

  function remove(idx: number) {
    onChange(videos.filter((_, i) => i !== idx))
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-600 transition-colors hover:bg-slate-50"
      >
        {busy > 0 ? `Загрузка видео… (${busy})` : 'Добавить видео'}
        <span className="mt-1 text-xs text-slate-400">MP4/WebM до 100 МБ</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) uploadFiles(e.target.files)
          e.target.value = ''
        }}
      />

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {videos.length > 0 && (
        <ul className="mt-3 space-y-2">
          {videos.map((v, i) => (
            <li key={v.src} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2">
              <video src={v.src} preload="metadata" className="h-14 w-20 shrink-0 rounded-md bg-black object-cover" />
              <input
                value={v.alt ?? ''}
                onChange={(e) => setAlt(i, e.target.value)}
                placeholder="Подпись…"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-slate-500"
              />
              <button type="button" onClick={() => remove(i)} title="Убрать"
                className="shrink-0 rounded px-1.5 py-1 text-red-600 hover:bg-red-50">✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
