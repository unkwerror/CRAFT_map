'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  modelUrl: string | null
  onChange: (url: string | null) => void
  onUploadingChange?: (isUploading: boolean) => void
}

/** Загрузка 3D-модели памятника (.glb). Оптимизация (meshopt + WebP-текстуры) выполняется на сервере автоматически. */
export default function ModelUpload({ modelUrl, onChange, onUploadingChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    onUploadingChange?.(busy)
  }, [busy, onUploadingChange])

  useEffect(() => () => onUploadingChange?.(false), [onUploadingChange])

  async function upload(file: File) {
    setError('')
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/upload-model', { method: 'POST', body: fd })
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
      {modelUrl ? (
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2 text-sm">
          <span className="text-2xl" aria-hidden>
            🧊
          </span>
          <span className="min-w-0 flex-1 truncate">{modelUrl.split('/').pop()}</span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded px-2 py-1 text-red-600 hover:bg-red-50"
          >
            Убрать
          </button>
        </div>
      ) : (
        <div
          onClick={() => {
            if (!busy) inputRef.current?.click()
          }}
          aria-disabled={busy}
          className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-6 text-sm transition-colors ${
            busy ? 'cursor-wait opacity-70' : 'cursor-pointer hover:bg-slate-50'
          }`}
        >
          <span className="text-slate-600">{busy ? 'Загрузка…' : 'Загрузить .glb модель'}</span>
          <span className="mt-1 text-xs text-slate-400">glTF 2.0 binary, ≤20 МБ — сжатие для веба сделаем автоматически</span>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".glb,model/gltf-binary"
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
