import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { NextResponse } from 'next/server'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { pg } from '@/lib/db'
import { UPLOADS_DIR } from '@/lib/paths'
type Params={params:Promise<{slug:string}>}

// Размер до загрузки — требование F-04: считаем байты локальных файлов пакета.
async function uploadBytes(url:unknown):Promise<number>{
  if(typeof url!=='string'||!/^\/uploads\/[a-zA-Z0-9._-]+$/.test(url))return 0
  try{return(await stat(join(UPLOADS_DIR,url.slice('/uploads/'.length)))).size}catch{return 0}
}

export async function GET(_req:Request,{params}:Params){
  if(!isFeatureEnabled('routes_enabled')||!isFeatureEnabled('offline_packages_enabled')) return NextResponse.json({error:'Офлайн-пакеты недоступны'},{status:404})
  const {slug}=await params
  const [route]=await pg<{id:string;version:number}[]>`select id,offline_package_version as version from routes where slug=${slug} and status='published'`
  if(!route)return NextResponse.json({error:'Маршрут не найден'},{status:404})
  const assets=await pg<{objectId:string;photos:unknown;audioUrl:string|null}[]>`select o.id as "objectId",o.photos,o.audio_url as "audioUrl" from route_stops rs join objects o on o.id=rs.object_id where rs.route_id=${route.id} and o.published order by rs.position`
  let approxTotalBytes=0
  for(const asset of assets){
    approxTotalBytes+=await uploadBytes(asset.audioUrl)
    if(Array.isArray(asset.photos))for(const raw of asset.photos)approxTotalBytes+=await uploadBytes((raw as{thumb?:string})?.thumb)
  }
  return NextResponse.json(
    {schemaVersion:1,routeId:route.id,packageVersion:route.version,generatedAt:new Date().toISOString(),routeUrl:`/api/v1/routes/${slug}`,approxTotalBytes,assets},
    {headers:{'Cache-Control':'public, max-age=60, stale-while-revalidate=300'}}
  )
}
