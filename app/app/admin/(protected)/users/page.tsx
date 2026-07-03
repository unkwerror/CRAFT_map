import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import UsersManager from '@/components/admin/UsersManager'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const session = await auth()
  if (session?.user.role !== 'admin') redirect('/admin')
  return (
    <>
      <h1 className="mb-4 text-xl font-bold">Пользователи</h1>
      <UsersManager selfId={session.user.id} />
    </>
  )
}
