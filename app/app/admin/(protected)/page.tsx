import { auth } from '@/lib/auth'
import ObjectsTable from '@/components/admin/ObjectsTable'

export const dynamic = 'force-dynamic'

export default async function AdminObjectsPage() {
  const session = await auth()
  return (
    <>
      <h1 className="mb-4 text-xl font-bold">Объекты</h1>
      <ObjectsTable role={session?.user.role === 'admin' ? 'admin' : 'editor'} />
    </>
  )
}
