import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-5xl">🗺️</p>
      <h1 className="text-xl font-bold">Страница не найдена</h1>
      <Link href="/" className="text-[#F0A93B] hover:underline">
        ← Вернуться к карте
      </Link>
    </main>
  )
}
