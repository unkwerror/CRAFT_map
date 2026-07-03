import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth, signOut } from '@/lib/auth'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/admin/login')

  const isAdmin = session.user.role === 'admin'

  return (
    <div className="min-h-dvh bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
          <Link href="/admin" className="font-bold">
            Админка · Карта Тюмени
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/admin" className="text-slate-600 hover:text-slate-900">
              Объекты
            </Link>
            {isAdmin && (
              <Link href="/admin/users" className="text-slate-600 hover:text-slate-900">
                Пользователи
              </Link>
            )}
            <a href="/" target="_blank" className="text-slate-600 hover:text-slate-900">
              Открыть карту ↗
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-slate-500">
              {session.user.email} · {isAdmin ? 'админ' : 'редактор'}
            </span>
            <form
              action={async () => {
                'use server'
                await signOut({ redirectTo: '/admin/login' })
              }}
            >
              <button type="submit" className="text-slate-600 underline hover:text-slate-900">
                Выйти
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}
