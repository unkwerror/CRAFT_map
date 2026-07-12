'use client'

import { useId, useState } from 'react'

interface Props {
  audioUrl: string | null
  audioText: string | null
}

/** Аудиогид загружается только по запросу; текстовая версия доступна и без аудиофайла. */
export default function AudioGuide({ audioUrl, audioText }: Props) {
  const [playerOpen, setPlayerOpen] = useState(false)
  const [textOpen, setTextOpen] = useState(false)
  const [audioError, setAudioError] = useState(false)
  const baseId = useId()

  if (!audioUrl && !audioText) return null

  return (
    <section className="object-audio rounded-2xl border border-[var(--hairline)] bg-white/[0.035] p-3.5" aria-labelledby={`${baseId}-title`}>
      <div className="flex items-center gap-3">
        <span className="object-audio__icon grid h-11 w-11 shrink-0 place-items-center rounded-full" aria-hidden>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
            <path d="M5 10v4m4-7v10m4-13v16m4-13v10m4-7v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={`${baseId}-title`} className="text-sm font-semibold">Аудиогид</h3>
          <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
            {audioUrl ? 'История памятника в аудиоформате' : 'Доступна текстовая версия рассказа'}
          </p>
        </div>
        {audioUrl && (
          <button
            type="button"
            onClick={() => {
              setAudioError(false)
              setPlayerOpen((open) => !open)
            }}
            aria-expanded={playerOpen}
            aria-controls={`${baseId}-player`}
            className="object-audio__play min-h-10 rounded-xl px-3 text-xs font-semibold"
          >
            {playerOpen ? 'Скрыть' : 'Слушать'}
          </button>
        )}
      </div>

      {playerOpen && audioUrl && (
        <div id={`${baseId}-player`} className="mt-3 border-t border-white/[0.07] pt-3">
          <audio
            src={audioUrl}
            controls
            preload="metadata"
            onError={() => setAudioError(true)}
            className="h-10 w-full"
          />
          {audioError && <p className="mt-2 text-xs text-red-300" role="status">Не удалось загрузить аудиофайл.</p>}
        </div>
      )}

      {audioText && (
        <div className="mt-3 border-t border-white/[0.07] pt-2.5">
          <button
            type="button"
            onClick={() => setTextOpen((open) => !open)}
            aria-expanded={textOpen}
            aria-controls={`${baseId}-transcript`}
            className="flex min-h-10 w-full items-center justify-between gap-3 text-left text-xs font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)]"
          >
            <span>{textOpen ? 'Скрыть текст аудиогида' : 'Читать текст аудиогида'}</span>
            <span className={`object-disclosure__chevron ${textOpen ? 'object-disclosure__chevron--open' : ''}`} aria-hidden>⌄</span>
          </button>
          {textOpen && (
            <p id={`${baseId}-transcript`} className="object-reveal mt-2 whitespace-pre-line text-sm leading-relaxed text-[var(--ink)]/84">
              {audioText}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
