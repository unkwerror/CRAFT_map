import { Suspense } from 'react'
import { db } from '@/lib/db'
import { categories } from '@/lib/schema'
import MapApp from '@/components/MapApp'
import MapPreloader from '@/components/MapPreloader'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const cats = await db.select().from(categories)
  return (
    <Suspense fallback={<MapPreloader label="Загружаем карту" progress={24} />}>
      <MapApp categories={cats} />
    </Suspense>
  )
}
