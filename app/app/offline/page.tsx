import Link from 'next/link'

export default function OfflinePage() {
  return (
    <main className="object-page mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-5 py-12 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-2xl border border-[var(--hairline)] bg-white/[0.04] text-2xl" aria-hidden>
        ↯
      </span>
      <h1 className="mt-5 text-2xl font-semibold">Сейчас нет соединения</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-[var(--ink-muted)]">
        Ранее открытые памятники, фотографии и афиша могут быть доступны из локального кэша.
      </p>
      <Link href="/" className="btn-accent mt-6 min-h-11 px-5 py-3 text-sm">
        Попробовать открыть карту
      </Link>
    </main>
  )
}
