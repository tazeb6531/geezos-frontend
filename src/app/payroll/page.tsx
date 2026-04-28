'use client'
import { useEffect, useState } from 'react'
import { payrollApi, driversApi, loadsApi, accountingApi } from '@/lib/api'
import toast from 'react-hot-toast'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number | undefined | null) =>
  (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtDate = (d: string | null | undefined): string => {
  if (!d) return '—'
  try { const [y, m, day] = d.slice(0, 10).split('-'); return `${m}/${day}/${y}` }
  catch { return d }
}

// Exactly as Streamlit: [cat] desc
const buildLabel = (cat: string, desc: string) =>
  desc.trim() && desc.trim() !== cat ? `[${cat}] ${desc.trim()}` : cat

// ── Deduction categories — exact same as Streamlit ────────────────────────────
const DED_CATS = [
  '💵 Advance Pay',
  '🔧 Maintenance / Repairs',
  '📋 Insurance / Permits',
  '⛽ Fuel / Tolls',
  '📦 Other',
]

interface Ded { cat: string; label: string; amount: string }

// ── Shared styles ─────────────────────────────────────────────────────────────
const ic = 'w-full px-3 py-2 rounded-lg text-sm border outline-none transition-all'
const is = { borderColor: '#E2E8F0', background: '#FAFAF9' }
const lb = 'block text-xs font-medium mb-1 text-slate-500'
const Sep = () => <div style={{ height: 1, background: '#F1EFE8', margin: '20px 0' }} />

export default function AccountingPage() {
  const [tab, setTab] = useState<'run' | 'advances' | 'history'>('run')

  // ── Shared data ─────────────────────────────────────────────────────────────
  const [drivers,  setDrivers]  = useState<any[]>([])
  const [payrolls, setPayrolls] = useState<any[]>([])
  const [advances, setAdvances] = useState<any[]>([])
  const [loading,  setLoading]  = useState(false)

  // ── RUN PAYROLL state ────────────────────────────────────────────────────────
  const [selDrvId,    setSelDrvId]    = useState('')
  const [periodStart, setPeriodStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  })
  const [periodEnd, setPeriodEnd] = useState(() => new Date().toISOString().slice(0, 10))
  const [preview,   setPreview]   = useState<any>(null)
  const [deds,      setDeds]      = useState<Ded[]>([])
  const [prNotes,   setPrNotes]   = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [locked,    setLocked]    = useState<any>(null)   // payroll after lock
  const [emailAddr, setEmailAddr] = useState('')
  const [sending,   setSending]   = useState(false)
  const [crossChecks, setCross]   = useState<Record<number, any>>({})
  const [ccLoading,   setCCL]     = useState<number | null>(null)

  // ── ADVANCES state ───────────────────────────────────────────────────────────
  const [advDrvId, setAdvDrvId] = useState('')
  const [advAmt,   setAdvAmt]   = useState('')
  const [advDate,  setAdvDate]  = useState(() => new Date().toISOString().slice(0, 10))
  const [advNote,  setAdvNote]  = useState('')

  // ── HISTORY state ────────────────────────────────────────────────────────────
  const [histFilter, setHistFilter] = useState('All')

  // ── Load all data ────────────────────────────────────────────────────────────
  const loadAll = async () => {
    try {
      const [d, p, a] = await Promise.all([
        driversApi.list(),
        payrollApi.list(),
        payrollApi.advances(),
      ])
      setDrivers(d.data)
      setPayrolls(p.data)
      setAdvances(a.data)
    } catch { }
  }

  useEffect(() => { loadAll() }, [])

  const selDriver = drivers.find(d => d.id === Number(selDrvId))

  // ── Computed deductions ──────────────────────────────────────────────────────
  const validDeds   = deds.filter(d => d.label.trim() && Number(d.amount) > 0)
  const totalDeds   = validDeds.reduce((s, d) => s + Number(d.amount), 0)
  const driverGross = preview?.driver_gross ?? 0
  const netPay      = Math.max(0, Math.round((driverGross - totalDeds) * 100) / 100)

  // Category totals for pay summary
  const catTotals: Record<string, number> = {}
  validDeds.forEach(d => { catTotals[d.cat] = (catTotals[d.cat] ?? 0) + Number(d.amount) })

  // ── Preview payroll ──────────────────────────────────────────────────────────
  const previewPayroll = async () => {
    if (!selDrvId) { toast.error('Select a driver'); return }
    if (!periodStart || !periodEnd) { toast.error('Select both dates'); return }
    setLoading(true)
    setPreview(null); setDeds([]); setConfirmed(false); setLocked(null); setCross({})
    try {
      const res = await payrollApi.preview({
        driver_id: Number(selDrvId),
        period_start: periodStart,
        period_end: periodEnd,
      })
      const pv = res.data
      setPreview(pv)
      // Auto-populate pending advances — exactly like Streamlit
      if (pv.pending_advances?.length > 0) {
        const advDeds: Ded[] = pv.pending_advances.map((a: any) => ({
          cat: '💵 Advance Pay',
          label: a.note
            ? `${a.note} (${fmtDate(a.advance_date)})`
            : `Advance ${fmtDate(a.advance_date)}`,
          amount: String(a.amount),
        }))
        setDeds(advDeds)
        toast.success(
          `${pv.pending_advances.length} pending advance(s) auto-added to deductions`
        )
      }
      setEmailAddr(pv.driver?.email ?? '')
    } catch (e: any) {
      toast.error(
        e.response?.data?.detail ??
        'No Delivered/Invoiced loads found for this driver and period.'
      )
    } finally { setLoading(false) }
  }

  // ── RC/BOL cross-check ───────────────────────────────────────────────────────
  const runCrossCheck = async (loadId: number) => {
    setCCL(loadId)
    try {
      const r = await loadsApi.crossCheck(loadId)
      setCross(p => ({ ...p, [loadId]: r.data }))
    } catch (e: any) {
      setCross(p => ({ ...p, [loadId]: { error: e.response?.data?.detail ?? 'Failed' } }))
    } finally { setCCL(null) }
  }

  // ── Confirm & lock ───────────────────────────────────────────────────────────
  const confirmPayroll = async () => {
    if (!preview || !confirmed) return
    if (preview.missing_docs?.length > 0) {
      toast.error('Upload missing RC/BOL documents first')
      return
    }
    setLoading(true)
    try {
      const dedObjs = validDeds.map(d => ({
        label: buildLabel(d.cat, d.label),
        amount: Number(d.amount),
      }))
      const res = await payrollApi.confirm({
        driver_id: Number(selDrvId),
        period_start: periodStart,
        period_end: periodEnd,
        deductions: dedObjs,
        notes: prNotes,
      })
      setLocked({ ...res.data, previewLoads: preview.loads, netPay })
      toast.success('✅ Payroll confirmed — loads locked as Paid')
      setPreview(null); setDeds([]); setPrNotes(''); setConfirmed(false)
      await loadAll()
    } catch (e: any) {
      toast.error(e.response?.data?.detail ?? 'Failed to confirm payroll')
    } finally { setLoading(false) }
  }

  // ── Email ────────────────────────────────────────────────────────────────────
  const sendEmail = async () => {
    if (!locked || !emailAddr) { toast.error('Enter email address'); return }
    setSending(true)
    try {
      await payrollApi.email({ payroll_id: locked.id, email: emailAddr })
      toast.success(`✅ Settlement email sent to ${emailAddr}`)
      setLocked(null)
    } catch (e: any) {
      toast.error(e.response?.data?.detail ?? 'Email failed — check SMTP settings')
    } finally { setSending(false) }
  }

  // ── Log advance ──────────────────────────────────────────────────────────────
  const logAdvance = async () => {
    if (!advDrvId || !advAmt || !advDate) {
      toast.error('Fill driver, amount and date'); return
    }
    const dr = drivers.find(d => d.id === Number(advDrvId))
    try {
      await payrollApi.addAdvance({
        driver_id: Number(advDrvId),
        driver_name: dr?.name ?? '',
        amount: Number(advAmt),
        note: advNote,
        advance_date: advDate,
      })
      toast.success(
        `✅ $${Number(advAmt).toLocaleString()} advance logged for ${dr?.name}. ` +
        'It will auto-populate on the next payroll run.'
      )
      setAdvDrvId(''); setAdvAmt(''); setAdvNote('')
      const a = await payrollApi.advances(); setAdvances(a.data)
    } catch { toast.error('Failed to log advance') }
  }

  // ── Remove advance ───────────────────────────────────────────────────────────
  const removeAdvance = async (id: number) => {
    try {
      await payrollApi.deleteAdvance(id)
      const a = await payrollApi.advances(); setAdvances(a.data)
      toast.success('Advance removed')
    } catch { toast.error('Failed') }
  }

  const pendingAdvances  = advances.filter(a => !a.settled)
  const settledAdvances  = advances.filter(a => a.settled)
  const filteredPayrolls = histFilter === 'All'
    ? payrolls
    : payrolls.filter(p => p.driver_name === histFilter)

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in">

      {/* Page title */}
      <h1 className="text-2xl font-bold mb-6"
        style={{ color: '#1A1A2E', fontFamily: 'Playfair Display,serif' }}>
        💰 Accounting & Payroll
      </h1>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl mb-7 w-fit" style={{ background: '#F1EFE8' }}>
        {([['run', 'RUN PAYROLL'], ['advances', 'ADVANCES'], ['history', 'PAYROLL HISTORY']] as const)
          .map(([t, l]) => (
            <button key={t} onClick={() => setTab(t)}
              className="px-5 py-2.5 rounded-lg text-sm font-bold transition-all"
              style={{
                background: tab === t ? 'white' : 'transparent',
                color: tab === t ? '#1A1A2E' : '#94A3B8',
                boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              }}>
              {l}
            </button>
          ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB 1 — RUN PAYROLL                                               */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {tab === 'run' && (
        <div className="max-w-4xl space-y-5">

          {drivers.length === 0 ? (
            <div className="p-5 rounded-2xl" style={{ background: '#FEF9EE', border: '1px solid #FDE68A' }}>
              <div className="text-sm" style={{ color: '#D97706' }}>
                No active drivers. Add drivers in Fleet first.
              </div>
            </div>
          ) : (<>

            {/* ── Driver + Period ──────────────────────────────────────── */}
            <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>

              {/* Driver select */}
              <div className="mb-4">
                <label className={lb}>Select Driver</label>
                <select className={ic} style={is} value={selDrvId}
                  onChange={e => {
                    setSelDrvId(e.target.value)
                    setPreview(null); setLocked(null); setDeds([])
                  }}>
                  <option value="">— Select driver —</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.type_label} — {d.pay_rate_pct})
                    </option>
                  ))}
                </select>
              </div>

              {/* Driver info row */}
              {selDriver && (
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    { label: 'Type',     value: selDriver.type_label,       bg: '#EFF6FF', color: '#2563EB' },
                    { label: 'Pay Rate', value: selDriver.pay_rate_pct,     bg: '#F0FDF4', color: '#16A34A' },
                    { label: 'Email',    value: selDriver.email || 'not set', bg: '#F8F7F4', color: '#64748B' },
                  ].map(({ label, value, bg, color }) => (
                    <div key={label} className="p-3 rounded-xl" style={{ background: bg }}>
                      <div className="text-xs mb-0.5" style={{ color: '#94A3B8' }}>{label}</div>
                      <div className="text-sm font-semibold" style={{ color }}>{value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Period */}
              <div className="grid grid-cols-2 gap-4 mb-5">
                <div>
                  <label className={lb}>Period Start</label>
                  <input type="date" className={ic} style={is}
                    value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
                </div>
                <div>
                  <label className={lb}>Period End</label>
                  <input type="date" className={ic} style={is}
                    value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
                </div>
              </div>

              <button onClick={previewPayroll} disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-bold"
                style={{
                  background: loading ? '#F5D78E' : '#F0A500',
                  color: 'white',
                  boxShadow: '0 4px 16px rgba(240,165,0,0.25)',
                }}>
                {loading ? '🔍 Loading...' : '🔍 Preview Payroll'}
              </button>
            </div>

            {/* ── Missing docs — HARD STOP ─────────────────────────────── */}
            {preview?.missing_docs?.length > 0 && (
              <div className="p-5 rounded-2xl"
                style={{ background: '#FEF2F2', border: '2px solid #DC2626' }}>
                <div className="text-base font-bold mb-2" style={{ color: '#DC2626' }}>
                  ⛔ Cannot run payroll — upload missing documents first.
                </div>
                {preview.missing_docs.map((m: any) => (
                  <div key={m.load_number} className="text-sm py-0.5" style={{ color: '#DC2626' }}>
                    ❌ Load #{m.load_number}: missing {m.missing?.join(', ')}
                  </div>
                ))}
                <div className="text-xs mt-3 p-3 rounded-lg"
                  style={{ background: '#FEE2E2', color: '#991B1B' }}>
                  Go to Dispatch → find the load → click 📎 Docs → upload RC and BOL.
                </div>
              </div>
            )}

            {/* ── Preview results ──────────────────────────────────────── */}
            {preview && (
              <div className="bg-white rounded-2xl p-6"
                style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>

                {/* Metrics — Company Driver: 3 cols | Owner Operator: 4 cols */}
                {selDriver?.driver_type === 'Owner Operator' ? (
                  <div className="grid grid-cols-4 gap-4 mb-5">
                    {[
                      { label: 'Loads',                             value: String(preview.loads?.length), color: '#1A1A2E', bg: '#F8F7F4' },
                      { label: 'Gross Freight',                     value: `$${fmt(preview.gross)}`,          color: '#1A1A2E', bg: '#F8F7F4' },
                      { label: `Company (${preview.company_pct_pct})`, value: `-$${fmt(preview.company_take)}`, color: '#DC2626', bg: '#FEF2F2' },
                      { label: `Owner Op (${selDriver.pay_rate_pct})`, value: `$${fmt(preview.driver_gross)}`,  color: '#16A34A', bg: '#F0FDF4' },
                    ].map(m => (
                      <div key={m.label} className="p-4 rounded-xl text-center" style={{ background: m.bg }}>
                        <div className="text-xl font-bold" style={{ color: m.color }}>{m.value}</div>
                        <div className="text-xs mt-1" style={{ color: '#94A3B8' }}>{m.label}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-4 mb-5">
                    {[
                      { label: 'Loads',                              value: String(preview.loads?.length),   color: '#1A1A2E', bg: '#F8F7F4' },
                      { label: 'Gross Freight',                      value: `$${fmt(preview.gross)}`,        color: '#1A1A2E', bg: '#F8F7F4' },
                      { label: `Driver Pay (${selDriver?.pay_rate_pct})`, value: `$${fmt(preview.driver_gross)}`, color: '#16A34A', bg: '#F0FDF4' },
                    ].map(m => (
                      <div key={m.label} className="p-4 rounded-xl text-center" style={{ background: m.bg }}>
                        <div className="text-xl font-bold" style={{ color: m.color }}>{m.value}</div>
                        <div className="text-xs mt-1" style={{ color: '#94A3B8' }}>{m.label}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Loads table */}
                <div className="overflow-x-auto mb-4">
                  <table className="w-full">
                    <thead>
                      <tr style={{ background: '#F8F7F4', borderBottom: '1px solid #F1EFE8' }}>
                        {['Load #', 'Broker', 'Route', 'Pickup Date', 'Delivery Date',
                          'Truck', 'Rate', 'Driver Pay', 'RC', 'BOL'].map(h => (
                          <th key={h} className="text-left px-3 py-2 text-xs font-semibold"
                            style={{ color: '#94A3B8' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.loads?.map((l: any, i: number) => (
                        <tr key={l.id} className="border-b"
                          style={{ borderColor: '#F1EFE8', background: i % 2 === 0 ? 'white' : '#FAFAF9' }}>
                          <td className="px-3 py-2 text-sm font-bold" style={{ color: '#1A1A2E' }}>
                            #{l.load_number}
                          </td>
                          <td className="px-3 py-2 text-xs" style={{ color: '#64748B' }}>{l.broker_name}</td>
                          <td className="px-3 py-2 text-xs" style={{ color: '#64748B' }}>{l.route}</td>
                          <td className="px-3 py-2 text-xs whitespace-nowrap" style={{ color: '#64748B' }}>
                            {fmtDate(l.pickup_date)}
                          </td>
                          <td className="px-3 py-2 text-xs whitespace-nowrap" style={{ color: '#64748B' }}>
                            {fmtDate(l.delivery_date)}
                          </td>
                          <td className="px-3 py-2 text-xs" style={{ color: '#64748B' }}>{l.truck_number || '—'}</td>
                          <td className="px-3 py-2 text-sm font-semibold" style={{ color: '#1A1A2E' }}>
                            ${fmt(l.freight_rate)}
                          </td>
                          <td className="px-3 py-2 text-sm font-semibold" style={{ color: '#F0A500' }}>
                            ${fmt(l.driver_pay)}
                          </td>
                          <td className="px-3 py-2 text-center">✅</td>
                          <td className="px-3 py-2 text-center">✅</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* RC vs BOL cross-check per load */}
                <div className="space-y-2 mb-2">
                  {preview.loads?.map((l: any) => {
                    const cc = crossChecks[l.id]
                    return (
                      <div key={l.id}>
                        <button onClick={() => runCrossCheck(l.id)}
                          disabled={ccLoading === l.id}
                          className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                          style={{ background: '#EFF6FF', color: '#2563EB' }}>
                          {ccLoading === l.id
                            ? '🔍 Verifying...'
                            : `🔍 Verify RC vs BOL — Load #${l.load_number}`}
                        </button>
                        {cc && (
                          <div className="mt-1 ml-2">
                            {cc.error ? (
                              <div className="text-xs p-2 rounded"
                                style={{ background: '#FEF9EE', color: '#D97706' }}>
                                ⚠ {cc.error}
                              </div>
                            ) : cc.mismatches?.length === 0 ? (
                              <div className="text-xs p-2 rounded"
                                style={{ background: '#F0FDF4', color: '#16A34A' }}>
                                ✅ RC and BOL match — all fields verified
                              </div>
                            ) : (
                              <div className="space-y-1">
                                {cc.mismatches?.map((m: any, i: number) => (
                                  <div key={i} className="text-xs p-2 rounded"
                                    style={{
                                      background: m.severity === 'critical' ? '#FEF2F2' : '#FEF9EE',
                                      color: m.severity === 'critical' ? '#DC2626' : '#D97706',
                                    }}>
                                    ⚠ <strong>{m.field}:</strong> RC="{m.rc_value}" → BOL="{m.bol_value}"
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Only show deductions + summary if preview OK (no missing docs) */}
            {preview && preview.missing_docs?.length === 0 && (<>

              {/* ── Deductions ───────────────────────────────────────────── */}
              <div className="bg-white rounded-2xl p-6"
                style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                <div className="text-base font-bold mb-1" style={{ color: '#1A1A2E' }}>
                  💸 Deductions
                </div>
                <div className="text-xs mb-5" style={{ color: '#94A3B8' }}>
                  Add any deductions for this pay period — advances, maintenance, insurance,
                  or anything else. Works for all driver types.
                </div>

                {/* Column headers */}
                {deds.length > 0 && (
                  <div className="grid grid-cols-12 gap-2 mb-2 px-2">
                    <div className="col-span-3 text-xs font-bold" style={{ color: '#94A3B8' }}>CATEGORY</div>
                    <div className="col-span-6 text-xs font-bold" style={{ color: '#94A3B8' }}>DESCRIPTION</div>
                    <div className="col-span-2 text-xs font-bold" style={{ color: '#94A3B8' }}>AMOUNT ($)</div>
                  </div>
                )}

                <div className="space-y-2 mb-4">
                  {deds.map((d, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center p-2 rounded-xl"
                      style={{ background: '#F8F7F4', border: '1px solid #F1EFE8' }}>
                      <div className="col-span-3">
                        <select className={ic} style={{ ...is, background: 'white', fontSize: '12px' }}
                          value={d.cat}
                          onChange={e => setDeds(p => p.map((x, idx) => idx === i ? { ...x, cat: e.target.value } : x))}>
                          {DED_CATS.map(c => <option key={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="col-span-6">
                        <input className={ic} style={{ ...is, background: 'white' }}
                          value={d.label}
                          placeholder="e.g. Cash advance 04/10"
                          onChange={e => setDeds(p => p.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))} />
                      </div>
                      <div className="col-span-2">
                        <input type="number" className={ic}
                          style={{ ...is, background: 'white', fontWeight: 600 }}
                          value={d.amount} placeholder="0.00"
                          onChange={e => setDeds(p => p.map((x, idx) => idx === i ? { ...x, amount: e.target.value } : x))} />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <button onClick={() => setDeds(p => p.filter((_, idx) => idx !== i))}
                          className="text-xs px-2 py-2 rounded-lg font-bold"
                          style={{ background: '#FEE2E2', color: '#DC2626' }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setDeds(p => [...p, { cat: DED_CATS[0], label: '', amount: '' }])}
                  className="text-sm px-4 py-2 rounded-xl font-semibold border"
                  style={{ borderColor: '#E2E8F0', color: '#64748B', background: 'white' }}>
                  ➕ Add Deduction
                </button>
              </div>

              {/* ── Pay Summary ──────────────────────────────────────────── */}
              <div className="bg-white rounded-2xl p-6"
                style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                <div className="text-base font-bold mb-4" style={{ color: '#1A1A2E' }}>
                  📊 Pay Summary
                </div>

                <table className="w-full mb-5">
                  <thead>
                    <tr style={{ borderBottom: '2px solid #F1EFE8' }}>
                      <th className="text-left py-2 text-xs font-bold" style={{ color: '#94A3B8' }}></th>
                      <th className="text-right py-2 text-xs font-bold" style={{ color: '#94A3B8' }}>AMOUNT</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b" style={{ borderColor: '#F1EFE8' }}>
                      <td className="py-2 text-sm" style={{ color: '#64748B' }}>Gross Freight</td>
                      <td className="py-2 text-sm font-semibold text-right" style={{ color: '#1A1A2E' }}>
                        ${fmt(preview.gross)}
                      </td>
                    </tr>
                    {selDriver?.driver_type === 'Owner Operator' && (
                      <tr className="border-b" style={{ borderColor: '#F1EFE8' }}>
                        <td className="py-2 text-sm" style={{ color: '#64748B' }}>
                          Company ({preview.company_pct_pct})
                        </td>
                        <td className="py-2 text-sm text-right" style={{ color: '#64748B' }}>
                          -${fmt(preview.company_take)}
                        </td>
                      </tr>
                    )}
                    <tr className="border-b" style={{ borderColor: '#F1EFE8' }}>
                      <td className="py-2 text-sm" style={{ color: '#64748B' }}>
                        {selDriver?.driver_type === 'Owner Operator'
                          ? `Owner Op Gross (${selDriver.pay_rate_pct})`
                          : `Driver Pay (${selDriver?.pay_rate_pct})`}
                      </td>
                      <td className="py-2 text-sm font-semibold text-right" style={{ color: '#1A1A2E' }}>
                        ${fmt(preview.driver_gross)}
                      </td>
                    </tr>
                    {Object.entries(catTotals).map(([cat, total]) => (
                      <tr key={cat} className="border-b" style={{ borderColor: '#F1EFE8' }}>
                        <td className="py-2 text-sm" style={{ color: '#64748B' }}>{cat}</td>
                        <td className="py-2 text-sm text-right" style={{ color: '#DC2626' }}>
                          -${fmt(total as number)}
                        </td>
                      </tr>
                    ))}
                    {totalDeds > 0 && (
                      <tr className="border-b" style={{ borderColor: '#F1EFE8' }}>
                        <td className="py-2 text-sm font-bold" style={{ color: '#64748B' }}>
                          Total Deductions
                        </td>
                        <td className="py-2 text-sm font-bold text-right" style={{ color: '#DC2626' }}>
                          -${fmt(totalDeds)}
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td className="py-3 text-base font-bold" style={{ color: '#1A1A2E' }}>
                        🏁 FINAL CHECK
                      </td>
                      <td className="py-3 text-2xl font-bold text-right" style={{ color: '#16A34A' }}>
                        ${fmt(netPay)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <Sep />

                {/* Notes / Memo */}
                <div className="mb-5">
                  <label className={lb}>📝 Notes / Memo (optional — printed on pay stub)</label>
                  <textarea rows={2} className={ic} style={is}
                    value={prNotes} onChange={e => setPrNotes(e.target.value)}
                    placeholder="e.g. Great work this period! Includes holiday bonus." />
                </div>

                <Sep />

                {/* Step 1 banner */}
                <div className="rounded-xl p-4 mb-5"
                  style={{ background: '#1E293B', borderLeft: '4px solid #F0A500' }}>
                  <div className="text-sm font-semibold mb-1" style={{ color: '#F9FAFB' }}>
                    Step 1 — Save &amp; review the pay stub before locking
                  </div>
                  <div className="text-xs" style={{ color: '#94A3B8' }}>
                    Open it, check every number, then come back and confirm in Step 2.
                  </div>
                </div>

                {/* Step 2 — Confirm checkbox */}
                <div className="text-sm font-semibold mb-3" style={{ color: '#1A1A2E' }}>
                  Step 2 — Confirm and lock:
                </div>
                <label className="flex items-start gap-3 cursor-pointer p-4 rounded-xl mb-5"
                  style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                  <input type="checkbox" className="mt-0.5" checked={confirmed}
                    onChange={e => setConfirmed(e.target.checked)}
                    style={{ accentColor: '#16A34A', width: 18, height: 18, flexShrink: 0 }} />
                  <span className="text-sm" style={{ color: '#1A1A2E' }}>
                    I have reviewed the pay stub and confirm final check of{' '}
                    <strong>${fmt(netPay)}</strong> for{' '}
                    <strong>{preview.driver?.name}</strong>.{' '}
                    All included loads will be locked as Paid.
                  </span>
                </label>

                <button onClick={confirmPayroll}
                  disabled={!confirmed || loading}
                  className="w-full py-4 rounded-xl text-sm font-bold text-white disabled:opacity-30"
                  style={{
                    background: confirmed ? '#1A1A2E' : '#6B7280',
                    letterSpacing: '0.05em',
                  }}>
                  {loading ? 'Processing...' : '🔐 PROCESS & LOCK PAYROLL'}
                </button>
              </div>
            </>)}

            {/* ── Post-lock: PDF + Email ───────────────────────────────── */}
            {locked && (
              <div className="bg-white rounded-2xl p-6"
                style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)', border: '2px solid #BBF7D0' }}>
                <div className="text-base font-bold mb-1" style={{ color: '#16A34A' }}>
                  ✅ Payroll locked — loads marked as Paid
                </div>
                <div className="text-sm mb-5" style={{ color: '#64748B' }}>
                  Net Pay: <strong>${fmt(locked.netPay)}</strong> for {locked.driver_name}
                </div>

                <button onClick={async () => {
                  try {
                    const r = await payrollApi.pdfUrl(locked.id)
                    window.open(r.data.url, '_blank')
                  } catch { toast.error('PDF not available') }
                }} className="w-full py-3 rounded-xl text-sm font-bold text-white mb-5"
                  style={{ background: '#F0A500' }}>
                  ⬇️ Download Pay Stub PDF
                </button>

                <Sep />

                <div className="text-sm font-bold mb-3" style={{ color: '#1A1A2E' }}>
                  📧 Email Settlement #{locked.id} to {locked.driver_name}
                </div>
                <div className="flex gap-3">
                  <input className={ic} style={is}
                    value={emailAddr} onChange={e => setEmailAddr(e.target.value)}
                    placeholder="driver@email.com" />
                  <button onClick={sendEmail} disabled={sending}
                    className="px-5 py-2 rounded-xl text-sm font-bold text-white whitespace-nowrap"
                    style={{ background: '#1A1A2E' }}>
                    {sending ? 'Sending...' : '📨 Send Payroll Email'}
                  </button>
                </div>
              </div>
            )}
          </>)}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB 2 — ADVANCES                                                   */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {tab === 'advances' && (
        <div className="max-w-3xl space-y-5">
          <div className="text-sm" style={{ color: '#94A3B8' }}>
            Log cash advances given between payrolls. Pending advances auto-populate
            into the next payroll run for that driver.
          </div>

          {/* Log new advance */}
          <div className="bg-white rounded-2xl p-6"
            style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <div className="text-base font-bold mb-5" style={{ color: '#1A1A2E' }}>
              💵 Log New Advance
            </div>
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className={lb}>Driver</label>
                <select className={ic} style={is} value={advDrvId}
                  onChange={e => setAdvDrvId(e.target.value)}>
                  <option value="">— Select —</option>
                  {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className={lb}>Amount ($)</label>
                <input type="number" className={ic} style={is}
                  value={advAmt} onChange={e => setAdvAmt(e.target.value)}
                  placeholder="0.00" />
              </div>
              <div>
                <label className={lb}>Date Given</label>
                <input type="date" className={ic} style={is}
                  value={advDate} onChange={e => setAdvDate(e.target.value)} />
              </div>
              <div>
                <label className={lb}>Description</label>
                <input className={ic} style={is}
                  value={advNote} onChange={e => setAdvNote(e.target.value)}
                  placeholder="e.g. Cash advance — fuel money" />
              </div>
            </div>
            <button onClick={logAdvance}
              className="w-full py-3 rounded-xl text-sm font-bold text-white"
              style={{ background: '#F0A500' }}>
              💾 LOG ADVANCE
            </button>
          </div>

          {/* Pending advances */}
          <div className="bg-white rounded-2xl overflow-hidden"
            style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <div className="px-6 py-4 border-b text-sm font-bold"
              style={{ borderColor: '#F1EFE8', color: '#1A1A2E' }}>
              ⏳ Pending Advances (not yet settled)
            </div>
            {pendingAdvances.length === 0 ? (
              <div className="text-center py-8 text-sm" style={{ color: '#94A3B8' }}>
                No pending advances.
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr style={{ background: '#F8F7F4', borderBottom: '1px solid #F1EFE8' }}>
                    {['ID', 'Driver', 'Amount', 'Note', 'Date', ''].map(h => (
                      <th key={h} className="text-left px-4 py-2 text-xs font-semibold"
                        style={{ color: '#94A3B8' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pendingAdvances.map((a: any, i: number) => (
                    <tr key={a.id} className="border-b"
                      style={{ borderColor: '#F1EFE8', background: i % 2 === 0 ? 'white' : '#FAFAF9' }}>
                      <td className="px-4 py-2 text-sm" style={{ color: '#94A3B8' }}>#{a.id}</td>
                      <td className="px-4 py-2 text-sm font-medium" style={{ color: '#1A1A2E' }}>
                        {a.driver_name}
                      </td>
                      <td className="px-4 py-2 text-sm font-bold" style={{ color: '#DC2626' }}>
                        ${fmt(a.amount)}
                      </td>
                      <td className="px-4 py-2 text-sm" style={{ color: '#64748B' }}>
                        {a.note || '—'}
                      </td>
                      <td className="px-4 py-2 text-sm" style={{ color: '#64748B' }}>
                        {fmtDate(a.advance_date)}
                      </td>
                      <td className="px-4 py-2">
                        <button onClick={() => removeAdvance(a.id)}
                          className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                          style={{ background: '#FEE2E2', color: '#DC2626' }}>
                          🗑️ Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Settled advances */}
          <div className="bg-white rounded-2xl overflow-hidden"
            style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <div className="px-6 py-4 border-b text-sm font-bold"
              style={{ borderColor: '#F1EFE8', color: '#1A1A2E' }}>
              ✅ Settled Advances (included in past payrolls)
            </div>
            {settledAdvances.length === 0 ? (
              <div className="text-center py-8 text-sm" style={{ color: '#94A3B8' }}>
                No settled advances yet.
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr style={{ background: '#F8F7F4', borderBottom: '1px solid #F1EFE8' }}>
                    {['Driver', 'Amount', 'Note', 'Date', 'Payroll #'].map(h => (
                      <th key={h} className="text-left px-4 py-2 text-xs font-semibold"
                        style={{ color: '#94A3B8' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {settledAdvances.map((a: any, i: number) => (
                    <tr key={a.id} className="border-b"
                      style={{ borderColor: '#F1EFE8', background: i % 2 === 0 ? 'white' : '#FAFAF9' }}>
                      <td className="px-4 py-2 text-sm" style={{ color: '#64748B' }}>{a.driver_name}</td>
                      <td className="px-4 py-2 text-sm line-through" style={{ color: '#94A3B8' }}>
                        ${fmt(a.amount)}
                      </td>
                      <td className="px-4 py-2 text-sm" style={{ color: '#64748B' }}>{a.note || '—'}</td>
                      <td className="px-4 py-2 text-sm" style={{ color: '#64748B' }}>
                        {fmtDate(a.advance_date)}
                      </td>
                      <td className="px-4 py-2 text-sm" style={{ color: '#64748B' }}>
                        #{a.payroll_id || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB 3 — PAYROLL HISTORY                                            */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {tab === 'history' && (
        <div className="space-y-5">

          {/* Filter */}
          <div style={{ maxWidth: 280 }}>
            <label className={lb}>Filter by Driver</label>
            <select className={ic} style={is} value={histFilter}
              onChange={e => setHistFilter(e.target.value)}>
              <option>All</option>
              {Array.from(new Set(payrolls.map(p => p.driver_name))).map(n => (
                <option key={n as string}>{n as string}</option>
              ))}
            </select>
          </div>

          {filteredPayrolls.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center"
              style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
              <div className="text-4xl mb-3">💵</div>
              <div className="text-sm" style={{ color: '#94A3B8' }}>No payroll records yet.</div>
            </div>
          ) : (<>

            {/* Full history table */}
            <div className="bg-white rounded-2xl overflow-x-auto"
              style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
              <table className="w-full" style={{ minWidth: 1100 }}>
                <thead>
                  <tr style={{ background: '#1A1A2E' }}>
                    {['#', 'Driver', 'Period', 'Loads', 'Gross', 'Driver Gross',
                      'Deductions', 'Advances', 'Final Check', 'Issued', 'PDF Saved'].map(h => (
                      <th key={h} className="text-left px-3 py-3 text-xs font-semibold"
                        style={{ color: 'rgba(255,255,255,0.7)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredPayrolls.map((pr: any, i: number) => {
                    const costDeds = pr.deductions?.filter((d: any) =>
                      !d.label?.includes('Advance Pay')) ?? []
                    const advDeds  = pr.deductions?.filter((d: any) =>
                      d.label?.includes('Advance Pay'))  ?? []
                    const dedStr = costDeds.map((d: any) =>
                      `${d.label}: $${fmt(d.amount)}`).join(' | ') || '—'
                    const advStr = advDeds.map((d: any) =>
                      `${d.label.replace('[💵 Advance Pay] ', '')}: $${fmt(d.amount)}`
                    ).join(' | ') || '—'
                    return (
                      <tr key={pr.id} className="border-b"
                        style={{ borderColor: '#F1EFE8', background: i % 2 === 0 ? 'white' : '#FAFAF9' }}>
                        <td className="px-3 py-2 text-sm font-bold" style={{ color: '#1A1A2E' }}>
                          #{pr.id}
                        </td>
                        <td className="px-3 py-2 text-sm" style={{ color: '#1A1A2E' }}>
                          {pr.driver_name}
                        </td>
                        <td className="px-3 py-2 text-xs whitespace-nowrap" style={{ color: '#64748B' }}>
                          {fmtDate(pr.period_start)} — {fmtDate(pr.period_end)}
                        </td>
                        <td className="px-3 py-2 text-sm text-center" style={{ color: '#64748B' }}>
                          {pr.loads_count}
                        </td>
                        <td className="px-3 py-2 text-sm" style={{ color: '#1A1A2E' }}>
                          ${fmt(pr.gross_amount)}
                        </td>
                        <td className="px-3 py-2 text-sm" style={{ color: '#1A1A2E' }}>
                          ${fmt(pr.driver_gross)}
                        </td>
                        <td className="px-3 py-2 text-xs" style={{ color: '#DC2626', maxWidth: 160 }}>
                          {dedStr}
                        </td>
                        <td className="px-3 py-2 text-xs" style={{ color: '#D97706', maxWidth: 160 }}>
                          {advStr}
                        </td>
                        <td className="px-3 py-2 text-sm font-bold" style={{ color: '#F0A500' }}>
                          ${fmt(pr.net_pay)}
                        </td>
                        <td className="px-3 py-2 text-xs whitespace-nowrap" style={{ color: '#64748B' }}>
                          {pr.paid_at ? fmtDate(pr.paid_at.slice(0, 10)) : '—'}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button onClick={async () => {
                            try {
                              const r = await payrollApi.pdfUrl(pr.id)
                              window.open(r.data.url, '_blank')
                            } catch { toast.error('PDF not available') }
                          }} className="text-xs px-2 py-1.5 rounded-lg font-semibold"
                            style={{ background: '#EFF6FF', color: '#2563EB' }}>
                            ⬇️ PDF
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl p-5"
                style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                <div className="text-xs mb-1" style={{ color: '#94A3B8' }}>Total Net Paid to Drivers</div>
                <div className="text-2xl font-bold" style={{ color: '#F0A500' }}>
                  ${fmt(filteredPayrolls.reduce((s: number, p: any) => s + (p.net_pay ?? 0), 0))}
                </div>
              </div>
              <div className="bg-white rounded-2xl p-5"
                style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                <div className="text-xs mb-1" style={{ color: '#94A3B8' }}>Total Gross Revenue</div>
                <div className="text-2xl font-bold" style={{ color: '#1A1A2E' }}>
                  ${fmt(filteredPayrolls.reduce((s: number, p: any) => s + (p.gross_amount ?? 0), 0))}
                </div>
              </div>
            </div>

            {/* Per-record PDF download */}
            <div className="bg-white rounded-2xl p-6"
              style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
              <div className="text-sm font-bold mb-4" style={{ color: '#1A1A2E' }}>
                Download a Pay Stub:
              </div>
              <div className="space-y-3">
                {filteredPayrolls.map((pr: any) => (
                  <div key={pr.id}
                    className="flex items-center justify-between py-2 border-b"
                    style={{ borderColor: '#F1EFE8' }}>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold" style={{ color: '#1A1A2E' }}>#{pr.id}</span>
                      <span className="text-sm" style={{ color: '#64748B' }}>{pr.driver_name}</span>
                      <span className="text-xs" style={{ color: '#94A3B8' }}>
                        {fmtDate(pr.period_start)} — {fmtDate(pr.period_end)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-bold" style={{ color: '#F0A500' }}>
                        Net: ${fmt(pr.net_pay)}
                      </span>
                      <button onClick={async () => {
                        try {
                          const r = await payrollApi.pdfUrl(pr.id)
                          window.open(r.data.url, '_blank')
                        } catch { toast.error('No PDF saved') }
                      }} className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                        style={{ background: '#EFF6FF', color: '#2563EB' }}>
                        ⬇️ Pay Stub PDF
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>)}
        </div>
      )}
    </div>
  )
}
