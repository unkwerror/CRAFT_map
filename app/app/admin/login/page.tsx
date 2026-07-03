'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const res = await signIn('credentials', { email, password, redirect: false })
    setBusy(false)
    if (res?.error) {
      setError('Неверный email или пароль')
    } else {
      router.push('/admin')
      router.refresh()
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl bg-[#122a42] p-6 shadow-xl"
      >
        <h1 className="mb-1 text-lg font-bold">Вход в админку</h1>
        <p className="mb-5 text-sm text-white/50">Карта памятных объектов Тюмени</p>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs text-white/60">Email</span>
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-white/15 bg-[#16324e] px-3 py-2 text-sm outline-none focus:border-white/40"
          />
        </label>
        <label className="mb-4 block">
          <span className="mb-1 block text-xs text-white/60">Пароль</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-white/15 bg-[#16324e] px-3 py-2 text-sm outline-none focus:border-white/40"
          />
        </label>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-[#F0A93B] px-4 py-2.5 text-sm font-semibold text-[#122a42] hover:brightness-110 disabled:opacity-50"
        >
          {busy ? 'Входим…' : 'Войти'}
        </button>
      </form>
    </main>
  )
}
