import { auth } from '@/lib/auth'
import ImportReview from '@/components/admin/ImportReview'

export const dynamic = 'force-dynamic'

export default async function ImportReviewPage() {
  const session = await auth()
  return (
    <>
      <h1 className="mb-1 text-xl font-bold">Проверка импорта</h1>
      <p className="mb-4 text-sm text-slate-500">
        Объекты с доски КРАФТ. Проверьте координату (клик по карте) и подтвердите — объект
        появится на публичной карте. Порядок: не найденные → приблизительные → точные.
      </p>
      <ImportReview role={session?.user.role === 'admin' ? 'admin' : 'editor'} />
    </>
  )
}
