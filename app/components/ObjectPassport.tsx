import type { ObjectFull } from '@/lib/types'

export default function ObjectPassport({ object }: { object: ObjectFull }) {
  const rows = [
    ['Тип объекта', object.objectType],
    ['Период создания', object.creationPeriod],
    ['Материалы', object.materials?.join(', ')],
    ['Охранный статус', object.protectionStatus],
    ['Режим доступа', object.accessInfo],
    ['Достоверность', object.verificationStatus === 'verified' ? 'Проверено редакцией' : object.verificationStatus === 'needs_review' ? 'Требует проверки' : null],
  ].filter((row): row is [string, string] => Boolean(row[1]))
  if (!rows.length && !object.alternativeNames?.length) return null
  return (
    <section className="rounded-2xl border border-[var(--hairline)] bg-white/[0.025] p-4" aria-labelledby={`passport-${object.id}`}>
      <h3 id={`passport-${object.id}`} className="text-[15px] font-semibold">Паспорт места</h3>
      {object.alternativeNames?.length ? <p className="mt-2 text-sm text-[var(--ink-muted)]">Также: {object.alternativeNames.join(', ')}</p> : null}
      <dl className="mt-3 space-y-2 text-sm">
        {rows.map(([label, value]) => <div key={label}><dt className="font-semibold">{label}</dt><dd className="text-[var(--ink-muted)]">{value}</dd></div>)}
      </dl>
    </section>
  )
}
