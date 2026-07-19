/** Нейтральный лоадер страницы объекта: сюда попадают и переходы по QR-ссылкам. */
export default function Loading() {
  return (
    <main className="grid min-h-dvh place-items-center px-4" aria-busy="true">
      <p role="status" className="soft-pulse text-sm text-[var(--ink-muted)]">Загружаем страницу…</p>
    </main>
  )
}
