/** Скелет каталога маршрутов вместо общего прелоадера карты. */
export default function Loading() {
  return (
    <main className="mx-auto max-w-4xl px-4 pb-16 pt-8" aria-busy="true">
      <span role="status" className="sr-only">Загружаем маршруты</span>
      <div className="soft-pulse h-4 w-24 rounded bg-white/[0.07]" />
      <div className="soft-pulse mt-8 h-4 w-36 rounded bg-white/[0.07]" />
      <div className="soft-pulse mt-3 h-9 w-52 rounded-lg bg-white/[0.09]" />
      <div className="soft-pulse mt-4 h-4 w-full max-w-xl rounded bg-white/[0.07]" />
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {[0, 1].map((index) => (
          <div key={index} className="soft-pulse h-64 rounded-2xl border border-[var(--hairline)] bg-white/[0.04]" />
        ))}
      </div>
    </main>
  )
}
