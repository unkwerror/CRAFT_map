import Link from 'next/link'

export default function NotFoundPage() {
  return (
    <main className="object-page mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-5 py-12 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-3 text-2xl font-semibold">Страница не найдена</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-[var(--ink-muted)]">
        Возможно, памятник или мероприятие было снято с публикации.
      </p>
      <Link href="/" className="btn-accent mt-6 min-h-11 px-5 py-3 text-sm">Вернуться к карте</Link>
    </main>
  )
}
