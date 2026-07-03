import { NextRequest, NextResponse } from 'next/server'
import { pg } from '@/lib/db'
import type { StatRow } from '@/lib/types'

export const dynamic = 'force-dynamic'

interface Row {
  name: string
  cnt: string | number
  pct: string | number
}

/**
 * Проценты по округам. Без параметров — напрямую из view district_stats.
 * ?categories=a,b — тот же расчёт в SQL с фильтром по категориям
 * (клиент проценты не считает — см. CLAUDE.md).
 */
export async function GET(req: NextRequest) {
  const catsParam = req.nextUrl.searchParams.get('categories')
  const cats = catsParam
    ? catsParam.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 10)
    : null

  const rows = cats
    ? await pg<Row[]>`
        select d.name,
               count(o.id) as cnt,
               coalesce(round(100.0 * count(o.id) / nullif(sum(count(o.id)) over (), 0), 2), 0) as pct
        from districts d
        left join objects o
          on o.district_id = d.id and o.published and o.category_id in ${pg(cats)}
        group by d.name
        order by cnt desc, d.name`
    : await pg<Row[]>`select name, cnt, pct from district_stats`

  const stats: StatRow[] = rows.map((r) => ({
    name: r.name,
    cnt: Number(r.cnt),
    pct: Number(r.pct),
  }))
  return NextResponse.json(stats)
}
