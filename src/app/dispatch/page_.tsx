'use client'
import { useEffect, useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { loadsApi, driversApi, trucksApi } from '@/lib/api'
import toast from 'react-hot-toast'

const fmtDate = (d: string | null | undefined): string => {
  if (!d) return '—'
  try { const [y,m,day]=d.slice(0,10).split('-'); return `${m}/${day}/${y}` }
  catch { return d }
}

interface Stop {
  stop_number: number; action: 'Pickup'|'Delivery'
  company_name: string; street: string; city: string
  state: string; zip: string; date: string; time: string; notes: string
}
const mkStop = (n:number, a:'Pickup'|'Delivery'): Stop =>
  ({stop_number:n,action:a,company_name:'',street:'',city:'',state:'',zip:'',date:'',time:'',notes:''})

const EMPTY = {
  load_number:'',broker_load_id:'',broker_name:'',shipper_name:'',
  carrier_name:'',driver_id:null as number|null,driver_name:'',
  truck_id:null as number|null,truck_number:'',trailer_number:'',
  commodity:'',weight_lbs:'',loaded_miles:'',empty_miles:'',
  freight_rate:'',status:'Dispatched',tonu:false,tonu_amount:'',notes:'',source_file:'',
  stops:[mkStop(1,'Pickup'),mkStop(2,'Delivery')] as Stop[],
}

const STAGES = [
  { key:'dispatched', label:'Dispatched', color:'#3B82F6', bg:'#EFF6FF', border:'#BFDBFE', statuses:['Dispatched'], next:'Delivered', nextLabel:'Mark Delivered' },
  { key:'delivered',  label:'Delivered',  color:'#10B981', bg:'#F0FDF4', border:'#BBF7D0', statuses:['Delivered'],  next:'Paid',      nextLabel:'Mark Paid'      },
  { key:'paid',       label:'Paid',       color:'#6B7280', bg:'#F8F7F4', border:'#E2E8F0', statuses:['Paid'],       next:null,        nextLabel:null             },
]

const STATUS_COLOR: Record<string,string> = { Dispatched:'#3B82F6', Delivered:'#10B981', Paid:'#6B7280' }

export default function DispatchPage() {
  const [view,setView]           = useState<'pipeline'|'list'|'form'>('pipeline')
  const [loads,setLoads]         = useState<any[]>([])
  const [docStatus,setDocStatus] = useState<Record<number,any>>({})
  const [drivers,setDrivers]     = useState<any[]>([])
  const [trucks,setTrucks]       = useState<any[]>([])
  const [form,setForm]           = useState<any>({...EMPTY})
  const [editId,setEditId]       = useState<number|null>(null)
  const [saving,setSaving]       = useState(false)
  const [extracting,setExtr]     = useState(false)
  const [log,setLog]             = useState<string[]>([])
  const [selLoad,setSelLoad]     = useState<any>(null)
  const [docs,setDocs]           = useState<any[]>([])
  const [pageLoading,setPageL]   = useState(true)
  const [moving,setMoving]       = useState<number|null>(null)
  const [prevView,setPrevView]   = useState<'pipeline'|'list'>('pipeline')

  const f = (k:string,v:any) => setForm((p:any)=>({...p,[k]:v}))
  const upStop = (idx:number, key:keyof Stop, val:string) =>
    setForm((p:any)=>{const s=[...p.stops];s[idx]={...s[idx],[key]:key==='state'?val.toUpperCase():val};return{...p,stops:s}})
  const addStop = (a:'Pickup'|'Delivery') =>
    setForm((p:any)=>({...p,stops:[...p.stops,mkStop(p.stops.length+1,a)]}))
  const remStop = (idx:number) =>
    setForm((p:any)=>({...p,stops:p.stops.filter((_:any,i:number)=>i!==idx).map((s:Stop,i:number)=>({...s,stop_number:i+1}))}))

  useEffect(()=>{
    Promise.all([driversApi.list(),trucksApi.list()])
      .then(([d,t])=>{setDrivers(d.data);setTrucks(t.data)}).catch(()=>{})
  },[])

  const refreshLoads = useCallback(async()=>{
    setPageL(true)
    try{
      const l = await loadsApi.list({})
      setLoads(l.data)
      const st:Record<number,any>={}
      await Promise.all(l.data.map(async(load:any)=>{
        try{const r=await loadsApi.docStatus(load.id);st[load.id]=r.data}catch{}
      }))
      setDocStatus(st)
    }catch{}finally{setPageL(false)}
  },[])

  useEffect(()=>{refreshLoads()},[refreshLoads])

  const newLoad = async()=>{
    try{const r=await loadsApi.nextNumber();setForm({...EMPTY,load_number:r.data.load_number})}catch{}
    setPrevView(view==='form'?'pipeline':view as 'pipeline'|'list')
    setEditId(null);setLog([]);setView('form')
  }

  const goBack = ()=>{ setView(prevView); refreshLoads() }

  const moveToNext = async(load:any, nextStatus:string)=>{
    setMoving(load.id)
    try{
      await loadsApi.updateStatus(load.id,nextStatus)
      setLoads(p=>p.map(l=>l.id===load.id?{...l,status:nextStatus}:l))
      toast.success(`Load #${load.load_number} → ${nextStatus}`)
    }catch(e:any){toast.error(e.response?.data?.detail||'Failed')}
    finally{setMoving(null)}
  }

  const onDrop = useCallback(async(files:File[])=>{
    const file=files[0];if(!file)return
    setExtr(true);setLog(['Uploading to Gemini AI...'])
    try{
      const res=await loadsApi.extract(file)
      const{form_data,status_log}=res.data
      setLog(status_log||['Done'])
      const rawStops:Stop[]=(form_data.Stops||[]).map((s:any,i:number)=>({
        stop_number:s.stop_number||i+1,action:s.action==='Delivery'?'Delivery':'Pickup',
        company_name:s.company_name||'',street:s.street||'',city:s.city||'',
        state:s.state||'',zip:s.zip||'',date:s.date||'',time:s.time||'',notes:s.notes||'',
      }))
      const stops:Stop[]=rawStops.length>0?rawStops:[
        {stop_number:1,action:'Pickup',company_name:form_data.Origin_Company||form_data.Shipper_Name||'',
         street:form_data.Origin_Street||'',city:form_data.Origin_City||'',state:form_data.Origin_State||'',
         zip:form_data.Origin_ZIP||'',date:form_data.Load_Date||'',time:'',notes:''},
        {stop_number:2,action:'Delivery',company_name:form_data.Destination_Company||'',
         street:form_data.Destination_Street||'',city:form_data.Destination_City||'',state:form_data.Destination_State||'',
         zip:form_data.Destination_ZIP||'',date:form_data.Delivery_Date||'',time:'',notes:''},
      ]
      setForm((prev:any)=>({
        ...prev,
        broker_load_id:form_data.Broker_Load_ID||prev.broker_load_id,
        broker_name:form_data.Broker_Name||prev.broker_name,
        shipper_name:form_data.Shipper_Name||prev.shipper_name,
        carrier_name:form_data.Carrier_Name||prev.carrier_name,
        driver_name:form_data.Driver_Name||prev.driver_name,
        truck_number:form_data.Truck_Number||prev.truck_number,
        trailer_number:form_data.Trailer_Number||prev.trailer_number,
        commodity:form_data.Commodity||prev.commodity,
        weight_lbs:form_data.Weight_LBS||prev.weight_lbs,
        loaded_miles:form_data.Miles||prev.loaded_miles,
        freight_rate:form_data.Rate_USD||prev.freight_rate,
        source_file:file.name,stops,
      }))
      toast.success(`${stops.length} stops extracted`)
    }catch{toast.error('Extraction failed');setLog(['Failed'])}
    finally{setExtr(false)}
  },[])

  const{getRootProps,getInputProps,isDragActive}=useDropzone({
    onDrop,accept:{'application/pdf':['.pdf'],'image/*':['.png','.jpg','.jpeg']},multiple:false,
  })

  const save=async()=>{
    if(!form.broker_name){toast.error('Broker name required');return}
    if(!form.freight_rate){toast.error('Freight rate required');return}
    setSaving(true)
    try{
      const fp=form.stops.find((s:Stop)=>s.action==='Pickup')
      const ld=[...form.stops].reverse().find((s:Stop)=>s.action==='Delivery')
      const payload={
        load_number:form.load_number,broker_load_id:form.broker_load_id,
        broker_name:form.broker_name,shipper_name:form.shipper_name||fp?.company_name||'',
        carrier_name:form.carrier_name,
        driver_id:form.driver_id?Number(form.driver_id):null,driver_name:form.driver_name,
        truck_id:form.truck_id?Number(form.truck_id):null,truck_number:form.truck_number,
        trailer_number:form.trailer_number,
        pickup_date:fp?.date||'',pickup_appt:fp?.time||'',
        pickup_company:fp?.company_name||'',pickup_street:fp?.street||'',
        pickup_city:fp?.city||'',pickup_state:(fp?.state||'').toUpperCase(),pickup_zip:fp?.zip||'',
        delivery_date:ld?.date||'',delivery_appt:ld?.time||'',
        delivery_company:ld?.company_name||'',delivery_street:ld?.street||'',
        delivery_city:ld?.city||'',delivery_state:(ld?.state||'').toUpperCase(),delivery_zip:ld?.zip||'',
        commodity:form.commodity,
        weight_lbs:form.weight_lbs?Number(form.weight_lbs):null,
        loaded_miles:form.loaded_miles?Number(form.loaded_miles):null,
        empty_miles:form.empty_miles?Number(form.empty_miles):null,
        freight_rate:Number(form.freight_rate)||0,
        tonu:form.tonu,tonu_amount:Number(form.tonu_amount)||0,
        status:form.status,source_file:form.source_file,
        notes:form.stops.length>2
          ?`[MULTI-STOP]\n${form.stops.map((s:Stop)=>`${s.action} ${s.stop_number}: ${s.company_name} | ${s.street}, ${s.city}, ${s.state} ${s.zip} @ ${s.date} ${s.time}`).join('\n')}\n\n${form.notes}`
          :form.notes,
      }
      if(editId){await loadsApi.update(editId,payload);toast.success('Load updated')}
      else{await loadsApi.create(payload);toast.success('Load saved!')}
      setEditId(null);setLog([]);goBack()
    }catch(e:any){toast.error(e.response?.data?.detail||'Failed')}
    finally{setSaving(false)}
  }

  const openEdit=(l:any)=>{
    const stops:Stop[]=[
      {stop_number:1,action:'Pickup',company_name:l.pickup_company||'',street:l.pickup_street||'',
       city:l.pickup_city||'',state:l.pickup_state||'',zip:l.pickup_zip||'',date:l.pickup_date||'',time:l.pickup_appt||'',notes:''},
      {stop_number:2,action:'Delivery',company_name:l.delivery_company||'',street:l.delivery_street||'',
       city:l.delivery_city||'',state:l.delivery_state||'',zip:l.delivery_zip||'',date:l.delivery_date||'',time:l.delivery_appt||'',notes:''},
    ]
    setForm({...l,stops,weight_lbs:l.weight_lbs||'',loaded_miles:l.loaded_miles||'',
      empty_miles:l.empty_miles||'',freight_rate:l.freight_rate||'',tonu_amount:l.tonu_amount||''})
    setPrevView(view==='form'?'pipeline':view as 'pipeline'|'list')
    setEditId(l.id);setView('form');window.scrollTo({top:0,behavior:'smooth'})
  }

  const openDocs=async(l:any)=>{
    setSelLoad(l);const r=await loadsApi.getDocs(l.id);setDocs(r.data)
  }

  const ic="w-full px-3 py-2 rounded-lg text-sm border outline-none transition-all"
  const is={borderColor:'#E2E8F0',background:'#FAFAF9'}
  const lb="block text-xs font-medium mb-1 text-slate-500"
  const stageLoads=(stage:typeof STAGES[0])=>loads.filter(l=>stage.statuses.includes(l.status))

  const DocBadge=({has,label}:{has:boolean;label:string})=>(
    <span className="text-xs px-2 py-0.5 rounded-full"
      style={{background:has?'#F0FDF4':label==='POD'?'#F8F7F4':'#FEF2F2',
        color:has?'#16A34A':label==='POD'?'#94A3B8':'#DC2626'}}>
      {has?'✅':label==='POD'?'—':'❌'} {label}
    </span>
  )

  return(
    <div className="animate-fade-in">
      {/* ── HEADER ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-7">
        <div>
          {view === 'form' ? (
            <div>
              <button onClick={goBack}
                className="flex items-center gap-1 text-xs font-medium mb-1.5"
                style={{ color: '#94A3B8' }}>
                ← Dispatch
              </button>
              <h1 className="text-2xl font-bold"
                style={{ color: '#1A1A2E', fontFamily: 'Playfair Display,serif' }}>
                {editId ? `Edit Load #${form.load_number}` : 'New Load'}
              </h1>
            </div>
          ) : (
            <h1 className="text-2xl font-bold"
              style={{ color: '#1A1A2E', fontFamily: 'Playfair Display,serif' }}>
              Dispatch
            </h1>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Pipeline / List toggle — always visible */}
          <div className="flex gap-0.5 p-1 rounded-xl" style={{ background: '#F1EFE8' }}>
            <button
              onClick={() => { setPrevView('pipeline'); setView('pipeline') }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: view === 'pipeline' ? 'white' : 'transparent',
                color: view === 'pipeline' ? '#1A1A2E' : '#94A3B8',
                boxShadow: view === 'pipeline' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              }}>
              ▦ Pipeline
            </button>
            <button
              onClick={() => { setPrevView('list'); setView('list') }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: view === 'list' ? 'white' : 'transparent',
                color: view === 'list' ? '#1A1A2E' : '#94A3B8',
                boxShadow: view === 'list' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              }}>
              ☰ List
            </button>
          </div>
          <button onClick={newLoad}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: '#F0A500', boxShadow: '0 4px 16px rgba(240,165,0,0.3)' }}>
            + New Load
          </button>
        </div>
      </div>

      {/* ── PIPELINE VIEW ─────────────────────────────────────────────────── */}
      {view==='pipeline'&&(
        pageLoading?(
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
              style={{borderColor:'#F0A500',borderTopColor:'transparent'}}/>
          </div>
        ):(
          <div className="grid grid-cols-3 gap-5">
            {STAGES.map(stage=>{
              const sl=stageLoads(stage)
              return(
                <div key={stage.key}>
                  <div className="flex items-center justify-between mb-4 px-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{background:stage.color}}/>
                      <span className="text-sm font-bold" style={{color:'#1A1A2E'}}>{stage.label}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{background:stage.bg,color:stage.color}}>{sl.length}</span>
                    </div>
                    <span className="text-xs font-semibold" style={{color:stage.color}}>
                      ${sl.reduce((s,l)=>s+(l.freight_rate||0),0).toLocaleString()}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {sl.length===0?(
                      <div className="rounded-2xl p-6 text-center border-2 border-dashed"
                        style={{borderColor:stage.border,background:stage.bg}}>
                        <div className="text-sm" style={{color:stage.color,opacity:0.5}}>
                          No {stage.label.toLowerCase()} loads
                        </div>
                      </div>
                    ):sl.map((l:any)=>{
                      const ds=docStatus[l.id]
                      const isM=moving===l.id
                      return(
                        <div key={l.id} className="bg-white rounded-2xl p-4 transition-all hover:shadow-md"
                          style={{boxShadow:'0 1px 6px rgba(0,0,0,0.06)',border:`1px solid ${stage.border}`}}>
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <div className="text-sm font-bold" style={{color:'#1A1A2E'}}>#{l.load_number}</div>
                              <div className="text-xs" style={{color:'#94A3B8'}}>{l.broker_load_id||''}</div>
                            </div>
                            <span className="text-sm font-bold" style={{color:stage.color}}>
                              ${l.freight_rate?.toLocaleString()}
                            </span>
                          </div>
                          <div className="text-sm font-medium mb-1" style={{color:'#1A1A2E'}}>{l.broker_name||'—'}</div>
                          <div className="text-xs mb-1" style={{color:'#64748B'}}>
                            📍 {l.pickup_city&&l.pickup_state?`${l.pickup_city}, ${l.pickup_state}`:'—'}
                            {' → '}
                            🏁 {l.delivery_city&&l.delivery_state?`${l.delivery_city}, ${l.delivery_state}`:'—'}
                          </div>
                          <div className="flex gap-3 text-xs mb-1" style={{color:'#94A3B8'}}>
                            <span>📅 {fmtDate(l.pickup_date)}</span>
                            {l.delivery_date&&<span>→ {fmtDate(l.delivery_date)}</span>}
                          </div>
                          {(l.driver_name||l.truck_number)&&(
                            <div className="text-xs mb-2" style={{color:'#64748B'}}>
                              👤 {l.driver_name||'—'} · 🚛 {l.truck_number||'—'}
                            </div>
                          )}
                          <div className="flex gap-1.5 mb-3">
                            <DocBadge has={ds?.rc===true} label="RC"/>
                            <DocBadge has={ds?.bol===true} label="BOL"/>
                            <DocBadge has={ds?.pod===true} label="POD"/>
                          </div>
                          <div className="flex gap-2">
                            {stage.next&&(
                              <button onClick={()=>moveToNext(l,stage.next!)} disabled={isM}
                                className="flex-1 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                                style={{background:stage.next==='Delivered'?'#10B981':'#1A1A2E'}}>
                                {isM?'...':`→ ${stage.nextLabel}`}
                              </button>
                            )}
                            <button onClick={()=>openEdit(l)}
                              className="py-2 px-3 rounded-lg text-xs font-medium"
                              style={{background:'#F1EFE8',color:'#64748B'}}
                              disabled={l.is_locked}>Edit</button>
                            <button onClick={()=>openDocs(l)}
                              className="py-2 px-3 rounded-lg text-xs font-medium"
                              style={{background:'#EFF6FF',color:'#2563EB'}}>📎</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* ── LIST VIEW ─────────────────────────────────────────────────────── */}
      {view==='list'&&(
        pageLoading?(
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
              style={{borderColor:'#F0A500',borderTopColor:'transparent'}}/>
          </div>
        ):(
          <div className="bg-white rounded-2xl overflow-x-auto" style={{boxShadow:'0 1px 8px rgba(0,0,0,0.06)'}}>
            {loads.length===0?(
              <div className="p-12 text-center">
                <div className="text-4xl mb-3">📋</div>
                <div className="text-sm mb-4" style={{color:'#94A3B8'}}>No loads yet.</div>
                <button onClick={newLoad}
                  className="px-5 py-2 rounded-xl text-sm font-semibold text-white"
                  style={{background:'#F0A500'}}>+ New Load</button>
              </div>
            ):(
              <table className="w-full" style={{minWidth:'1100px'}}>
                <thead>
                  <tr style={{background:'#1A1A2E'}}>
                    {['Load #','Broker ID','Broker','Driver','Truck','Route',
                      'Pickup','Delivery','Rate','Status','RC','BOL','POD','Actions'].map(h=>(
                      <th key={h} className="text-left px-3 py-3 text-xs font-semibold whitespace-nowrap"
                        style={{color:'rgba(255,255,255,0.7)'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loads.map((l:any,i:number)=>{
                    const ds=docStatus[l.id]
                    return(
                      <tr key={l.id} className="border-b hover:bg-amber-50 transition-colors"
                        style={{borderColor:'#F1EFE8',background:i%2===0?'white':'#FAFAF9'}}>
                        <td className="px-3 py-2">
                          <div className="text-sm font-bold" style={{color:'#1A1A2E'}}>#{l.load_number}</div>
                        </td>
                        <td className="px-3 py-2 text-xs" style={{color:'#64748B'}}>{l.broker_load_id||'—'}</td>
                        <td className="px-3 py-2 text-sm" style={{color:'#1A1A2E'}}>{l.broker_name||'—'}</td>
                        <td className="px-3 py-2 text-sm" style={{color:'#64748B'}}>{l.driver_name||'—'}</td>
                        <td className="px-3 py-2 text-sm" style={{color:'#64748B'}}>{l.truck_number||'—'}</td>
                        <td className="px-3 py-2 text-xs" style={{color:'#64748B',maxWidth:'130px'}}>{l.route||'—'}</td>
                        <td className="px-3 py-2 text-xs whitespace-nowrap" style={{color:'#64748B'}}>{fmtDate(l.pickup_date)}</td>
                        <td className="px-3 py-2 text-xs whitespace-nowrap" style={{color:'#64748B'}}>{fmtDate(l.delivery_date)}</td>
                        <td className="px-3 py-2 text-sm font-semibold whitespace-nowrap" style={{color:'#F0A500'}}>
                          ${l.freight_rate?.toLocaleString()}
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap"
                            style={{background:`${STATUS_COLOR[l.status]||'#6B7280'}20`,
                              color:STATUS_COLOR[l.status]||'#6B7280'}}>
                            {l.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center text-sm">{ds?.rc?'✅':'❌'}</td>
                        <td className="px-3 py-2 text-center text-sm">{ds?.bol?'✅':'❌'}</td>
                        <td className="px-3 py-2 text-center text-sm">{ds?.pod?'✅':'—'}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            {l.status==='Dispatched'&&(
                              <button onClick={()=>moveToNext(l,'Delivered')} disabled={moving===l.id}
                                className="text-xs px-2 py-1 rounded font-medium whitespace-nowrap"
                                style={{background:'#F0FDF4',color:'#10B981',border:'1px solid #BBF7D0'}}>
                                {moving===l.id?'...':'→ Delivered'}
                              </button>
                            )}
                            {l.status==='Delivered'&&(
                              <button onClick={()=>moveToNext(l,'Paid')} disabled={moving===l.id}
                                className="text-xs px-2 py-1 rounded font-medium whitespace-nowrap"
                                style={{background:'#F8F7F4',color:'#1A1A2E',border:'1px solid #E2E8F0'}}>
                                {moving===l.id?'...':'→ Paid'}
                              </button>
                            )}
                            <button onClick={()=>openEdit(l)}
                              className="text-xs px-2 py-1 rounded font-medium"
                              style={{background:'#EFF6FF',color:'#2563EB'}}
                              disabled={l.is_locked}>Edit</button>
                            <button onClick={()=>openDocs(l)}
                              className="text-xs px-2 py-1 rounded font-medium"
                              style={{background:'#F1EFE8',color:'#64748B'}}>📎</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )
      )}

      {/* ── FORM VIEW ─────────────────────────────────────────────────────── */}
      {view==='form'&&(
        <div className="space-y-5">
          <div className="bg-white rounded-2xl p-5" style={{boxShadow:'0 1px 8px rgba(0,0,0,0.06)'}}>
            <div {...getRootProps()} className="rounded-xl p-6 text-center cursor-pointer border-2 border-dashed transition-all"
              style={{borderColor:isDragActive?'#F0A500':'#E2E8F0',background:isDragActive?'rgba(240,165,0,0.05)':'#FAFAF9'}}>
              <input{...getInputProps()}/>
              {extracting?(
                <div>
                  <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3"
                    style={{borderColor:'#F0A500',borderTopColor:'transparent'}}/>
                  <div className="text-sm font-medium mb-2" style={{color:'#1A1A2E'}}>Gemini AI reading all stops...</div>
                  {log.map((l,i)=><div key={i} className="text-xs" style={{color:'#64748B'}}>✓ {l}</div>)}
                </div>
              ):log.length>0?(
                <div>
                  <div className="text-xl mb-1">✅</div>
                  <div className="text-sm font-semibold" style={{color:'#16A34A'}}>Extraction complete — review and save</div>
                  <div className="text-xs mt-1" style={{color:'#94A3B8'}}>Drop another file to re-extract</div>
                </div>
              ):(
                <div>
                  <div className="text-3xl mb-2">🤖</div>
                  <div className="text-sm font-semibold mb-1" style={{color:'#1A1A2E'}}>
                    {isDragActive?'Drop it!':'Upload Rate Confirmation PDF'}
                  </div>
                  <div className="text-xs" style={{color:'#94A3B8'}}>Gemini AI extracts all stops and addresses automatically</div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6" style={{boxShadow:'0 1px 8px rgba(0,0,0,0.06)'}}>
            <div className="font-semibold text-sm mb-5" style={{color:'#1A1A2E'}}>Load Information</div>
            <div className="grid grid-cols-4 gap-4 mb-5">
              <div><label className={lb}>Load #</label>
                <input className={ic} style={{...is,background:'#F8F7F4',fontWeight:600}} value={form.load_number} readOnly/></div>
              <div><label className={lb}>Broker Load ID</label>
                <input className={ic} style={is} value={form.broker_load_id} onChange={e=>f('broker_load_id',e.target.value)} placeholder="e.g. 124947"/></div>
              <div><label className={lb}>Broker Name *</label>
                <input className={ic} style={is} value={form.broker_name} onChange={e=>f('broker_name',e.target.value)}/></div>
              <div><label className={lb}>Status</label>
                <select className={ic} style={is} value={form.status} onChange={e=>f('status',e.target.value)}>
                  <option value="Dispatched">Dispatched</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Paid">Paid</option>
                </select></div>
              <div><label className={lb}>Shipper Name</label>
                <input className={ic} style={is} value={form.shipper_name} onChange={e=>f('shipper_name',e.target.value)}/></div>
              <div><label className={lb}>Carrier Name</label>
                <input className={ic} style={is} value={form.carrier_name} onChange={e=>f('carrier_name',e.target.value)}/></div>
              <div><label className={lb}>Commodity</label>
                <input className={ic} style={is} value={form.commodity} onChange={e=>f('commodity',e.target.value)}/></div>
              <div><label className={lb}>Freight Rate ($) *</label>
                <input type="number" className={ic} style={{...is,fontWeight:600}} value={form.freight_rate} onChange={e=>f('freight_rate',e.target.value)}/></div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div><label className={lb}>Driver</label>
                <select className={ic} style={is} value={form.driver_id||''}
                  onChange={e=>{const d=drivers.find((x:any)=>x.id===Number(e.target.value));f('driver_id',e.target.value?Number(e.target.value):null);if(d)f('driver_name',d.name)}}>
                  <option value="">— Select —</option>
                  {drivers.map((d:any)=><option key={d.id} value={d.id}>{d.name} ({d.pay_rate_pct})</option>)}
                </select></div>
              <div><label className={lb}>Truck</label>
                <select className={ic} style={is} value={form.truck_id||''}
                  onChange={e=>{const t=trucks.find((x:any)=>x.id===Number(e.target.value));f('truck_id',e.target.value?Number(e.target.value):null);if(t)f('truck_number',t.unit_number)}}>
                  <option value="">— Select —</option>
                  {trucks.map((t:any)=><option key={t.id} value={t.id}>{t.unit_number}</option>)}
                </select></div>
              <div><label className={lb}>Trailer #</label>
                <input className={ic} style={is} value={form.trailer_number} onChange={e=>f('trailer_number',e.target.value)}/></div>
              <div><label className={lb}>Weight (lbs)</label>
                <input type="number" className={ic} style={is} value={form.weight_lbs} onChange={e=>f('weight_lbs',e.target.value)}/></div>
              <div><label className={lb}>Loaded Miles</label>
                <input type="number" className={ic} style={is} value={form.loaded_miles} onChange={e=>f('loaded_miles',e.target.value)}/></div>
              <div><label className={lb}>Empty Miles</label>
                <input type="number" className={ic} style={is} value={form.empty_miles} onChange={e=>f('empty_miles',e.target.value)}/></div>
              <div><label className={lb}>TONU Amount ($)</label>
                <input type="number" className={ic} style={is} value={form.tonu_amount} onChange={e=>f('tonu_amount',e.target.value)}/></div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6" style={{boxShadow:'0 1px 8px rgba(0,0,0,0.06)'}}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="font-semibold text-sm" style={{color:'#1A1A2E'}}>Stops ({form.stops.length})</div>
                <div className="text-xs mt-0.5" style={{color:'#94A3B8'}}>All pickups and deliveries</div>
              </div>
              <div className="flex gap-2">
                <button onClick={()=>addStop('Pickup')} className="px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{background:'#FEF9EE',color:'#D97706',border:'1px solid #FDE68A'}}>+ Pickup</button>
                <button onClick={()=>addStop('Delivery')} className="px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{background:'#F0FDF4',color:'#16A34A',border:'1px solid #BBF7D0'}}>+ Delivery</button>
              </div>
            </div>
            <div className="space-y-4">
              {form.stops.map((stop:Stop,idx:number)=>(
                <div key={idx} className="rounded-xl p-4"
                  style={{background:stop.action==='Pickup'?'#FFFBEB':'#F0FDF4',
                    border:`1px solid ${stop.action==='Pickup'?'#FDE68A':'#BBF7D0'}`}}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold"
                        style={{color:stop.action==='Pickup'?'#D97706':'#16A34A'}}>
                        {stop.action==='Pickup'?'📍':'🏁'} {stop.action} {stop.stop_number}
                      </span>
                      <select value={stop.action} onChange={e=>upStop(idx,'action',e.target.value)}
                        className="text-xs px-2 py-1 rounded-lg border outline-none"
                        style={{borderColor:'#E2E8F0',background:'white'}}>
                        <option>Pickup</option><option>Delivery</option>
                      </select>
                    </div>
                    {form.stops.length>2&&(
                      <button onClick={()=>remStop(idx)} className="text-xs px-2 py-1 rounded-lg"
                        style={{background:'#FEE2E2',color:'#DC2626'}}>Remove</button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div><label className={lb}>Company / Facility Name</label>
                      <input className={ic} style={is} value={stop.company_name}
                        onChange={e=>upStop(idx,'company_name',e.target.value)} placeholder="e.g. Dallas RPDC"/></div>
                    <div><label className={lb}>Street Address</label>
                      <input className={ic} style={is} value={stop.street}
                        onChange={e=>upStop(idx,'street',e.target.value)}/></div>
                  </div>
                  <div className="grid grid-cols-6 gap-3 mb-3">
                    <div className="col-span-2"><label className={lb}>City</label>
                      <input className={ic} style={is} value={stop.city} onChange={e=>upStop(idx,'city',e.target.value)}/></div>
                    <div><label className={lb}>State</label>
                      <input className={ic} style={is} value={stop.state} maxLength={2}
                        onChange={e=>upStop(idx,'state',e.target.value)} placeholder="TX"/></div>
                    <div><label className={lb}>ZIP</label>
                      <input className={ic} style={is} value={stop.zip} maxLength={5}
                        onChange={e=>upStop(idx,'zip',e.target.value)}/></div>
                    <div><label className={lb}>Date</label>
                      <input type="date" className={ic} style={is} value={stop.date}
                        onChange={e=>upStop(idx,'date',e.target.value)}/></div>
                    <div><label className={lb}>Appt</label>
                      <input className={ic} style={is} value={stop.time}
                        onChange={e=>upStop(idx,'time',e.target.value)} placeholder="05:30"/></div>
                  </div>
                  <div><label className={lb}>Driver Instructions</label>
                    <input className={ic} style={is} value={stop.notes}
                      onChange={e=>upStop(idx,'notes',e.target.value)}
                      placeholder="e.g. Chock wheels, check in for Route FA2A4"/></div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5" style={{boxShadow:'0 1px 8px rgba(0,0,0,0.06)'}}>
            <div className="mb-4"><label className={lb}>General Notes</label>
              <textarea rows={2} className={ic} style={is} value={form.notes}
                onChange={e=>f('notes',e.target.value)} placeholder="Additional notes..."/></div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.tonu} onChange={e=>f('tonu',e.target.checked)}
                  style={{accentColor:'#F0A500'}}/>
                <span className="text-sm" style={{color:'#64748B'}}>TONU</span>
              </label>
              <div className="flex gap-3">
                {editId&&(
                  <button onClick={goBack}
                    className="px-5 py-2.5 rounded-xl text-sm border"
                    style={{borderColor:'#E2E8F0',color:'#64748B'}}>Cancel</button>
                )}
                <button onClick={save} disabled={saving}
                  className="px-8 py-2.5 rounded-xl text-sm font-semibold text-white"
                  style={{background:saving?'#C47E00':'#F0A500',boxShadow:'0 4px 16px rgba(240,165,0,0.3)'}}>
                  {saving?'Saving...':editId?'Update Load':'✓ Save Load'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Documents Modal */}
      {selLoad&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{background:'rgba(0,0,0,0.5)'}} onClick={()=>setSelLoad(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-screen overflow-y-auto"
            onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between mb-5">
              <h3 className="font-bold" style={{color:'#1A1A2E'}}>
                Documents — Load #{selLoad.load_number}
              </h3>
              <button onClick={()=>setSelLoad(null)} style={{color:'#94A3B8'}}>✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-5">
              {['Rate Confirmation','Bill of Lading','Proof of Delivery','Invoice','Other'].map(dt=>(
                <label key={dt} className="flex flex-col items-center gap-2 p-4 rounded-xl border cursor-pointer hover:border-amber-400 transition-colors"
                  style={{borderColor:'#E2E8F0',borderStyle:'dashed'}}>
                  <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg"
                    onChange={async e=>{
                      if(!e.target.files?.[0])return
                      try{
                        await loadsApi.uploadDoc(selLoad.id,e.target.files[0],dt)
                        const r=await loadsApi.getDocs(selLoad.id);setDocs(r.data)
                        const ds=await loadsApi.docStatus(selLoad.id)
                        setDocStatus(p=>({...p,[selLoad.id]:ds.data}))
                        toast.success(`${dt} uploaded`)
                      }catch(e:any){toast.error(e.response?.data?.detail||'Upload failed')}
                    }}/>
                  <span className="text-2xl">
                    {dt==='Rate Confirmation'?'📋':dt==='Bill of Lading'?'📄':dt==='Proof of Delivery'?'✅':dt==='Invoice'?'💰':'📎'}
                  </span>
                  <span className="text-xs font-medium text-center" style={{color:'#64748B'}}>{dt}</span>
                  <span className="text-xs" style={{color:'#94A3B8'}}>Click to upload</span>
                </label>
              ))}
            </div>
            {docs.length>0&&(
              <div className="space-y-2">
                {docs.map((d:any)=>(
                  <div key={d.id} className="flex items-center justify-between p-3 rounded-xl"
                    style={{background:'#F8F7F4'}}>
                    <div>
                      <div className="text-sm font-medium" style={{color:'#1A1A2E'}}>{d.doc_type}</div>
                      <div className="text-xs" style={{color:'#94A3B8'}}>{d.original_filename}</div>
                    </div>
                    <button onClick={async()=>{
                      const r=await loadsApi.getDocUrl(selLoad.id,d.id)
                      window.open(r.data.url,'_blank')
                    }} className="text-xs px-3 py-1.5 rounded-lg"
                      style={{background:'#EFF6FF',color:'#2563EB'}}>View</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
