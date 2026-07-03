import { Suspense } from 'react'
import { db } from '@/lib/db'
import { categories } from '@/lib/schema'
import MapApp from '@/components/MapApp'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const cats = await db.select().from(categories)
  return (
    <Suspense>
      <MapApp categories={cats} />
    </Suspense>
  )
}
