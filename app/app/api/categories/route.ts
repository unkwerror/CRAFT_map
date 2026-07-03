import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { categories } from '@/lib/schema'

export const dynamic = 'force-dynamic'

export async function GET() {
  const rows = await db.select().from(categories)
  return NextResponse.json(rows)
}
