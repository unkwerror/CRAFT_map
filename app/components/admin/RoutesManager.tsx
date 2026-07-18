'use client'
import{useEffect,useState}from'react'
import{EDITORIAL_STATUSES,canTransitionEditorialStatus,type EditorialStatus}from'@/lib/editorial-workflow'

type ObjectRow={id:string;title:string}
type RouteRow={id:string;slug:string;title:string;status:string;stop_count:number}
type StopDraft={objectId:string;arrivalRadiusMeters:number;recommendedDurationMinutes:string;introText:string;directionsText:string;gpsAutoplay:boolean}
type RouteDetail={id:string;slug:string;title:string;summary:string|null;description:string|null;estimated_duration_minutes:number|null;distance_meters:number|null;difficulty:string|null;stops:Array<{object_id:string;arrival_radius_meters:number;recommended_duration_minutes:number|null;intro_text:string|null;directions_text:string|null;gps_autoplay:boolean}>}

const STATUS_RU:Record<string,string>={draft:'черновик',review:'на проверке',changes_requested:'на доработке',approved:'одобрено',published:'опубликовано',archived:'в архиве'}
const ACTION_RU:Record<string,string>={draft:'В черновики',review:'На проверку',changes_requested:'Вернуть на доработку',approved:'Одобрить',published:'Опубликовать',archived:'В архив'}
const allowedTransitions=(status:string):EditorialStatus[]=>(EDITORIAL_STATUSES as readonly string[]).includes(status)?EDITORIAL_STATUSES.filter(s=>s!==status&&canTransitionEditorialStatus(status as EditorialStatus,s)):[]
const emptyStop=(objectId:string):StopDraft=>({objectId,arrivalRadiusMeters:40,recommendedDurationMinutes:'',introText:'',directionsText:'',gpsAutoplay:false})

