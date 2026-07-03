import { db } from '@/lib/db'
import { categories } from '@/lib/schema'
import ObjectForm from '@/components/admin/ObjectForm'

export const dynamic = 'force-dynamic'

export default async function NewObjectPage() {
  const cats = await db.select().from(categories)
  return (
    <>
      <h1 className="mb-5 text-xl font-bold">Новый объект</h1>
      <ObjectForm categories={cats} />
    </>
  )
}
