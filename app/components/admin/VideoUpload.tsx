'use client'

import { useEffect, useRef, useState } from 'react'
import type { Video } from '@/lib/types'

interface Props {
  videos: Video[]
  onChange: (videos: Video[]) => void
  onUploadingChange?: (isUploading: boolean) => void
}

/** Загрузка видео для галереи карточки (mp4/webm, ≤100 МБ, без транскодинга) */
export default function VideoUpload({ videos, onChange, onUploadingChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(0)
  const [error, setError] = useState('')
  const uploading = busy > 0

  useEffect(() => {
    onUploadingChange?.(uploading)
  }, [onUploadingChange, uploading])

  useEffect(() => () => onUploadingChange?.(false), [onUploadingChange])

  // актуальный список на момент завершения запроса (параллельные загрузки)
  const latest = useRef(videos)
  latest.current = videos

  async function uploadFiles(files: FileList | File[]) {
    setError('')
    const pendingFiles = Array.from(files)
    setBusy((count) => count + pendingFiles.length)
    for (const file of pendingFiles) {
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

  function move(idx: number, delta: -1 | 1) {
    const next = [...videos]
    const target = idx + delta
    const current = next[idx]
    const replacement = next[target]
    if (!current || !replacement) return
    next[idx] = replacement
    next[target] = current
    onChange(next)
  }

  return (
    <div>
      <button
        type="button"
        disabled={busy > 0}
        onClick={() => inputRef.current?.click()}
        className="flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-wait disabled:opacity-70"
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
            <li key={v.src} className="grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 sm:flex sm:gap-3">
              <video src={v.src} preload="metadata" className="h-14 w-20 shrink-0 rounded-md bg-black object-cover" />
              <input
                value={v.alt ?? ''}
                onChange={(e) => setAlt(i, e.target.value)}
                placeholder="Подпись…"
                className="min-w-0 w-full flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-slate-500"
              />
              <div className="col-start-2 flex shrink-0 items-center justify-end gap-1 text-slate-500 sm:col-auto">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} title="Выше"
                  className="rounded px-1.5 py-1 hover:bg-slate-100 disabled:opacity-30">↑</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === videos.length - 1} title="Ниже"
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