export default function RoutesManager(){
 const[routes,setRoutes]=useState<RouteRow[]>([]),[objects,setObjects]=useState<ObjectRow[]>([])
 const[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const[editingId,setEditingId]=useState<string|null>(null)
 const[title,setTitle]=useState(''),[slug,setSlug]=useState(''),[summary,setSummary]=useState(''),[minutes,setMinutes]=useState(''),[distance,setDistance]=useState(''),[difficulty,setDifficulty]=useState('')
 const[stops,setStops]=useState<StopDraft[]>([])
 async function load(){setLoading(true);try{const[a,b]=await Promise.all([fetch('/api/admin/routes').then(r=>r.json()),fetch('/api/admin/objects').then(r=>r.json())]);setRoutes(Array.isArray(a)?a:[]);setObjects(Array.isArray(b)?b:[])}catch{setError('Не удалось загрузить список маршрутов')}finally{setLoading(false)}}
 useEffect(()=>{void load()},[])
 function resetForm(){setEditingId(null);setTitle('');setSlug('');setSummary('');setMinutes('');setDistance('');setDifficulty('');setStops([])}
 async function startEdit(id:string){setError('');setNotice('');try{const r=await fetch(`/api/admin/routes/${id}`);if(!r.ok)throw new Error();const d=await r.json() as RouteDetail;setEditingId(d.id);setTitle(d.title);setSlug(d.slug);setSummary(d.summary??'');setMinutes(d.estimated_duration_minutes?String(d.estimated_duration_minutes):'');setDistance(d.distance_meters?String(d.distance_meters):'');setDifficulty(d.difficulty??'');setStops(d.stops.map(s=>({objectId:s.object_id,arrivalRadiusMeters:s.arrival_radius_meters,recommendedDurationMinutes:s.recommended_duration_minutes?String(s.recommended_duration_minutes):'',introText:s.intro_text??'',directionsText:s.directions_text??'',gpsAutoplay:s.gps_autoplay})))}catch{setError('Не удалось открыть маршрут для редактирования')}}
 async function submit(e:React.FormEvent){e.preventDefault();setError('');setNotice('');setBusy(true)
  try{
   const payload={title,slug,summary:summary||null,estimatedDurationMinutes:minutes?Number(minutes):null,distanceMeters:distance?Number(distance):null,difficulty:difficulty||null,stops:stops.map(s=>({objectId:s.objectId,arrivalRadiusMeters:s.arrivalRadiusMeters,recommendedDurationMinutes:s.recommendedDurationMinutes?Number(s.recommendedDurationMinutes):null,introText:s.introText||null,directionsText:s.directionsText||null,gpsAutoplay:s.gpsAutoplay}))}
   const response=await fetch(editingId?`/api/admin/routes/${editingId}`:'/api/admin/routes',{method:editingId?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
   if(!response.ok){const body=await response.json().catch(()=>null)as{error?:string}|null;setError(body?.error??'Не удалось сохранить');return}
   setNotice(editingId?'Маршрут сохранён. Новая версия офлайн-пакета будет собрана автоматически.':'Черновик маршрута создан')
   resetForm();await load()
  }catch{setError('Нет соединения с сервером — попробуйте ещё раз')}finally{setBusy(false)}}
 async function transition(id:string,status:string){setError('');setNotice('');setBusy(true);try{const r=await fetch(`/api/admin/routes/${id}/workflow`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});if(!r.ok){const b=await r.json().catch(()=>null)as{error?:string}|null;setError(b?.error??'Не удалось изменить статус');return}setNotice('Статус обновлён');await load()}catch{setError('Нет соединения с сервером')}finally{setBusy(false)}}
 async function removeRoute(id:string,routeTitle:string){if(!window.confirm(`Удалить маршрут «${routeTitle}»? Действие необратимо.`))return;setError('');setNotice('');setBusy(true);try{const r=await fetch(`/api/admin/routes/${id}`,{method:'DELETE'});if(!r.ok){const b=await r.json().catch(()=>null)as{error?:string}|null;setError(b?.error??'Не удалось удалить');return}setNotice('Маршрут удалён');if(editingId===id)resetForm();await load()}catch{setError('Нет соединения с сервером')}finally{setBusy(false)}}
 function moveStop(index:number,delta:number){setStops(s=>{const next=[...s];const target=index+delta;if(target<0||target>=next.length)return s;const[item]=next.splice(index,1);next.splice(target,0,item!);return next})}
 function patchStop(index:number,patch:Partial<StopDraft>){setStops(s=>s.map((item,i)=>i===index?{...item,...patch}:item))}
 return <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
  <div className="space-y-3">
   {(error||notice)&&<p role="status" className={`rounded-lg p-3 text-sm ${error?'bg-red-50 text-red-700':'bg-emerald-50 text-emerald-700'}`}>{error||notice}</p>}
   <div className="rounded-xl border border-slate-200 bg-white">
    <table className="w-full text-sm"><thead><tr className="border-b"><th className="p-3 text-left">Маршрут</th><th>Точки</th><th className="p-3 text-left">Статус и действия</th></tr></thead><tbody>
     {routes.map(r=><tr key={r.id} className="border-b align-top last:border-0"><td className="p-3 font-medium">{r.title}<div className="text-xs text-slate-400">/routes/{r.slug}</div></td><td className="p-3 text-center">{r.stop_count}</td><td className="p-3"><span className="text-xs text-slate-500">{STATUS_RU[r.status]??r.status}</span><div className="mt-1 flex flex-wrap gap-1">{allowedTransitions(r.status).map(s=><button key={s} type="button" disabled={busy} onClick={()=>void transition(r.id,s)} className="rounded border px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50">{ACTION_RU[s]??s}</button>)}<button type="button" disabled={busy} onClick={()=>void startEdit(r.id)} className="rounded border px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50">Изменить</button>{r.status!=='published'&&<button type="button" disabled={busy} onClick={()=>void removeRoute(r.id,r.title)} className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50">Удалить</button>}</div></td></tr>)}
    </tbody></table>
    {loading?<p className="p-5 text-slate-500">Загружаем…</p>:routes.length===0&&<p className="p-5 text-slate-500">Маршрутов пока нет</p>}
   </div>
  </div>
  <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
   <h2 className="font-semibold">{editingId?'Редактирование маршрута':'Новый черновик'}</h2>
   <input required placeholder="Название" value={title} onChange={e=>setTitle(e.target.value)} className="w-full rounded-lg border p-2"/>
   <input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" title="Строчные латинские буквы, цифры и дефисы: naprimer-tak" placeholder="slug-latinicey" value={slug} onChange={e=>setSlug(e.target.value)} className="w-full rounded-lg border p-2"/>
   <textarea placeholder="Краткое описание для каталога" value={summary} onChange={e=>setSummary(e.target.value)} rows={2} className="w-full rounded-lg border p-2"/>
   <div className="grid grid-cols-3 gap-2"><input type="number" min={1} max={1440} placeholder="Минуты" value={minutes} onChange={e=>setMinutes(e.target.value)} className="rounded-lg border p-2" aria-label="Длительность в минутах"/><input type="number" min={0} step={100} placeholder="Метры" value={distance} onChange={e=>setDistance(e.target.value)} className="rounded-lg border p-2" aria-label="Длина в метрах"/><input placeholder="Сложность" value={difficulty} onChange={e=>setDifficulty(e.target.value)} className="rounded-lg border p-2"/></div>
   <label className="block text-sm">Добавить остановку<select value="" onChange={e=>{const id=e.target.value;if(id)setStops(s=>s.some(x=>x.objectId===id)?s:[...s,emptyStop(id)])}} className="mt-1 w-full rounded-lg border p-2"><option value="">Выберите объект</option>{objects.map(o=><option key={o.id} value={o.id}>{o.title}</option>)}</select></label>
   <ol className="space-y-2 text-sm">{stops.map((s,i)=><li key={s.objectId} className="rounded-lg border border-slate-200 p-2">
    <div className="flex items-center justify-between gap-2"><span className="font-medium">{i+1}. {objects.find(o=>o.id===s.objectId)?.title??'Объект'}</span><span className="flex gap-1"><button type="button" aria-label="Выше" disabled={i===0} onClick={()=>moveStop(i,-1)} className="rounded border px-2 disabled:opacity-30">↑</button><button type="button" aria-label="Ниже" disabled={i===stops.length-1} onClick={()=>moveStop(i,1)} className="rounded border px-2 disabled:opacity-30">↓</button><button type="button" aria-label="Убрать остановку" onClick={()=>setStops(list=>list.filter(x=>x.objectId!==s.objectId))} className="rounded border px-2">×</button></span></div>
    <details className="mt-2"><summary className="cursor-pointer text-xs text-slate-500">Параметры остановки</summary><div className="mt-2 space-y-2">
     <label className="block text-xs">Радиус прихода, м<input type="number" min={10} max={500} value={s.arrivalRadiusMeters} onChange={e=>patchStop(i,{arrivalRadiusMeters:Number(e.target.value)||40})} className="mt-1 w-full rounded-lg border p-1.5"/></label>
     <label className="block text-xs">Минут на точке<input type="number" min={1} max={240} value={s.recommendedDurationMinutes} onChange={e=>patchStop(i,{recommendedDurationMinutes:e.target.value})} className="mt-1 w-full rounded-lg border p-1.5"/></label>
     <label className="block text-xs">Вступление на точке<textarea rows={2} value={s.introText} onChange={e=>patchStop(i,{introText:e.target.value})} className="mt-1 w-full rounded-lg border p-1.5"/></label>
     <label className="block text-xs">Как пройти дальше<textarea rows={2} value={s.directionsText} onChange={e=>patchStop(i,{directionsText:e.target.value})} className="mt-1 w-full rounded-lg border p-1.5"/></label>
    </div></details>
   </li>)}</ol>
   <div className="flex gap-2"><button disabled={busy} className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50">{busy?'Сохраняем…':editingId?'Сохранить':'Создать черновик'}</button>{editingId&&<button type="button" onClick={resetForm} className="rounded-lg border px-4 py-2">Отменить правку</button>}</div>
   <p className="text-xs text-slate-500">Публикация — кнопками статуса в таблице. Для публикации нужны минимум две остановки.</p>
  </form>
 </div>
}
