import { NextResponse } from 'next/server'
import { getHealthChecks, summarizeHealth } from '@/lib/health'

export const dynamic = 'force-dynamic'

/** Readiness без раскрытия имён таблиц, путей и деталей ошибок. */
export async function GET() {
  const summary = summarizeHealth(await getHealthChecks())
  return NextResponse.json(
    { status: summary.status },
    {
      status: summary.httpStatus,
      headers: { 'Cache-Control': 'no-store' },
    }
  )
}
