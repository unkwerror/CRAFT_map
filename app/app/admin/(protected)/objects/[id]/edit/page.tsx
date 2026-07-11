import { notFound } from 'next/navigation'
import { db, pg } from '@/lib/db'
import { categories } from '@/lib/schema'
import { uuidSchema } from '@/lib/validation'
import type { DescriptionSection, ObjectFull, Photo, Video } from '@/lib/types'
import ObjectForm from '@/components/admin/ObjectForm'

export const dynamic = 'force-dynamic'

export default async function EditObjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!uuidSchema.safeParse(id).success) notFound()

  const cats = await db.select().from(categories)
  const rows = await pg<{
    id: string
    title: string
    description: string | null
    category_id: string
    address: string | null
    lng: number
    lat: number
    photos: Photo[]
    videos: Video[]
    audio_url: string | null
    audio_text: string | null
    rating: string | null
    sections: DescriptionSection[]
    model_url: string | null
    published: boolean
  }[]>`
    select o.id, o.title, o.description, o.category_id, o.address,
           st_x(o.geom) as lng, st_y(o.geom) as lat, o.photos, o.videos,
           o.audio_url, o.audio_text, o.rating, o.sections, o.model_url, o.published
    from objects o where o.id = ${id} limit 1`

  const r = rows[0]
  if (!r) notFound()

  const initial: ObjectFull = {
    id: r.id,
    title: r.title,
    description: r.description,
    categoryId: r.category_id,
    categoryTitle: '',
    categoryColor: '',
    districtName: null,
    address: r.address,
    lng: r.lng,
    lat: r.lat,
    photos: r.photos,
    videos: r.videos,
    audioUrl: r.audio_url,
    audioText: r.audio_text,
    rating: r.rating === null ? null : Number(r.rating),
    sections: r.sections,
    modelUrl: r.model_url,
    published: r.published,
    events: [],
  }

  return (
    <>
      <h1 className="mb-5 text-xl font-bold">Редактирование объекта</h1>
      <ObjectForm categories={cats} initial={initial} />
    </>
  )
}
