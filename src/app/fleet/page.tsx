'use client'
import { useEffect, useState } from 'react'
import { driversApi, trucksApi } from '@/lib/api'
import toast from 'react-hot-toast'

const EMPTY_DRIVER = { name:'', driver_type:'Company Driver', pay_rate:0.28, email:'', phone:'', license_no:'', active:true }
const EMPTY_TRUCK  = { unit_number:'', year:'', make:'', model:'', vin:'', active:true }

export default function FleetPage() {
  const [tab, setTab] = useState<'drivers'|'trucks'>('drivers')
  const [drivers, setDrivers] = useState<any[]>([])
  const [trucks,  setTrucks]  = useState<any[]>([])
  const [showAll, setShowAll] = useState(false)
  const [driverForm, setDriverForm] = useState<any>({ ...EMPTY_DRIVER })
  const [truckForm,  setTruckForm]  = useState<any>({ ...EMPTY_TRUCK })
  const [editDriverId, setEditDriverId] = useState<number|null>(null)
  const [editTruckId,  setEditTruckId]  = useState<number|null>(null)
  const [showDriverForm, setShowDriverForm] = useState(false)
  const [showTruckForm,  setShowTruckForm]  = useState(false)
  const [driverStats, setDriverStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [d, t] = await Promise.all([driversApi.list(!showAll), trucksApi.list(!showAll)])
      setDrivers(d.data)
      setTrucks(t.data)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [showAll])

  const saveDriver = async () => {
    try {
      const payload = { ...driverForm, pay_rate: Number(driverForm.pay_rate) }
      editDriverId ? await driversApi.update(editDriverId, payload) : await driversApi.create(payload)
      toast.success(editDriverId ? 'Driver updated' : 'Driver added')
      setShowDriverForm(false); setEditDriverId(null); setDriverForm({ ...EMPTY_DRIVER }); load()
    } catch (e: any) { toast.error(e.response?.data?.detail || 'Failed') }
  }

  const saveTruck = async () => {
    try {
      editTruckId ? await trucksApi.update(editTruckId, truckForm) : await trucksApi.create(truckForm)
      toast.success(editTruckId ? 'Truck updated' : 'Truck added')
      setShowTruckForm(false); setEditTruckId(null); setTruckForm({ ...EMPTY_TRUCK }); load()
    } catch (e: any) { toast.error(e.response?.data?.detail || 'Failed') }
  }

  const deactivateDriver = async (id: number) => {
    if (!confirm('Deactivate this driver?')) return
    await driversApi.deactivate(id); toast.success('Driver deactivated'); load()
  }

  const deactivateTruck = async (id: number) => {
    if (!confirm('Deactivate this truck?')) return
    await trucksApi.deactivate(id); toast.success('Truck deactivated'); load()
  }

  const viewDriverStats = async (id: number) => {
    const res = await driversApi.stats(id)
    setDriverStats(res.data)
  }

  const inputClass = "w-full px-3 py-2 rounded-lg text-sm border outline-none"
  const inputStyle = { borderColor: '#E2E8F0', background: '#FAFAF9' }
  const labelStyle = { color: '#64748B' }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#1A1A2E', fontFamily: 'Playfair Display, serif' }}>Fleet</h1>
        <div className="flex gap-3">
          <label className="flex items-center gap-2 text-sm" style={{ color: '#64748B' }}>
            <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)}
              style={{ accentColor: '#F0A500' }} />
            Show inactive
          </label>
          {tab === 'drivers' && (
            <button onClick={() => { setShowDriverForm(true); setEditDriverId(null); setDriverForm({ ...EMPTY_DRIVER }) }}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: '#F0A500' }}>
              + Add Driver
            </button>
          )}
          {tab === 'trucks' && (
            <button onClick={() => { setShowTruckForm(true); setEditTruckId(null); setTruckForm({ ...EMPTY_TRUCK }) }}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: '#F0A500' }}>
              + Add Truck
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl mb-6 w-fit" style={{ background: '#F1EFE8' }}>
        {(['drivers','trucks'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-5 py-2 rounded-lg text-sm font-medium capitalize transition-all"
            style={{
              background: tab === t ? 'white' : 'transparent',
              color: tab === t ? '#1A1A2E' : '#94A3B8',
              boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}>
            {t} ({tab === t ? (t === 'drivers' ? drivers.length : trucks.length) : '...'})
          </button>
        ))}
      </div>

      {/* Drivers */}
      {tab === 'drivers' && (
        <div className="grid grid-cols-2 gap-4">
          {loading ? <div className="col-span-2 text-center py-12" style={{ color: '#94A3B8' }}>Loading...</div> :
          drivers.length === 0 ? (
            <div className="col-span-2 text-center py-12">
              <div className="text-4xl mb-3">👤</div>
              <div className="text-sm" style={{ color: '#94A3B8' }}>No drivers yet. Add your first driver.</div>
            </div>
          ) : drivers.map((d: any) => (
            <div key={d.id} className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                    style={{ background: d.driver_type === 'Owner Operator' ? '#F0A500' : '#1A1A2E' }}>
                    {d.name.split(' ').map((n: string) => n[0]).join('').slice(0,2)}
                  </div>
                  <div>
                    <div className="font-semibold" style={{ color: '#1A1A2E' }}>{d.name}</div>
                    <div className="text-xs" style={{ color: '#94A3B8' }}>{d.type_label}</div>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${d.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {d.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                <div><span style={{ color: '#94A3B8' }}>Pay Rate</span><div className="font-semibold" style={{ color: '#F0A500' }}>{d.pay_rate_pct}</div></div>
                <div><span style={{ color: '#94A3B8' }}>Phone</span><div style={{ color: '#1A1A2E' }}>{d.phone || '—'}</div></div>
                <div><span style={{ color: '#94A3B8' }}>Email</span><div style={{ color: '#1A1A2E' }}>{d.email || '—'}</div></div>
                <div><span style={{ color: '#94A3B8' }}>CDL #</span><div style={{ color: '#1A1A2E' }}>{d.license_no || '—'}</div></div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => viewDriverStats(d.id)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: '#F8F7F4', color: '#64748B' }}>Stats</button>
                <button onClick={() => { setDriverForm({ ...d }); setEditDriverId(d.id); setShowDriverForm(true) }}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: '#EFF6FF', color: '#2563EB' }}>Edit</button>
                {d.active && (
                  <button onClick={() => deactivateDriver(d.id)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium"
                    style={{ background: '#FEE2E2', color: '#DC2626' }}>Deactivate</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Trucks */}
      {tab === 'trucks' && (
        <div className="grid grid-cols-3 gap-4">
          {loading ? <div className="col-span-3 text-center py-12" style={{ color: '#94A3B8' }}>Loading...</div> :
          trucks.length === 0 ? (
            <div className="col-span-3 text-center py-12">
              <div className="text-4xl mb-3">🚛</div>
              <div className="text-sm" style={{ color: '#94A3B8' }}>No trucks yet. Add your first truck.</div>
            </div>
          ) : trucks.map((t: any) => (
            <div key={t.id} className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                    style={{ background: '#F1EFE8' }}>🚛</div>
                  <div>
                    <div className="font-bold" style={{ color: '#1A1A2E' }}>{t.unit_number}</div>
                    <div className="text-xs" style={{ color: '#94A3B8' }}>{[t.year, t.make, t.model].filter(Boolean).join(' ') || 'No details'}</div>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${t.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {t.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="text-xs mb-4" style={{ color: '#94A3B8' }}>
                VIN: {t.vin || '—'}
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setTruckForm({ ...t }); setEditTruckId(t.id); setShowTruckForm(true) }}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: '#EFF6FF', color: '#2563EB' }}>Edit</button>
                {t.active && (
                  <button onClick={() => deactivateTruck(t.id)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium"
                    style={{ background: '#FEE2E2', color: '#DC2626' }}>Deactivate</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Driver Form Modal */}
      {showDriverForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex justify-between mb-5">
              <h3 className="font-bold" style={{ color: '#1A1A2E' }}>{editDriverId ? 'Edit Driver' : 'Add Driver'}</h3>
              <button onClick={() => setShowDriverForm(false)} style={{ color: '#94A3B8' }}>✕</button>
            </div>
            <div className="space-y-4">
              {[['name','Full Name *'],['email','Email'],['phone','Phone'],['license_no','CDL License #']].map(([k,l]) => (
                <div key={k}>
                  <label className="block text-xs font-medium mb-1" style={labelStyle}>{l}</label>
                  <input className={inputClass} style={inputStyle} value={driverForm[k] || ''}
                    onChange={e => setDriverForm((p: any) => ({ ...p, [k]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium mb-1" style={labelStyle}>Driver Type</label>
                <select className={inputClass} style={inputStyle} value={driverForm.driver_type}
                  onChange={e => setDriverForm((p:any) => ({ ...p, driver_type: e.target.value }))}>
                  <option>Company Driver</option>
                  <option>Owner Operator</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={labelStyle}>
                  Pay Rate — {Math.round(driverForm.pay_rate * 100)}%
                </label>
                <input type="range" min="0.1" max="0.95" step="0.01" value={driverForm.pay_rate}
                  onChange={e => setDriverForm((p:any) => ({ ...p, pay_rate: Number(e.target.value) }))}
                  className="w-full" style={{ accentColor: '#F0A500' }} />
                <div className="flex justify-between text-xs mt-1" style={{ color: '#94A3B8' }}>
                  <span>10%</span><span>95%</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowDriverForm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm border" style={{ borderColor: '#E2E8F0', color: '#64748B' }}>Cancel</button>
              <button onClick={saveDriver}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: '#F0A500' }}>
                {editDriverId ? 'Update' : 'Add Driver'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Truck Form Modal */}
      {showTruckForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex justify-between mb-5">
              <h3 className="font-bold" style={{ color: '#1A1A2E' }}>{editTruckId ? 'Edit Truck' : 'Add Truck'}</h3>
              <button onClick={() => setShowTruckForm(false)} style={{ color: '#94A3B8' }}>✕</button>
            </div>
            <div className="space-y-4">
              {[['unit_number','Unit Number *'],['year','Year'],['make','Make'],['model','Model'],['vin','VIN']].map(([k,l]) => (
                <div key={k}>
                  <label className="block text-xs font-medium mb-1" style={labelStyle}>{l}</label>
                  <input className={inputClass} style={inputStyle} value={truckForm[k] || ''}
                    onChange={e => setTruckForm((p: any) => ({ ...p, [k]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowTruckForm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm border" style={{ borderColor: '#E2E8F0', color: '#64748B' }}>Cancel</button>
              <button onClick={saveTruck}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: '#F0A500' }}>
                {editTruckId ? 'Update' : 'Add Truck'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Driver Stats Modal */}
      {driverStats && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex justify-between mb-5">
              <h3 className="font-bold" style={{ color: '#1A1A2E' }}>{driverStats.driver_name} — Stats</h3>
              <button onClick={() => setDriverStats(null)} style={{ color: '#94A3B8' }}>✕</button>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-5">
              {[
                { label: 'Total Loads', value: driverStats.total_loads },
                { label: 'Pay Rate', value: driverStats.pay_rate_pct },
                { label: 'Total Revenue', value: `$${driverStats.total_revenue?.toLocaleString()}` },
                { label: 'Paid to Driver', value: `$${driverStats.paid_to_driver?.toLocaleString()}` },
                { label: 'Pending Pay', value: `$${driverStats.pending_pay?.toLocaleString()}`, highlight: true },
              ].map(s => (
                <div key={s.label} className="p-3 rounded-xl" style={{ background: '#F8F7F4' }}>
                  <div className="text-xs mb-1" style={{ color: '#94A3B8' }}>{s.label}</div>
                  <div className="font-bold" style={{ color: s.highlight ? '#F0A500' : '#1A1A2E' }}>{s.value}</div>
                </div>
              ))}
            </div>
            <div>
              <div className="text-xs font-semibold mb-3" style={{ color: '#94A3B8' }}>Recent Loads</div>
              {driverStats.recent_loads?.slice(0,4).map((l: any) => (
                <div key={l.load_number} className="flex justify-between py-2 border-b" style={{ borderColor: '#F1EFE8' }}>
                  <div className="text-sm" style={{ color: '#1A1A2E' }}>{l.route}</div>
                  <div className="text-sm font-semibold" style={{ color: '#F0A500' }}>${l.driver_pay?.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
