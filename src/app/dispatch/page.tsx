'use client'
import { useEffect, useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { loadsApi, driversApi, trucksApi } from '@/lib/api'
import toast from 'react-hot-toast'

const fmtDate = (d: string | null | undefined): string => {
  if (!d) return '—'
  try { const [y,m,day] = d.slice(0,10).split('-'); return `${m}/${day}/${y}` }
  catch { return d }
}

interface Stop {
  stop_number: number; action: 'Pickup' | 'Delivery'
  company_name: string; street: string; city: string
  state: string; zip: string; date: string; time: string; notes: string
}

const mkStop = (n: number, a: 'Pickup' | 'Delivery'): Stop => ({
  stop_number: n, action: a, company_name: '', street: '',
  city: '', state: '', zip: '', date: '', time: '', notes: ''
})

const EMPTY_FORM = {
  load_number: '', broker_load_id: '', broker_name: '', shipper_name: '',
  carrier_name: '', driver_id: null as number | null, driver_name: '',
  truck_id: null as number | null, truck_number: '', trailer_number: '',
  commodity: '', weight_lbs: '', loaded_miles: '', empty_miles: '',
  freight_rate: '', status: 'Dispatched', tonu: false, tonu_amount: '',
  notes: '', source_file: '',
  stops: [mkStop(1, 'Pickup'), mkStop(2, 'Delivery')] as Stop[],
}

const STATUS_TABS = [
  { key: 'Dispatched', color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE', next: 'Delivered', nextLabel: '→ Mark Delivered', nextBg: '#10B981' },
  { key: 'Delivered',  color: '#10B981', bg: '#F0FDF4', border: '#BBF7D0', next: 'Paid',      nextLabel: '→ Mark Paid',      nextBg: '#1A1A2E' },
  { key: 'Paid',       color: '#6B7280', bg: '#F8F7F4', border: '#E2E8F0', next: null,        nextLabel: null,               nextBg: null },
]

const DOC_TYPES = ['Rate Confirmation', 'Bill of Lading', 'Proof of Delivery', 'Invoice', 'Other']

export default function DispatchPage() {
  // Main view: 'list' | 'new' | 'edit'
  const [view, setView]           = useState<'list' | 'new' | 'edit'>('list')
  const [statusTab, setStatusTab] = useState<'Dispatched' | 'Delivered' | 'Paid'>('Dispatched')
  const [loads, setLoads]         = useState<any[]>([])
  const [docStatus, setDocStatus] = useState<Record<number, any>>({})
  const [drivers, setDrivers]     = useState<any[]>([])
  const [trucks, setTrucks]       = useState<any[]>([])
  const [form, setForm]           = useState<any>({ ...EMPTY_FORM })
  const [editId, setEditId]       = useState<number | null>(null)
  const [saving, setSaving]       = useState(false)
  const [extracting, setExtr]     = useState(false)
  const [log, setLog]             = useState<string[]>([])
  const [listLoading, setLL]      = useState(true)
  const [moving, setMoving]       = useState<number | null>(null)
  const [selLoad, setSelLoad]     = useState<any>(null)
  const [docs, setDocs]           = useState<any[]>([])

  const f = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }))

  const upStop = (idx: number, key: keyof Stop, val: string) =>
    setForm((p: any) => {
      const s = [...p.stops]
      s[idx] = { ...s[idx], [key]: key === 'state' ? val.toUpperCase() : val }
      return { ...p, stops: s }
    })

  const addStop = (a: 'Pickup' | 'Delivery') =>
    setForm((p: any) => ({ ...p, stops: [...p.stops, mkStop(p.stops.length + 1, a)] }))

  const remStop = (idx: number) =>
    setForm((p: any) => ({
      ...p,
      stops: p.stops
        .filter((_: any, i: number) => i !== idx)
        .map((s: Stop, i: number) => ({ ...s, stop_number: i + 1 }))
    }))

  useEffect(() => {
    Promise.all([driversApi.list(), trucksApi.list()])
      .then(([d, t]) => { setDrivers(d.data); setTrucks(t.data) })
      .catch(() => {})
  }, [])

  const refreshLoads = useCallback(async () => {
    setLL(true)
    try {
      const l = await loadsApi.list({})
      setLoads(l.data)
      const st: Record<number, any> = {}
      await Promise.all(l.data.map(async (load: any) => {
        try { const r = await loadsApi.docStatus(load.id); st[load.id] = r.data } catch {}
      }))
      setDocStatus(st)
    } catch {} finally { setLL(false) }
  }, [])

  useEffect(() => { refreshLoads() }, [refreshLoads])

  // ── New Load ────────────────────────────────────────────────────────────────
  const openNewLoad = async () => {
    try {
      const r = await loadsApi.nextNumber()
      setForm({ ...EMPTY_FORM, load_number: r.data.load_number })
    } catch {
      setForm({ ...EMPTY_FORM })
    }
    setEditId(null); setLog([]); setView('new')
  }

  // ── Edit Load ───────────────────────────────────────────────────────────────
  const openEdit = (l: any) => {
    const stops: Stop[] = [
      {
        stop_number: 1, action: 'Pickup',
        company_name: l.pickup_company || '', street: l.pickup_street || '',
        city: l.pickup_city || '', state: l.pickup_state || '',
        zip: l.pickup_zip || '', date: l.pickup_date || '',
        time: l.pickup_appt || '', notes: '',
      },
      {
        stop_number: 2, action: 'Delivery',
        company_name: l.delivery_company || '', street: l.delivery_street || '',
        city: l.delivery_city || '', state: l.delivery_state || '',
        zip: l.delivery_zip || '', date: l.delivery_date || '',
        time: l.delivery_appt || '', notes: '',
      },
    ]
    setForm({
      ...l, stops,
      weight_lbs: l.weight_lbs || '', loaded_miles: l.loaded_miles || '',
      empty_miles: l.empty_miles || '', freight_rate: l.freight_rate || '',
      tonu_amount: l.tonu_amount || '',
    })
    setEditId(l.id); setLog([]); setView('edit')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Move status ─────────────────────────────────────────────────────────────
  const moveToNext = async (load: any, nextStatus: string) => {
    setMoving(load.id)
    try {
      await loadsApi.updateStatus(load.id, nextStatus)
      setLoads(p => p.map(l => l.id === load.id ? { ...l, status: nextStatus } : l))
      toast.success(`Load #${load.load_number} → ${nextStatus}`)
      // Auto-switch tab to show where it went
      setStatusTab(nextStatus as any)
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed to update status')
    } finally { setMoving(null) }
  }

  // ── AI Extraction ───────────────────────────────────────────────────────────
  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0]; if (!file) return
    setExtr(true); setLog(['Uploading to Gemini AI...'])
    try {
      const res = await loadsApi.extract(file)
      const { form_data, extracted, status_log } = res.data
      setLog(status_log || ['Done'])

      // DEBUG: Open F12 → Console to see what AI returned
      console.log('RAW extracted (snake_case):', extracted)
      console.log('MAPPED form_data (PascalCase):', form_data)

      const rawStops: Stop[] = (form_data.Stops || []).map((s: any, i: number) => ({
        stop_number: s.stop_number || i + 1,
        action: s.action === 'Delivery' ? 'Delivery' : 'Pickup',
        company_name: s.company_name || '', street: s.street || '',
        city: s.city || '', state: s.state || '',
        zip: s.zip || '', date: s.date || '',
        time: s.time || '', notes: s.notes || '',
      }))
      const stops: Stop[] = rawStops.length > 0 ? rawStops : [
        {
          stop_number: 1, action: 'Pickup',
          company_name: form_data.Origin_Company || form_data.Shipper_Name || '',
          street: form_data.Origin_Street || '', city: form_data.Origin_City || '',
          state: form_data.Origin_State || '', zip: form_data.Origin_ZIP || '',
          date: form_data.Load_Date || '', time: '', notes: '',
        },
        {
          stop_number: 2, action: 'Delivery',
          company_name: form_data.Destination_Company || '',
          street: form_data.Destination_Street || '', city: form_data.Destination_City || '',
          state: form_data.Destination_State || '', zip: form_data.Destination_ZIP || '',
          date: form_data.Delivery_Date || '', time: '', notes: '',
        },
      ]
      const fd = form_data  || {}
      const ex = extracted  || {}
      const pick = (fk: string, ek: string) => fd[fk] ?? ex[ek] ?? ''

      setForm((prev: any) => ({
        ...prev,
        broker_load_id: pick('Broker_Load_ID','broker_load_id') || prev.broker_load_id,
        broker_name:    pick('Broker_Name',   'broker_name')    || prev.broker_name,
        shipper_name:   pick('Shipper_Name',  'shipper_name')   || prev.shipper_name,
        carrier_name:   pick('Carrier_Name',  'carrier_name')   || prev.carrier_name,
        driver_name:    pick('Driver_Name',   'driver_name')    || prev.driver_name,
        truck_number:   pick('Truck_Number',  'truck_number')   || prev.truck_number,
        trailer_number: pick('Trailer_Number','trailer_number') || prev.trailer_number,
        commodity:      pick('Commodity',     'commodity')      || prev.commodity,
        weight_lbs:     pick('Weight_LBS',    'weight_lbs')     || prev.weight_lbs,
        loaded_miles:   pick('Miles',         'miles')          || prev.loaded_miles,
        freight_rate:   pick('Rate_USD',      'rate_usd')       || prev.freight_rate,
        source_file: file.name, stops,
      }))

      const filledFields = Object.keys(fd).length
      toast.success(filledFields > 0
        ? `✅ ${filledFields} fields extracted, ${stops.length} stop(s)`
        : '⚠️ AI returned no data — check browser console (F12)'
      )
    } catch {
      toast.error('Extraction failed — fill manually')
      setLog(['Failed'])
    } finally { setExtr(false) }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'image/*': ['.png', '.jpg', '.jpeg'] },
    multiple: false,
  })

  // ── Save ────────────────────────────────────────────────────────────────────
  const save = async () => {
    if (!form.broker_name) { toast.error('Broker name required'); return }
    if (!form.freight_rate) { toast.error('Freight rate required'); return }
    setSaving(true)
    try {
      const fp = form.stops.find((s: Stop) => s.action === 'Pickup')
      const ld = [...form.stops].reverse().find((s: Stop) => s.action === 'Delivery')
      const payload = {
        load_number: form.load_number, broker_load_id: form.broker_load_id,
        broker_name: form.broker_name,
        shipper_name: form.shipper_name || fp?.company_name || '',
        carrier_name: form.carrier_name,
        driver_id: form.driver_id ? Number(form.driver_id) : null,
        driver_name: form.driver_name,
        truck_id: form.truck_id ? Number(form.truck_id) : null,
        truck_number: form.truck_number, trailer_number: form.trailer_number,
        pickup_date: fp?.date || '', pickup_appt: fp?.time || '',
        pickup_company: fp?.company_name || '', pickup_street: fp?.street || '',
        pickup_city: fp?.city || '',
        pickup_state: (fp?.state || '').toUpperCase(),
        pickup_zip: fp?.zip || '',
        delivery_date: ld?.date || '', delivery_appt: ld?.time || '',
        delivery_company: ld?.company_name || '', delivery_street: ld?.street || '',
        delivery_city: ld?.city || '',
        delivery_state: (ld?.state || '').toUpperCase(),
        delivery_zip: ld?.zip || '',
        commodity: form.commodity,
        weight_lbs:   form.weight_lbs   ? Number(form.weight_lbs)   : null,
        loaded_miles: form.loaded_miles ? Number(form.loaded_miles) : null,
        empty_miles:  form.empty_miles  ? Number(form.empty_miles)  : null,
        freight_rate: Number(form.freight_rate) || 0,
        tonu: form.tonu, tonu_amount: Number(form.tonu_amount) || 0,
        status: form.status, source_file: form.source_file,
        notes: form.stops.length > 2
          ? `[MULTI-STOP]\n${form.stops.map((s: Stop) =>
              `${s.action} ${s.stop_number}: ${s.company_name} | ${s.street}, ${s.city}, ${s.state} ${s.zip} @ ${s.date} ${s.time}`
            ).join('\n')}\n\n${form.notes}`
          : form.notes,
      }
      if (editId) {
        await loadsApi.update(editId, payload)
        toast.success('Load updated')
      } else {
        await loadsApi.create(payload)
        toast.success('Load saved!')
      }
      setEditId(null); setLog([])
      await refreshLoads()
      setView('list')
      setStatusTab(form.status as any)
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed to save')
    } finally { setSaving(false) }
  }

  // ── Open docs ───────────────────────────────────────────────────────────────
  const openDocs = async (l: any) => {
    setSelLoad(l)
    const r = await loadsApi.getDocs(l.id)
    setDocs(r.data)
  }

  // ── Styles ──────────────────────────────────────────────────────────────────
  const ic = "w-full px-3 py-2 rounded-lg text-sm border outline-none transition-all"
  const is = { borderColor: '#E2E8F0', background: '#FAFAF9' }
  const lb = "block text-xs font-medium mb-1 text-slate-500"

  const tabLoads = loads.filter(l => l.status === statusTab)
  const currentStage = STATUS_TABS.find(s => s.key === statusTab)!

  const isFormView = view === 'new' || view === 'edit'

  return (
    <div className="animate-fade-in">

      {/* ── TOP NAV ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold"
          style={{ color: '#1A1A2E', fontFamily: 'Playfair Display,serif' }}>
          Dispatch
        </h1>

        <div className="flex items-center gap-2">
          {/* 1. New Load */}
          <button
            onClick={openNewLoad}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: view === 'new' ? '#F0A500' : 'white',
              color: view === 'new' ? 'white' : '#64748B',
              border: '1px solid #E2E8F0',
              boxShadow: view === 'new' ? '0 4px 16px rgba(240,165,0,0.3)' : '0 1px 4px rgba(0,0,0,0.06)',
            }}>
            + New Load
          </button>

          {/* 2. Load List */}
          <button
            onClick={() => { setView('list'); refreshLoads() }}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: view === 'list' ? '#1A1A2E' : 'white',
              color: view === 'list' ? 'white' : '#64748B',
              border: '1px solid #E2E8F0',
              boxShadow: view === 'list' ? '0 4px 16px rgba(26,26,46,0.2)' : '0 1px 4px rgba(0,0,0,0.06)',
            }}>
            ☰ Load List
          </button>

          {/* 3. Edit Load — only active when editing */}
          <button
            disabled={view !== 'edit'}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: view === 'edit' ? '#8B5CF6' : 'white',
              color: view === 'edit' ? 'white' : '#C4B5FD',
              border: `1px solid ${view === 'edit' ? '#8B5CF6' : '#E2E8F0'}`,
              boxShadow: view === 'edit' ? '0 4px 16px rgba(139,92,246,0.3)' : '0 1px 4px rgba(0,0,0,0.06)',
              cursor: view === 'edit' ? 'default' : 'not-allowed',
            }}>
            ✏ Edit Load {view === 'edit' && editId ? `#${form.load_number}` : ''}
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* LOAD LIST VIEW                                                      */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {view === 'list' && (
        <div>
          {/* Status sub-tabs */}
          <div className="flex gap-2 mb-5">
            {STATUS_TABS.map(st => {
              const count = loads.filter(l => l.status === st.key).length
              const total = loads.filter(l => l.status === st.key).reduce((s, l) => s + (l.freight_rate || 0), 0)
              return (
                <button key={st.key}
                  onClick={() => setStatusTab(st.key as any)}
                  className="flex items-center gap-3 px-5 py-3 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: statusTab === st.key ? st.color : 'white',
                    color: statusTab === st.key ? 'white' : '#64748B',
                    border: `1px solid ${statusTab === st.key ? st.color : '#E2E8F0'}`,
                    boxShadow: statusTab === st.key ? `0 4px 12px ${st.color}40` : '0 1px 4px rgba(0,0,0,0.06)',
                  }}>
                  <span>{st.key}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                    style={{
                      background: statusTab === st.key ? 'rgba(255,255,255,0.25)' : st.bg,
                      color: statusTab === st.key ? 'white' : st.color,
                    }}>
                    {count}
                  </span>
                  {count > 0 && (
                    <span className="text-xs opacity-80">${total.toLocaleString()}</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Table */}
          {listLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: '#F0A500', borderTopColor: 'transparent' }} />
            </div>
          ) : tabLoads.length === 0 ? (
            <div className="bg-white rounded-2xl p-14 text-center"
              style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)', border: `2px dashed ${currentStage.border}` }}>
              <div className="text-5xl mb-4">📋</div>
              <div className="text-base font-semibold mb-1" style={{ color: '#1A1A2E' }}>
                No {statusTab.toLowerCase()} loads
              </div>
              <div className="text-sm mb-5" style={{ color: '#94A3B8' }}>
                {statusTab === 'Dispatched'
                  ? 'Create a new load and it will appear here.'
                  : statusTab === 'Delivered'
                  ? 'Mark dispatched loads as delivered and they will appear here.'
                  : 'Mark delivered loads as paid and they will appear here.'}
              </div>
              {statusTab === 'Dispatched' && (
                <button onClick={openNewLoad}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
                  style={{ background: '#F0A500' }}>
                  + New Load
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl overflow-hidden"
              style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)', border: `1px solid ${currentStage.border}` }}>
              <table className="w-full">
                <thead>
                  <tr style={{ background: currentStage.color }}>
                    {['Load #', 'Broker ID', 'Broker', 'Driver', 'Truck', 'Route',
                      'Pickup', 'Delivery', 'Rate', 'RC', 'BOL', 'POD', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold whitespace-nowrap"
                        style={{ color: 'rgba(255,255,255,0.85)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tabLoads.map((l: any, i: number) => {
                    const ds = docStatus[l.id]
                    const isMoving = moving === l.id
                    return (
                      <tr key={l.id}
                        className="border-b transition-colors hover:bg-amber-50"
                        style={{ borderColor: currentStage.border, background: i % 2 === 0 ? 'white' : currentStage.bg }}>
                        <td className="px-4 py-3">
                          <div className="text-sm font-bold" style={{ color: '#1A1A2E' }}>#{l.load_number}</div>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#94A3B8' }}>{l.broker_load_id || '—'}</td>
                        <td className="px-4 py-3 text-sm font-medium" style={{ color: '#1A1A2E' }}>{l.broker_name || '—'}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: '#64748B' }}>{l.driver_name || '—'}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: '#64748B' }}>{l.truck_number || '—'}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#64748B' }}>{l.route || '—'}</td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#64748B' }}>{fmtDate(l.pickup_date)}</td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#64748B' }}>{fmtDate(l.delivery_date)}</td>
                        <td className="px-4 py-3 text-sm font-bold whitespace-nowrap" style={{ color: currentStage.color }}>
                          ${l.freight_rate?.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center text-sm">{ds?.rc ? '✅' : '❌'}</td>
                        <td className="px-4 py-3 text-center text-sm">{ds?.bol ? '✅' : '❌'}</td>
                        <td className="px-4 py-3 text-center text-sm">{ds?.pod ? '✅' : '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {/* Move to next status */}
                            {currentStage.next && (
                              <button
                                onClick={() => moveToNext(l, currentStage.next!)}
                                disabled={isMoving}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white whitespace-nowrap disabled:opacity-50"
                                style={{ background: currentStage.nextBg! }}>
                                {isMoving ? '...' : currentStage.nextLabel}
                              </button>
                            )}
                            {/* Edit */}
                            <button onClick={() => openEdit(l)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                              style={{ background: '#EDE9FE', color: '#7C3AED' }}
                              disabled={l.is_locked}>
                              ✏ Edit
                            </button>
                            {/* Docs */}
                            <button onClick={() => openDocs(l)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                              style={{ background: '#EFF6FF', color: '#2563EB' }}>
                              📎 Docs
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* NEW LOAD / EDIT LOAD FORM                                          */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {isFormView && (
        <div className="space-y-5">

          {/* AI Upload */}
          <div className="bg-white rounded-2xl p-5"
            style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <div {...getRootProps()}
              className="rounded-xl p-8 text-center cursor-pointer border-2 border-dashed transition-all"
              style={{
                borderColor: isDragActive ? '#F0A500' : '#E2E8F0',
                background: isDragActive ? 'rgba(240,165,0,0.04)' : '#FAFAF9',
              }}>
              <input {...getInputProps()} />
              {extracting ? (
                <div>
                  <div className="w-9 h-9 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4"
                    style={{ borderColor: '#F0A500', borderTopColor: 'transparent' }} />
                  <div className="text-sm font-semibold mb-2" style={{ color: '#1A1A2E' }}>
                    Gemini AI reading all stops and addresses...
                  </div>
                  {log.map((l, i) => (
                    <div key={i} className="text-xs mt-0.5" style={{ color: '#64748B' }}>✓ {l}</div>
                  ))}
                </div>
              ) : log.length > 0 ? (
                <div>
                  <div className="text-3xl mb-2">✅</div>
                  <div className="text-sm font-semibold" style={{ color: '#16A34A' }}>
                    Extraction complete — review the fields below
                  </div>
                  <div className="text-xs mt-1" style={{ color: '#94A3B8' }}>
                    Drop another file to re-extract
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-4xl mb-3">🤖</div>
                  <div className="text-sm font-semibold mb-1" style={{ color: '#1A1A2E' }}>
                    {isDragActive ? 'Drop it here!' : 'Upload Rate Confirmation PDF'}
                  </div>
                  <div className="text-xs" style={{ color: '#94A3B8' }}>
                    Drag & drop — Gemini AI fills all stops and addresses automatically
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Load Information */}
          <div className="bg-white rounded-2xl p-6"
            style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <div className="text-sm font-bold mb-5" style={{ color: '#1A1A2E' }}>Load Information</div>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div>
                <label className={lb}>Load #</label>
                <input className={ic}
                  style={{ ...is, background: '#F8F7F4', fontWeight: 600 }}
                  value={form.load_number} readOnly />
              </div>
              <div>
                <label className={lb}>Broker Load ID</label>
                <input className={ic} style={is}
                  value={form.broker_load_id}
                  onChange={e => f('broker_load_id', e.target.value)}
                  placeholder="e.g. 124947" />
              </div>
              <div>
                <label className={lb}>Broker Name *</label>
                <input className={ic} style={is}
                  value={form.broker_name}
                  onChange={e => f('broker_name', e.target.value)} />
              </div>
              <div>
                <label className={lb}>Status</label>
                <select className={ic} style={is}
                  value={form.status} onChange={e => f('status', e.target.value)}>
                  <option value="Dispatched">Dispatched</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Paid">Paid</option>
                </select>
              </div>
              <div>
                <label className={lb}>Shipper Name</label>
                <input className={ic} style={is}
                  value={form.shipper_name}
                  onChange={e => f('shipper_name', e.target.value)} />
              </div>
              <div>
                <label className={lb}>Carrier Name</label>
                <input className={ic} style={is}
                  value={form.carrier_name}
                  onChange={e => f('carrier_name', e.target.value)} />
              </div>
              <div>
                <label className={lb}>Commodity</label>
                <input className={ic} style={is}
                  value={form.commodity}
                  onChange={e => f('commodity', e.target.value)} />
              </div>
              <div>
                <label className={lb}>Freight Rate ($) *</label>
                <input type="number" className={ic}
                  style={{ ...is, fontWeight: 600 }}
                  value={form.freight_rate}
                  onChange={e => f('freight_rate', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className={lb}>Driver</label>
                <select className={ic} style={is}
                  value={form.driver_id || ''}
                  onChange={e => {
                    const d = drivers.find((x: any) => x.id === Number(e.target.value))
                    f('driver_id', e.target.value ? Number(e.target.value) : null)
                    if (d) f('driver_name', d.name)
                  }}>
                  <option value="">— Select —</option>
                  {drivers.map((d: any) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.pay_rate_pct})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lb}>Truck</label>
                <select className={ic} style={is}
                  value={form.truck_id || ''}
                  onChange={e => {
                    const t = trucks.find((x: any) => x.id === Number(e.target.value))
                    f('truck_id', e.target.value ? Number(e.target.value) : null)
                    if (t) f('truck_number', t.unit_number)
                  }}>
                  <option value="">— Select —</option>
                  {trucks.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.unit_number}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lb}>Trailer #</label>
                <input className={ic} style={is}
                  value={form.trailer_number}
                  onChange={e => f('trailer_number', e.target.value)} />
              </div>
              <div>
                <label className={lb}>Weight (lbs)</label>
                <input type="number" className={ic} style={is}
                  value={form.weight_lbs}
                  onChange={e => f('weight_lbs', e.target.value)} />
              </div>
              <div>
                <label className={lb}>Loaded Miles</label>
                <input type="number" className={ic} style={is}
                  value={form.loaded_miles}
                  onChange={e => f('loaded_miles', e.target.value)} />
              </div>
              <div>
                <label className={lb}>Empty Miles</label>
                <input type="number" className={ic} style={is}
                  value={form.empty_miles}
                  onChange={e => f('empty_miles', e.target.value)} />
              </div>
              <div>
                <label className={lb}>TONU Amount ($)</label>
                <input type="number" className={ic} style={is}
                  value={form.tonu_amount}
                  onChange={e => f('tonu_amount', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Stops */}
          <div className="bg-white rounded-2xl p-6"
            style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="text-sm font-bold" style={{ color: '#1A1A2E' }}>
                  Stops ({form.stops.length})
                </div>
                <div className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                  All pickups and deliveries from the rate confirmation
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => addStop('Pickup')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: '#FEF9EE', color: '#D97706', border: '1px solid #FDE68A' }}>
                  + Pickup
                </button>
                <button onClick={() => addStop('Delivery')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}>
                  + Delivery
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {form.stops.map((stop: Stop, idx: number) => (
                <div key={idx} className="rounded-xl p-4"
                  style={{
                    background: stop.action === 'Pickup' ? '#FFFBEB' : '#F0FDF4',
                    border: `1px solid ${stop.action === 'Pickup' ? '#FDE68A' : '#BBF7D0'}`,
                  }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold"
                        style={{ color: stop.action === 'Pickup' ? '#D97706' : '#16A34A' }}>
                        {stop.action === 'Pickup' ? '📍' : '🏁'} {stop.action} {stop.stop_number}
                      </span>
                      <select value={stop.action}
                        onChange={e => upStop(idx, 'action', e.target.value)}
                        className="text-xs px-2 py-1 rounded-lg border outline-none"
                        style={{ borderColor: '#E2E8F0', background: 'white' }}>
                        <option>Pickup</option>
                        <option>Delivery</option>
                      </select>
                    </div>
                    {form.stops.length > 2 && (
                      <button onClick={() => remStop(idx)}
                        className="text-xs px-2 py-1 rounded-lg"
                        style={{ background: '#FEE2E2', color: '#DC2626' }}>
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className={lb}>Company / Facility Name</label>
                      <input className={ic} style={is}
                        value={stop.company_name}
                        onChange={e => upStop(idx, 'company_name', e.target.value)}
                        placeholder="e.g. Dallas RPDC" />
                    </div>
                    <div>
                      <label className={lb}>Street Address</label>
                      <input className={ic} style={is}
                        value={stop.street}
                        onChange={e => upStop(idx, 'street', e.target.value)}
                        placeholder="e.g. 1421 N Cockrell Hill Rd" />
                    </div>
                  </div>
                  <div className="grid grid-cols-6 gap-3 mb-3">
                    <div className="col-span-2">
                      <label className={lb}>City</label>
                      <input className={ic} style={is}
                        value={stop.city}
                        onChange={e => upStop(idx, 'city', e.target.value)} />
                    </div>
                    <div>
                      <label className={lb}>State</label>
                      <input className={ic} style={is}
                        value={stop.state} maxLength={2}
                        onChange={e => upStop(idx, 'state', e.target.value)}
                        placeholder="TX" />
                    </div>
                    <div>
                      <label className={lb}>ZIP</label>
                      <input className={ic} style={is}
                        value={stop.zip} maxLength={5}
                        onChange={e => upStop(idx, 'zip', e.target.value)} />
                    </div>
                    <div>
                      <label className={lb}>Date</label>
                      <input type="date" className={ic} style={is}
                        value={stop.date}
                        onChange={e => upStop(idx, 'date', e.target.value)} />
                    </div>
                    <div>
                      <label className={lb}>Appt</label>
                      <input className={ic} style={is}
                        value={stop.time}
                        onChange={e => upStop(idx, 'time', e.target.value)}
                        placeholder="05:30" />
                    </div>
                  </div>
                  <div>
                    <label className={lb}>Driver Instructions</label>
                    <input className={ic} style={is}
                      value={stop.notes}
                      onChange={e => upStop(idx, 'notes', e.target.value)}
                      placeholder="e.g. Chock wheels, check in for Route FA2A4" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes + Save */}
          <div className="bg-white rounded-2xl p-5"
            style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <div className="mb-4">
              <label className={lb}>General Notes</label>
              <textarea rows={2} className={ic} style={is}
                value={form.notes}
                onChange={e => f('notes', e.target.value)}
                placeholder="Any additional notes..." />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.tonu}
                  onChange={e => f('tonu', e.target.checked)}
                  style={{ accentColor: '#F0A500' }} />
                <span className="text-sm" style={{ color: '#64748B' }}>TONU</span>
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() => { setView('list'); refreshLoads() }}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold border"
                  style={{ borderColor: '#E2E8F0', color: '#64748B' }}>
                  Cancel
                </button>
                <button onClick={save} disabled={saving}
                  className="px-8 py-2.5 rounded-xl text-sm font-bold text-white"
                  style={{
                    background: saving ? '#C47E00' : '#F0A500',
                    boxShadow: '0 4px 16px rgba(240,165,0,0.3)',
                  }}>
                  {saving ? 'Saving...' : editId ? 'Update Load' : '✓ Save Load'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DOCUMENTS MODAL ───────────────────────────────────────────────── */}
      {selLoad && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setSelLoad(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-screen overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="font-bold" style={{ color: '#1A1A2E' }}>
                  Documents — Load #{selLoad.load_number}
                </div>
                <div className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                  {selLoad.broker_name} · {selLoad.route}
                </div>
              </div>
              <button onClick={() => setSelLoad(null)}
                className="text-xl" style={{ color: '#94A3B8' }}>✕</button>
            </div>

            {/* Upload grid */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              {DOC_TYPES.map(dt => {
                const icon = dt === 'Rate Confirmation' ? '📋'
                  : dt === 'Bill of Lading' ? '📄'
                  : dt === 'Proof of Delivery' ? '✅'
                  : dt === 'Invoice' ? '💰' : '📎'
                const isMandatory = dt === 'Rate Confirmation' || dt === 'Bill of Lading'
                const hasDoc = docs.some(d => d.doc_type === dt)
                return (
                  <label key={dt}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all hover:border-amber-400"
                    style={{
                      borderColor: hasDoc ? '#16A34A' : isMandatory ? '#FCA5A5' : '#E2E8F0',
                      borderStyle: hasDoc ? 'solid' : 'dashed',
                      background: hasDoc ? '#F0FDF4' : 'white',
                    }}>
                    <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg"
                      onChange={async e => {
                        if (!e.target.files?.[0]) return
                        try {
                          await loadsApi.uploadDoc(selLoad.id, e.target.files[0], dt)
                          const r = await loadsApi.getDocs(selLoad.id); setDocs(r.data)
                          const ds = await loadsApi.docStatus(selLoad.id)
                          setDocStatus(p => ({ ...p, [selLoad.id]: ds.data }))
                          toast.success(`${dt} uploaded`)
                        } catch (e: any) {
                          toast.error(e.response?.data?.detail || 'Upload failed')
                        }
                      }} />
                    <span className="text-xl">{icon}</span>
                    <span className="text-xs font-semibold text-center"
                      style={{ color: hasDoc ? '#16A34A' : '#64748B' }}>
                      {dt}
                    </span>
                    {isMandatory && !hasDoc && (
                      <span className="text-xs font-bold" style={{ color: '#DC2626' }}>Required</span>
                    )}
                    {hasDoc && (
                      <span className="text-xs font-bold" style={{ color: '#16A34A' }}>✓ Uploaded</span>
                    )}
                  </label>
                )
              })}
            </div>

            {/* Uploaded docs list */}
            {docs.length > 0 && (
              <div>
                <div className="text-xs font-bold mb-2" style={{ color: '#94A3B8' }}>UPLOADED FILES</div>
                <div className="space-y-2">
                  {docs.map((d: any) => (
                    <div key={d.id}
                      className="flex items-center justify-between p-3 rounded-xl"
                      style={{ background: '#F8F7F4' }}>
                      <div>
                        <div className="text-sm font-semibold" style={{ color: '#1A1A2E' }}>{d.doc_type}</div>
                        <div className="text-xs" style={{ color: '#94A3B8' }}>{d.original_filename}</div>
                      </div>
                      <button onClick={async () => {
                        const r = await loadsApi.getDocUrl(selLoad.id, d.id)
                        window.open(r.data.url, '_blank')
                      }} className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                        style={{ background: '#EFF6FF', color: '#2563EB' }}>
                        View
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
