'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { ContentReportRow, ReportStatus } from '@/lib/types'

const statusLabels: Record<ReportStatus, string> = {
  new: 'Новое',
  resolved: 'Решено',
  rejected: 'Отклонено',
}

const statusClasses: Record<ReportStatus, string> = {
  new: 'bg-amber-100 text-amber-800',
  resolved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-slate-200 text-slate-700',
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function ReportsManager() {
  const [filter, setFilter] = useState<ReportStatus | 'all'>('new')
  const [reports, setReports] = useState<ContentReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    const query = filter === 'all' ? '' : `?status=${filter}`
    fetch(`/api/admin/reports${query}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => null)
        if (!response.ok) throw new Error(body?.error ?? 'Не удалось загрузить сообщения')
        return body as ContentReportRow[]
      })
      .then(setReports)
      .catch((loadError: unknown) => {
        if (!(loadError instanceof DOMException && loadError.name === 'AbortError')) {
          setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить сообщения')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [filter, reloadKey])

  async function updateStatus(id: string, status: ReportStatus) {
    setBusyId(id)
    setError('')
    try {
      const response = await fetch(`/api/admin/reports/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error ?? 'Не удалось изменить статус')
      setReloadKey((value) => value + 1)
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Не удалось изменить статус')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section aria-labelledby="reports-title">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="reports-title" className="text-2xl font-bold">Сообщения об ошибках</h1>
          <p className="mt-1 text-sm text-slate-600">
            Замечания посетителей к карточкам памятников.
          </p>
        </div>
        <label className="text-sm font-medium text-slate-700">
          Статус
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as ReportStatus | 'all')}
            className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2"
          >
            <option value="new">Новые</option>
            <option value="resolved">Решённые</option>
            <option value="rejected">Отклонённые</option>
            <option value="all">Все</option>
          </select>
        </label>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p role="status" className="rounded-xl bg-white p-5 text-sm text-slate-500">
          Загружаем сообщения…
        </p>
      ) : reports.length === 0 ? (
        <p className="rounded-xl bg-white p-5 text-sm text-slate-500">
          Сообщений с выбранным статусом нет.
        </p>
      ) : (
        <ul className="space-y-3">
          {reports.map((report) => (
            <li key={report.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  {report.objectId ? (
                    <Link
                      href={`/admin/objects/${report.objectId}/edit`}
                      className="font-semibold text-slate-900 hover:underline"
                    >
                      {report.objectTitle}
                    </Link>
                  ) : (
                    <p className="font-semibold text-slate-900">
                      {report.objectTitle} <span className="font-normal text-slate-500">(объект удалён)</span>
                    </p>
                  )}
                  <p className="mt-1 text-xs text-slate-500">{formatDate(report.createdAt)}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses[report.status]}`}>
                  {statusLabels[report.status]}
                </span>
              </div>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-800">
                {report.message}
              </p>
              {report.contact && (
                <p className="mt-2 break-all text-sm text-slate-600">
                  <span className="font-medium">Контакт:</span> {report.contact}
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {report.status === 'new' ? (
                  <>
                    <button
                      type="button"
                      disabled={busyId === report.id}
                      onClick={() => void updateStatus(report.id, 'resolved')}
                      className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      Отметить решённым
                    </button>
                    <button
                      type="button"
                      disabled={busyId === report.id}
                      onClick={() => void updateStatus(report.id, 'rejected')}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
                    >
                      Отклонить
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={busyId === report.id}
                    onClick={() => void updateStatus(report.id, 'new')}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
                  >
                    Вернуть в новые
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
