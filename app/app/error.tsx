'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Public page error:', error)
  }, [error])

  return (
    <main className="object-page mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-5 py-12 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-2xl border border-red-300/20 bg-red-300/10 text-2xl text-red-200" aria-hidden>!</span>
      <h1 className="mt-5 text-2xl font-semibold">Не удалось открыть страницу</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-[var(--ink-muted)]">
        Данные не загрузились. Повторите попытку или вернитесь к карте.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="btn-accent min-h-11 px-5 text-sm">Повторить</button>
        <Link href="/" className="btn-ghost min-h-11 rounded-xl px-5 py-3 text-sm">Открыть карту</Link>
      </div>
    </main>
  )
}
