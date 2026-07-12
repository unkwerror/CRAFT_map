'use client'

import { useRef, useState } from 'react'

interface Props {
  audioUrl: string | null
  onChange: (url: string | null) => void
}

/** Загрузка аудио аудиогида (mp3/m4a/ogg/wav, ≤30 МБ) */
export default function AudioUpload({ audioUrl, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function upload(file: File) {
    setBusy(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('kind', 'audio')
      const res = await fetch('/api/admin/upload-media', { method: 'POST', body: fd })
      const body = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !body.url) throw new Error(body.error ?? 'Ошибка загрузки')
      onChange(body.url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {audioUrl ? (
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2">
          <audio src={audioUrl} controls preload="metadata" className="h-9 min-w-0 flex-1" />
          <button type="button" onClick={() => onChange(null)} title="Убрать"
            className="shrink-0 rounded px-1.5 py-1 text-red-600 hover:bg-red-50">✕</button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-600 transition-colors hover:bg-slate-50"
        >
          {busy ? 'Загрузка аудио…' : 'Добавить аудио аудиогида'}
          <span className="mt-1 text-xs text-slate-400">MP3/M4A/OGG/WAV до 30 МБ</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".mp3,.m4a,.ogg,.wav,audio/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) upload(f)
          e.target.value = ''
        }}
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
