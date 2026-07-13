'use client'

import { useEffect, useRef, useState } from 'react'
import {
  DEFAULT_SPEECHKIT_OPTIONS,
  SPEECHKIT_SPEED_MAX,
  SPEECHKIT_SPEED_MIN,
  SPEECHKIT_SPEED_STEP,
  SPEECHKIT_VOICES,
  type SpeechkitRole,
  type SpeechkitVoice,
} from '@/lib/speechkit-options'

interface Props {
  audioUrl: string | null
  audioText: string
  onChange: (url: string | null) => void
  onUploadingChange?: (isUploading: boolean) => void
}

type Operation = 'upload' | 'speechkit' | null
const SPEECHKIT_TEXT_LIMIT = 5000

/** Ручная загрузка или генерация аудиогида через SpeechKit. */
export default function AudioUpload({ audioUrl, audioText, onChange, onUploadingChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [operation, setOperation] = useState<Operation>(null)
  const [error, setError] = useState('')
  const [playbackError, setPlaybackError] = useState('')
  const [status, setStatus] = useState('')
  const [voice, setVoice] = useState<SpeechkitVoice>(DEFAULT_SPEECHKIT_OPTIONS.voice)
  const [role, setRole] = useState<SpeechkitRole>(DEFAULT_SPEECHKIT_OPTIONS.role)
  const [speed, setSpeed] = useState(DEFAULT_SPEECHKIT_OPTIONS.speed)
  const busy = operation !== null
  const speechTextLength = audioText.trim().length
  const speechTextTooLong = speechTextLength > SPEECHKIT_TEXT_LIMIT
  const selectedVoice = SPEECHKIT_VOICES.find((option) => option.value === voice)

  useEffect(() => {
    onUploadingChange?.(busy)
  }, [busy, onUploadingChange])

  useEffect(() => () => onUploadingChange?.(false), [onUploadingChange])

  async function upload(file: File) {
    setOperation('upload')
    setError('')
    setPlaybackError('')
    setStatus('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('kind', 'audio')
      const res = await fetch('/api/admin/upload-media', { method: 'POST', body: fd })
      const body = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !body.url) throw new Error(body.error ?? 'Ошибка загрузки')
      onChange(body.url)
      setStatus('Аудиофайл загружен')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setOperation(null)
    }
  }

  async function generateSpeech() {
    const text = audioText.trim()
    if (!text || busy) return

    setOperation('speechkit')
    setError('')
    setPlaybackError('')
    setStatus('')
    try {
      const res = await fetch('/api/admin/speechkit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice, role, speed }),
      })
      const body = (await res.json().catch(() => null)) as { url?: string; error?: string } | null
      if (!res.ok || !body?.url) {
        throw new Error(body?.error ?? 'Не удалось озвучить текст')
      }
      onChange(body.url)
      setStatus('Аудио создано — проверьте результат в плеере')
    } catch (e) {
      const message = e instanceof Error ? e.message : ''
      setError(
        /NetworkError|Failed to fetch|Load failed/i.test(message)
          ? 'Соединение с сервером прервалось. Проверьте сеть и повторите генерацию.'
          : message || 'Не удалось озвучить текст'
      )
    } finally {
      setOperation(null)
    }
  }

  return (
    <div>
      {audioUrl ? (
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2">
          <audio
            src={audioUrl}
            controls
            preload="metadata"
            onLoadedMetadata={() => setPlaybackError('')}
            onError={() => setPlaybackError('Аудиофайл создан, но браузер не смог его воспроизвести')}
            className="h-9 min-w-0 flex-1"
          />
          <button type="button" disabled={busy} onClick={() => {
            onChange(null)
            setPlaybackError('')
            setStatus('')
          }} title="Убрать"
            className="shrink-0 rounded px-1.5 py-1 text-red-600 hover:bg-red-50 disabled:opacity-50">✕</button>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-wait disabled:opacity-70"
        >
          {operation === 'upload' ? 'Загрузка аудио…' : 'Добавить аудио аудиогида'}
          <span className="mt-1 text-xs text-slate-400">MP3/M4A/OGG/WAV до 30 МБ</span>
        </button>
      )}
      <fieldset
        disabled={busy}
        className="mt-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 disabled:opacity-70"
      >
        <legend className="px-1 text-sm font-medium text-slate-700">Параметры озвучивания</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-slate-600">
            Голос
            <select
              value={voice}
              onChange={(event) => {
                const nextVoice = SPEECHKIT_VOICES.find(
                  (option) => option.value === event.target.value
                )
                if (!nextVoice) return
                setVoice(nextVoice.value)
                setRole(nextVoice.roles[0].value)
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            >
              {SPEECHKIT_VOICES.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-medium text-slate-600">
            Характер речи
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as SpeechkitRole)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            >
              {selectedVoice?.roles.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-medium text-slate-600">
            <span className="flex items-center justify-between gap-3">
              Скорость
              <span className="font-semibold tabular-nums text-slate-800">
                {speed.toLocaleString('ru-RU')}×
              </span>
            </span>
            <input
              type="range"
              min={SPEECHKIT_SPEED_MIN}
              max={SPEECHKIT_SPEED_MAX}
              step={SPEECHKIT_SPEED_STEP}
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value))}
              aria-valuetext={`${speed.toLocaleString('ru-RU')} от обычной скорости`}
              className="mt-2 h-2 w-full cursor-pointer accent-slate-800"
            />
          </label>

          <div className="flex items-end" aria-label="Формат создаваемого аудио: MP3">
            <p className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
              Формат генерации <span className="font-semibold text-slate-800">MP3</span>
            </p>
          </div>
        </div>
      </fieldset>
      <button
        type="button"
        disabled={busy || speechTextLength === 0 || speechTextTooLong}
        onClick={generateSpeech}
        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {operation === 'speechkit' ? 'Озвучиваем текст…' : 'Озвучить текст'}
      </button>
      <p className={`mt-1 text-xs ${speechTextTooLong ? 'text-red-600' : 'text-slate-500'}`}>
        {speechTextTooLong
          ? `Для озвучивания сократите текст до ${SPEECHKIT_TEXT_LIMIT.toLocaleString('ru-RU')} символов (${speechTextLength.toLocaleString('ru-RU')}/${SPEECHKIT_TEXT_LIMIT.toLocaleString('ru-RU')})`
          : `SpeechKit создаст аудиозапись из текста · ${speechTextLength.toLocaleString('ru-RU')}/${SPEECHKIT_TEXT_LIMIT.toLocaleString('ru-RU')}`}
      </p>
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
      {error && <p className="mt-2 text-sm text-red-600" role="alert">{error}</p>}
      {playbackError && <p className="mt-2 text-sm text-red-600" role="alert">{playbackError}</p>}
      {status && !error && !playbackError && (
        <p className="mt-2 text-sm text-emerald-700" role="status">{status}</p>
      )}
    </div>
  )
}
