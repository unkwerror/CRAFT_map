'use client'
import{useEffect,useState}from'react'

type Campaign={id:string;name:string;code:string;target_type:string;target_id:string;placement_name:string|null;print_batch:string|null;enabled:boolean;scans:number}
type Option={id:string;title:string}
type TargetType='object'|'event'|'route'|'person'
const TARGET_RU:Record<TargetType,string>={object:'Объект',event:'Мероприятие',route:'Маршрут',person:'Человек'}

export default function QrCampaignsManager(){
 const[campaigns,setCampaigns]=useState<Campaign[]>([])
 const[options,setOptions]=useState<Record<TargetType,Option[]>>({object:[],event:[],route:[],person:[]})
 const[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const[name,setName]=useState(''),[targetType,setTargetType]=useState<TargetType>('object'),[targetId,setTargetId]=useState(''),[placement,setPlacement]=useState(''),[batch,setBatch]=useState('')
 async function load(){setLoading(true);try{
  const[c,objects,events,routes,memory]=await Promise.all([
   fetch('/api/admin/qr-campaigns').then(r=>r.json()),
   fetch('/api/admin/objects').then(r=>r.json()),
   fetch('/api/admin/events').then(r=>r.json()),
   fetch('/api/admin/routes').then(r=>r.json()),
   fetch('/api/admin/memory').then(r=>r.json()),
  ])
  setCampaigns(Array.isArray(c)?c:[])
  setOptions({
   object:Array.isArray(objects)?objects.map((o:{id:string;title:string})=>({id:o.id,title:o.title})):[],
   event:Array.isArray(events)?events.map((e:{id:string;title:string})=>({id:e.id,title:e.title})):[],
   route:Array.isArray(routes)?routes.map((r:{id:string;title:string})=>({id:r.id,title:r.title})):[],
   person:Array.isArray(memory?.people)?(memory.people as{id:string;name:string}[]).map(p=>({id:p.id,title:p.name})):[],
  })
 }catch{setError('Не удалось загрузить кампании')}finally{setLoading(false)}}
 useEffect(()=>{void load()},[])
 async function create(e:React.FormEvent){e.preventDefault();setError('');setNotice('');setBusy(true)
  try{const r=await fetch('/api/admin/qr-campaigns',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,targetType,targetId,placementName:placement||null,printBatch:batch||null})})
   if(!r.ok){const b=await r.json().catch(()=>null)as{error?:string}|null;setError(b?.error??'Не удалось создать кампанию');return}
   setName('');setTargetId('');setPlacement('');setBatch('');setNotice('Кампания создана — скачайте QR для печати');await load()
  }catch{setError('Нет соединения с сервером')}finally{setBusy(false)}}
 async function toggle(campaign:Campaign){setError('');setNotice('');setBusy(true)
  try{const r=await fetch(`/api/admin/qr-campaigns/${campaign.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:!campaign.enabled})})
   if(!r.ok){const b=await r.json().catch(()=>null)as{error?:string}|null;setError(b?.error??'Не удалось изменить кампанию');return}
   setNotice(campaign.enabled?'Кампания выключена: QR-переходы остановлены':'Кампания включена');await load()
  }catch{setError('Нет соединения с сервером')}finally{setBusy(false)}}
 return <div className="space-y-4">
  {(error||notice)&&<p role="status" className={`rounded-lg p-3 text-sm ${error?'bg-red-50 text-red-700':'bg-emerald-50 text-emerald-700'}`}>{error||notice}</p>}
  <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
   <div className="rounded-xl border border-slate-200 bg-white">
    <table className="w-full text-sm"><thead><tr className="border-b"><th className="p-3 text-left">Кампания</th><th className="p-3 text-left">Цель</th><th>Сканы</th><th className="p-3 text-left">Действия</th></tr></thead><tbody>
     {campaigns.map(c=><tr key={c.id} className="border-b align-top last:border-0">
      <td className="p-3 font-medium">{c.name}<div className="text-xs text-slate-400">/r/{c.code}{c.placement_name?` · ${c.placement_name}`:''}{c.print_batch?` · партия ${c.print_batch}`:''}</div>{!c.enabled&&<span className="mt-1 inline-block rounded bg-slate-200 px-1.5 text-xs">выключена</span>}</td>
      <td className="p-3 text-xs text-slate-600">{TARGET_RU[c.target_type as TargetType]??c.target_type}</td>
      <td className="p-3 text-center">{c.scans}</td>
      <td className="p-3"><div className="flex flex-wrap gap-1">
       <a href={`/api/admin/qr-campaigns/${c.id}/qr?format=svg`} download className="rounded border px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-50">SVG</a>
       <a href={`/api/admin/qr-campaigns/${c.id}/qr?format=png`} download className="rounded border px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-50">PNG</a>
       <button type="button" disabled={busy} onClick={()=>void toggle(c)} className="rounded border px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50">{c.enabled?'Выключить':'Включить'}</button>
      </div></td>
     </tr>)}
    </tbody></table>
    {loading?<p className="p-5 text-slate-500">Загружаем…</p>:campaigns.length===0&&<p className="p-5 text-slate-500">Кампаний пока нет. Создайте первую — получите короткую ссылку и QR для печати.</p>}
   </div>
   <form onSubmit={create} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
    <h2 className="font-semibold">Новая кампания</h2>
    <input required placeholder="Название (например: табличка у мемориала)" value={name} onChange={e=>setName(e.target.value)} className="w-full rounded-lg border p-2"/>
    <select value={targetType} onChange={e=>{setTargetType(e.target.value as TargetType);setTargetId('')}} className="w-full rounded-lg border p-2">{(Object.keys(TARGET_RU) as TargetType[]).map(t=><option key={t} value={t}>{TARGET_RU[t]}</option>)}</select>
    <select required value={targetId} onChange={e=>setTargetId(e.target.value)} className="w-full rounded-lg border p-2"><option value="">Куда ведёт QR</option>{options[targetType].map(o=><option key={o.id} value={o.id}>{o.title}</option>)}</select>
    <input placeholder="Место установки (необязательно)" value={placement} onChange={e=>setPlacement(e.target.value)} className="w-full rounded-lg border p-2"/>
    <input placeholder="Печатная партия (необязательно)" value={batch} onChange={e=>setBatch(e.target.value)} className="w-full rounded-lg border p-2"/>
    <button disabled={busy} className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50">{busy?'Сохраняем…':'Создать кампанию'}</button>
    <p className="text-xs text-slate-500">QR останется рабочим при изменении карточки: код ведёт на стабильную короткую ссылку.</p>
   </form>
  </div>
 </div>
}
