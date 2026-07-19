import { NextRequest,NextResponse } from 'next/server'
import { pg } from '@/lib/db'
import { requireRole } from '@/lib/guard'
import { routeInputSchema } from '@/lib/routes'

export async function GET(){const guard=await requireRole('editor');if(guard.error)return guard.error;return NextResponse.json(await pg`select r.*,count(rs.id)::int as stop_count from routes r left join route_stops rs on rs.route_id=r.id group by r.id order by r.updated_at desc`)}
export async function POST(req:NextRequest){
 const guard=await requireRole('editor');if(guard.error)return guard.error
 const parsed=routeInputSchema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:'Некорректные данные',details:parsed.error.flatten()},{status:400});const d=parsed.data
 // Создание всегда даёт черновик: публикация — только через workflow-переходы.
 try{const result=await pg.begin(async sql=>{const [route]=await sql<{id:string}[]>`insert into routes(slug,status,title,summary,description,cover_url,theme,mode,estimated_duration_minutes,distance_meters,difficulty,age_group,accessibility_profile,published_at,created_by) values(${d.slug},'draft',${d.title},${d.summary??null},${d.description??null},${d.coverUrl??null},${d.theme??null},${d.mode},${d.estimatedDurationMinutes??null},${d.distanceMeters??null},${d.difficulty??null},${d.ageGroup??null},${JSON.stringify(d.accessibilityProfile)}::jsonb,${null},${guard.session.user.id}) returning id`;if(!route)throw new Error('no route');for(const [i,s] of d.stops.entries())await sql`insert into route_stops(route_id,object_id,position,arrival_radius_meters,recommended_duration_minutes,intro_text,directions_text,gps_autoplay) values(${route.id},${s.objectId},${i+1},${s.arrivalRadiusMeters},${s.recommendedDurationMinutes??null},${s.introText??null},${s.directionsText??null},${s.gpsAutoplay})`;return route})
 // Уличная геометрия сегментов — best-effort: сбой роутинга не должен ломать сохранение.
 try{const{refreshRouteLegs}=await import('@/lib/route-legs-server');await refreshRouteLegs(result.id)}catch(error){console.error(error)}
 return NextResponse.json(result,{status:201})}catch(error){console.error(error);return NextResponse.json({error:'Не удалось создать маршрут. Проверьте уникальность slug.'},{status:409})}
}

