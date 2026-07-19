'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { formatAudioTime, readAudioProgress, writeAudioProgress } from '@/lib/audio-progress'

interface Props {
  audioUrl: string | null
  audioText: string | null
}

/** Аудиогид загружается только по запросу; текстовая версия доступна и без аудиофайла. */
export default function AudioGuide({ audioUrl, audioText }: Props) {
  const [playerOpen, setPlayerOpen] = useState(false)
  const [textOpen, setTextOpen] = useState(false)
  const [audioError, setAudioError] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const audioRef = useRef<HTMLAudioElement>(null)
  const lastSavedSecond = useRef(0)
  const baseId = useId()

  useEffect(() => {
    setCurrentTime(0)
    setDuration(0)
    setPlaybackRate(1)
    lastSavedSecond.current = 0
  }, [audioUrl])

  useEffect(() => {
    const audio = audioRef.current
    if (playerOpen && audio) audio.playbackRate = playbackRate
  }, [audioUrl, playbackRate, playerOpen])

  function skip(seconds: number) {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.max(0, Math.min(audio.duration || Infinity, audio.currentTime + seconds))
    setCurrentTime(audio.currentTime)
  }

  function changeRate() {
    const rates = [0.75, 1, 1.25, 1.5]
    const next = rates[(rates.indexOf(playbackRate) + 1) % rates.length] ?? 1
    setPlaybackRate(next)
    if (audioRef.current) audioRef.current.playbackRate = next
  }

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
          <h3 id={`${baseId}-title`} className="text-[15px] font-semibold leading-snug">Аудиогид</h3>
          <p className="mt-0.5 text-[13px] leading-[1.45] text-[var(--ink-muted)]">
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
            className="object-audio__play min-h-10 rounded-xl px-3 text-[13px] font-semibold"
          >
            {playerOpen ? 'Скрыть' : 'Слушать'}
          </button>
        )}
      </div>

      {playerOpen && audioUrl && (
        <div id={`${baseId}-player`} className="mt-3 border-t border-white/[0.07] pt-3">
          <audio
            ref={audioRef}
            src={audioUrl}
            controls
            preload="metadata"
            onError={() => setAudioError(true)}
            onLoadedMetadata={(event) => {
              const audio = event.currentTarget
              audio.playbackRate = playbackRate
              setDuration(audio.duration)
              const saved = readAudioProgress(window.localStorage, audioUrl)
              if (saved !== null && saved < audio.duration - 3) {
                audio.currentTime = saved
                setCurrentTime(saved)
              }
            }}
            onTimeUpdate={(event) => {
              const value = event.currentTarget.currentTime
              setCurrentTime(value)
              if (Math.abs(value - lastSavedSecond.current) >= 5) {
                writeAudioProgress(window.localStorage, audioUrl, value)
                lastSavedSecond.current = value
              }
            }}
            onPause={(event) => writeAudioProgress(window.localStorage, audioUrl, event.currentTarget.currentTime)}
            onEnded={() => {
              writeAudioProgress(window.localStorage, audioUrl, 0)
              setCurrentTime(0)
            }}
            className="h-10 w-full"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--ink-muted)]">
            <span aria-live="off">{formatAudioTime(currentTime)} / {formatAudioTime(duration)}</span>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => skip(-15)} className="min-h-10 rounded-lg px-2.5 hover:bg-white/[0.06]" aria-label="Назад на 15 секунд">
                −15 сек
              </button>
              <button type="button" onClick={changeRate} className="min-h-10 min-w-12 rounded-lg px-2.5 hover:bg-white/[0.06]" aria-label={`Скорость воспроизведения ${playbackRate}`}>
                {playbackRate}×
              </button>
              <button type="button" onClick={() => skip(15)} className="min-h-10 rounded-lg px-2.5 hover:bg-white/[0.06]" aria-label="Вперёд на 15 секунд">
                +15 сек
              </button>
            </div>
          </div>
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
            className="flex min-h-10 w-full items-center justify-between gap-3 text-left text-[13px] font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)]"
          >
            <span>{textOpen ? 'Скрыть текст аудиогида' : 'Читать текст аудиогида'}</span>
            <span className={`object-disclosure__chevron ${textOpen ? 'object-disclosure__chevron--open' : ''}`} aria-hidden>⌄</span>
          </button>
          {textOpen && (
            <p id={`${baseId}-transcript`} className="object-reveal mt-2 whitespace-pre-line text-[15px] leading-[1.72] text-[var(--ink)]/92">
              {audioText}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
