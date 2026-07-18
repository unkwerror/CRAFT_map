import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { pg } from '@/lib/db'
import { isFeatureEnabled } from '@/lib/feature-flags'

export const dynamic='force-dynamic'

const title='Маршруты'
const description='Готовые прогулки по памятным местам Тюмени: маршруты с остановками у памятников, описаниями и историями мест.'
export const metadata:Metadata={
 title,description,
 alternates:{canonical:'/routes'},
 openGraph:{type:'website',locale:'ru_RU',siteName:'Память Тюмени',title,description,url:'/routes'},
}
export default async function RoutesPage(){
 if(!isFeatureEnabled('routes_enabled'))notFound()
 const routes=await pg<{slug:string;title:string;summary:string|null;mode:string;minutes:number|null;distance:number|null;stops:number}[]>`select r.slug,r.title,r.summary,r.mode,r.estimated_duration_minutes as minutes,r.distance_meters as distance,count(rs.id)::int as stops from routes r left join route_stops rs on rs.route_id=r.id where r.status='published' group by r.id order by r.published_at desc nulls last,r.title`
 return <main className="mx-auto max-w-4xl px-4 py-8"><Link href="/" className="text-[var(--accent)]">← На карту</Link><h1 className="mt-5 text-3xl font-semibold">Маршруты</h1><p className="mt-2 text-[var(--ink-muted)]">Готовые прогулки по памятным местам Тюмени</p>{routes.length===0?<p className="mt-8 rounded-xl border border-[var(--hairline)] p-5">Опубликованных маршрутов пока нет.</p>:<ul className="mt-6 grid gap-4 md:grid-cols-2">{routes.map(r=><li key={r.slug}><Link href={`/routes/${r.slug}`} className="block rounded-2xl border border-[var(--hairline)] bg-white/[.03] p-5 hover:bg-white/[.06]"><h2 className="text-xl font-semibold">{r.title}</h2>{r.summary&&<p className="mt-2 text-sm text-[var(--ink-muted)]">{r.summary}</p>}<p className="mt-4 text-sm">{r.stops} точек{r.minutes?` · ${r.minutes} мин`:''}{r.distance?` · ${(r.distance/1000).toFixed(1)} км`:''}</p></Link></li>)}</ul>}</main>
}

