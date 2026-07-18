'use client'
import { useCallback,useEffect,useMemo,useRef,useState } from 'react'
import AudioGuide from './AudioGuide'
import ShareButton from './ShareButton'
import { geofenceState,haversineMeters } from '@/lib/geofence'
import { markRouteStopReached,routeProgressKey,type GuestRouteProgress } from '@/lib/route-progress'
import type { PublicRouteStop } from '@/lib/routes'

export default function RouteWalk({routeId,version,stops}:{routeId:string;version:number;stops:PublicRouteStop[]}){
 const initial=useMemo<GuestRouteProgress>(()=>({routeId,routeVersion:version,reachedStopIds:[],startedAt:new Date().toISOString(),completedAt:null}),[routeId,version])
 const[progress,setProgress]=useState(initial);const[watching,setWatching]=useState(false);const[gpsMessage,setGpsMessage]=useState('');const[current,setCurrent]=useState(0);const[variant,setVariant]=useState<'short'|'full'>('full')
 const watchRef=useRef<number|null>(null);const insideRef=useRef(false);const currentRef=useRef(0)
 useEffect(()=>{try{const raw=localStorage.getItem(routeProgressKey(routeId));if(raw){const saved=JSON.parse(raw) as GuestRouteProgress;if(saved.routeVersion===version)setProgress(saved)}}catch{}},[routeId,version])
 const stopGps=useCallback((message='')=>{if(watchRef.current!==null&&navigator.geolocation)navigator.geolocation.clearWatch(watchRef.current);watchRef.current=null;insideRef.current=false;setWatching(false);if(message)setGpsMessage(message)},[])
 useEffect(()=>()=>stopGps(),[stopGps])
 // Смена точки: гистерезис начинается заново, наблюдение продолжается уже для новой точки.
 useEffect(()=>{currentRef.current=current;insideRef.current=false;const stop=stops[current];setVariant(stop?.shortAudioUrl?'short':'full')},[current,stops])
 function persist(next:GuestRouteProgress){try{localStorage.setItem(routeProgressKey(routeId),JSON.stringify(next))}catch{}}
 function reach(stopId:string){setProgress(p=>{const next=markRouteStopReached(p,stopId,stops.length);persist(next);return next})}
 function resetProgress(){setProgress(initial);try{localStorage.removeItem(routeProgressKey(routeId))}catch{};setCurrent(0)}
 function startGps(){
  if(!navigator.geolocation){setGpsMessage('Геолокация не поддерживается. Используйте кнопку «Я у объекта».');return}
  if(watching){stopGps('GPS-проверка выключена.');return}
  setWatching(true);insideRef.current=false;setGpsMessage('Следим за положением. Аудио включается только вручную.')
  watchRef.current=navigator.geolocation.watchPosition(pos=>{
   const stop=stops[currentRef.current];if(!stop)return
   const distance=haversineMeters({lat:pos.coords.latitude,lng:pos.coords.longitude},{lat:stop.lat,lng:stop.lng})
   const inside=geofenceState(distance,stop.arrivalRadiusMeters,insideRef.current)
   if(inside&&!insideRef.current){insideRef.current=true;reach(stop.id);setGpsMessage('Вы у объекта — точка отмечена.')}
   else if(!inside){insideRef.current=false;setGpsMessage(`До точки примерно ${Math.round(distance)} м. Отметить её можно вручную.`)}
  },()=>stopGps('Доступ к геолокации не предоставлен. Используйте ручное подтверждение.'),{enableHighAccuracy:true,timeout:10000,maximumAge:5000})
 }
 const stop=stops[current];if(!stop)return null
 const finished=Boolean(progress.completedAt)||stops.length>0&&progress.reachedStopIds.length>=stops.length
 const walkedMinutes=progress.completedAt?Math.max(1,Math.round((Date.parse(progress.completedAt)-Date.parse(progress.startedAt))/60000)):null
 const hasVariants=Boolean(stop.shortAudioUrl&&stop.fullAudioUrl)
 const audioUrl=variant==='short'?stop.shortAudioUrl??stop.audioUrl:stop.fullAudioUrl??stop.audioUrl
 const audioText=variant==='short'?stop.shortAudioText??stop.audioText:stop.fullAudioText??stop.audioText
 return <section className="mt-6 rounded-2xl border border-[var(--hairline)] p-4">
  {finished&&<div className="mb-4 rounded-xl border border-[var(--hairline-strong)] bg-white/[.04] p-4" role="status"><h2 className="text-lg font-semibold">Маршрут пройден!</h2><p className="mt-1 text-sm text-[var(--ink-muted)]">{stops.length} точек{walkedMinutes?` · примерно ${walkedMinutes} мин в пути`:''}. Спасибо за прогулку.</p><div className="mt-3 flex flex-wrap gap-2"><ShareButton title="Я прошёл маршрут по памятным местам Тюмени"/><button onClick={resetProgress} className="min-h-11 rounded-xl border border-[var(--hairline)] px-4">Пройти заново</button></div></div>}
  <div className="flex justify-between gap-3"><div><p aria-live="polite" className="text-sm text-[var(--ink-muted)]">Точка {current+1} из {stops.length}: {stop.title}</p><h2 className="mt-1 text-xl font-semibold">{stop.title}</h2>{stop.address&&<p className="text-sm text-[var(--ink-muted)]">{stop.address}</p>}{stop.recommendedDurationMinutes&&<p className="text-xs text-[var(--ink-subtle)]">Рекомендуемое время на точке — {stop.recommendedDurationMinutes} мин</p>}</div><span className="text-sm font-semibold">{progress.reachedStopIds.length}/{stops.length}</span></div>
  {stop.introText&&<p className="mt-4 whitespace-pre-line">{stop.introText}</p>}
  {hasVariants&&<div className="mt-4 flex gap-2" role="group" aria-label="Версия рассказа"><button onClick={()=>setVariant('short')} aria-pressed={variant==='short'} className={`min-h-11 rounded-xl px-4 text-sm ${variant==='short'?'btn-accent':'border border-[var(--hairline)]'}`}>Коротко</button><button onClick={()=>setVariant('full')} aria-pressed={variant==='full'} className={`min-h-11 rounded-xl px-4 text-sm ${variant==='full'?'btn-accent':'border border-[var(--hairline)]'}`}>Подробно</button></div>}
  <div className="mt-4"><AudioGuide key={`${stop.id}-${variant}`} audioUrl={audioUrl} audioText={audioText}/></div>
  <div className="mt-4 flex flex-wrap gap-2"><button className="btn-accent min-h-11 rounded-xl px-4" onClick={()=>reach(stop.id)}>{progress.reachedStopIds.includes(stop.id)?'Точка пройдена':'Я у объекта'}</button><button className="min-h-11 rounded-xl border border-[var(--hairline)] px-4" onClick={startGps} aria-pressed={watching}>{watching?'Выключить GPS-проверку':'Проверить по GPS'}</button></div>
  {gpsMessage&&<p role="status" className="mt-2 text-sm text-[var(--ink-muted)]">{gpsMessage}</p>}
  {stop.directionsText&&current<stops.length-1&&<div className="mt-4 rounded-xl bg-white/[.03] p-3"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-subtle)]">Как пройти дальше</p><p className="mt-1 whitespace-pre-line text-sm text-[var(--ink-muted)]">{stop.directionsText}</p></div>}
  <div className="mt-5 flex justify-between gap-2"><button disabled={current===0} onClick={()=>setCurrent(v=>v-1)} className="min-h-11 rounded-xl border border-[var(--hairline)] px-4 disabled:opacity-40">← Предыдущая</button><button disabled={current===stops.length-1} onClick={()=>setCurrent(v=>v+1)} className="min-h-11 rounded-xl border border-[var(--hairline)] px-4 disabled:opacity-40">Следующая →</button></div>
 </section>
}
