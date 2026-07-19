/** Скелет раздела «Люди» вместо общего прелоадера карты. */
export default function Loading() {
  return (
    <main className="mx-auto max-w-4xl px-4 pb-16 pt-8" aria-busy="true">
      <span role="status" className="sr-only">Загружаем биографии</span>
      <div className="soft-pulse h-4 w-24 rounded bg-white/[0.07]" />
      <div className="soft-pulse mt-8 h-4 w-40 rounded bg-white/[0.07]" />
      <div className="soft-pulse mt-3 h-9 w-72 max-w-full rounded-lg bg-white/[0.09]" />
      <div className="soft-pulse mt-6 h-12 w-full rounded-xl bg-white/[0.05]" />
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="soft-pulse h-36 rounded-2xl border border-[var(--hairline)] bg-white/[0.04]" />
        ))}
      </div>
    </main>
  )
}
