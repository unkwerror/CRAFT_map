'use client'

import { useCallback, useEffect, useState } from 'react'
import type { UserRow } from '@/lib/types'

export default function UsersManager({ selfId }: { selfId: string }) {
  const [users, setUsers] = useState<UserRow[]>([])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'editor'>('editor')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    fetch('/api/admin/users')
      .then((r) => r.json())
      .then((data: UserRow[]) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  useEffect(load, [load])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role }),
    })
    setBusy(false)
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      setError(body?.error ?? 'Не удалось создать пользователя')
      return
    }
    setEmail('')
    setPassword('')
    setRole('editor')
    load()
  }

  async function remove(u: UserRow) {
    if (!window.confirm(`Удалить пользователя ${u.email}?`)) return
    const res = await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      window.alert(body?.error ?? 'Не удалось удалить')
    }
    load()
  }

  const inputCls =
    'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500'

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2.5">Email</th>
              <th className="px-3 py-2.5">Роль</th>
              <th className="px-3 py-2.5 text-right">Действия</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-2.5">{u.email}</td>
                <td className="px-3 py-2.5">
                  {u.role === 'admin' ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">админ</span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">редактор</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right">
                  {u.id !== selfId && (
                    <button
                      type="button"
                      onClick={() => remove(u)}
                      className="text-red-600 underline hover:text-red-800"
                    >
                      Удалить
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={create} className="h-fit space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">Новый пользователь</h2>
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`${inputCls} w-full`}
        />
        <input
          type="password"
          required
          minLength={8}
          placeholder="Пароль (мин. 8 символов)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={`${inputCls} w-full`}
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value === 'admin' ? 'admin' : 'editor')}
          className={`${inputCls} w-full`}
        >
          <option value="editor">Редактор</option>
          <option value="admin">Администратор</option>
        </select>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          Создать
        </button>
      </form>
    </div>
  )
}
