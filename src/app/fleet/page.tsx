'use client'
import { useEffect, useState } from 'react'
import { driversApi, trucksApi, api } from '@/lib/api'
import toast from 'react-hot-toast'

const EMPTY_DRIVER = { name:'', driver_type:'Company Driver', pay_rate:0.28, email:'', phone:'', license_no:'', active:true }
const EMPTY_TRUCK  = { unit_number:'', year:'', make:'', model:'', vin:'', active:true }

// ── Fleet Document API (inline since backend endpoints are simple) ──────────
const fleetDocsApi = {
  listDriver:   (id: number) => api.get(`/api/drivers/${id}/documents`),
  uploadDriver: (id: number, file: File, docType: string) => {
    const form = new FormData(); form.append('file', file); form.append('doc_type', docType)
    return api.post(`/api/drivers/${id}/documents`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  viewDriver:   (driverId: number, docId: number) => api.get(`/api/drivers/${driverId}/documents/${docId}/url`),
  deleteDriver: (driverId: number, docId: number) => api.delete(`/api/drivers/${driverId}/documents/${docId}`),
  listTruck:    (id: number) => api.get(`/api/trucks/${id}/documents`),
  uploadTruck:  (id: number, file: File, docType: string) => {
    const form = new FormData(); form.append('file', file); form.append('doc_type', docType)
    return api.post(`/api/trucks/${id}/documents`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  viewTruck:    (truckId: number, docId: number) => api.get(`/api/trucks/${truckId}/documents/${docId}/url`),
  deleteTruck:  (truckId: number, docId: number) => api.delete(`/api/trucks/${truckId}/documents/${docId}`),
  listCompany:  () => api.get('/api/documents/company'),
  uploadCompany:(file: File, docType: string) => {
    const form = new FormData(); form.append('file', file); form.append('doc_type', docType)
    return api.post('/api/documents/company', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  viewCompany:  (docId: number) => api.get(`/api/documents/company/${docId}/url`),
  deleteCompany:(docId: number) => api.delete(`/api/documents/company/${docId}`),
}

const DRIVER_DOC_TYPES = ['CDL License', 'Medical Card', 'Driver Insurance', 'Drug Test', 'Other']
const TRUCK_DOC_TYPES  = ['Registration', 'Annual Inspection', 'Truck Insurance', 'Title', 'Other']
const COMPANY_DOC_TYPES = ['MC Authority', 'W9', 'Company Insurance', 'DOT Certificate', 'Other']

export default function FleetPage() {
  const [tab, setTab] = useState<'drivers'|'trucks'|'documents'>('drivers')
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

  // Documents state
  const [docTab, setDocTab] = useState<'driver'|'truck'|'company'>('driver')
  const [selDriverForDoc, setSelDriverForDoc] = useState<any>(null)
  const [selTruckForDoc,  setSelTruckForDoc]  = useState<any>(null)
  const [driverDocs, setDriverDocs] = useState<any[]>([])
  const [truckDocs,  setTruckDocs]  = useState<any[]>([])
  const [companyDocs, setCompanyDocs] = useState<any[]>([])
  const [docsLoading, setDocsLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [d, t] = await Promise.all([driversApi.list(!showAll), trucksApi.list(!showAll)])
      setDrivers(d.data)
      setTrucks(t.data)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [showAll])

  // Load company docs when documents tab opens
  useEffect(() => {
    if (tab === 'documents') loadCompanyDocs()
  }, [tab])

  const loadCompanyDocs = async () => {
    try { const r = await fleetDocsApi.listCompany(); setCompanyDocs(r.data) } catch {}
  }

  const loadDriverDocs = async (driver: any) => {
    setSelDriverForDoc(driver); setDriverDocs([]); setDocsLoading(true)
    try { const r = await fleetDocsApi.listDriver(driver.id); setDriverDocs(r.data) } catch {}
    finally { setDocsLoading(false) }
  }

  const loadTruckDocs = async (truck: any) => {
    setSelTruckForDoc(truck); setTruckDocs([]); setDocsLoading(true)
    try { const r = await fleetDocsApi.listTruck(truck.id); setTruckDocs(r.data) } catch {}
    finally { setDocsLoading(false) }
  }

  const saveDriver = async () => {
    if (!driverForm.name?.trim()) { toast.error('Driver name is required'); return }
    try {
      const payload = { ...driverForm, pay_rate: Number(driverForm.pay_rate) || 0.28 }
      if (editDriverId) { await driversApi.update(editDriverId, payload) } else { await driversApi.create(payload) }
      toast.success(editDriverId ? 'Driver updated ✅' : 'Driver added ✅')
      setShowDriverForm(false); setEditDriverId(null); setDriverForm({ ...EMPTY_DRIVER }); load()
    } catch (e: any) {
      toast.error(e.response?.data?.detail || e.message || 'Failed to save driver')
    }
  }

  const saveTruck = async () => {
    if (!truckForm.unit_number?.trim()) { toast.error('Unit number is required'); return }
    try {
      if (editTruckId) { await trucksApi.update(editTruckId, truckForm) } else { await trucksApi.create(truckForm) }
      toast.success(editTruckId ? 'Truck updated ✅' : 'Truck added ✅')
      setShowTruckForm(false); setEditTruckId(null); setTruckForm({ ...EMPTY_TRUCK }); load()
    } catch (e: any) {
      toast.error(e.response?.data?.detail || e.message || 'Failed to save truck')
    }
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
    const res = await driversApi.stats(id); setDriverStats(res.data)
  }

  const inputClass = "w-full px-3 py-2 rounded-lg text-sm border outline-none"
  const inputStyle = { borderColor: '#E2E8F0', background: '#FAFAF9' }
  const labelStyle = { color: '#64748B' }

  // ── Doc upload component ──────────────────────────────────────────────────
  const DocGrid = ({ docTypes, docs, onUpload, onView, onDelete }: {
    docTypes: string[], docs: any[],
    onUpload: (file: File, dt: string) => void,
    onView: (doc: any) => void,
    onDelete: (doc: any) => void,
  }) => {
    const [uploading, setUploading] = useState<string|null>(null)
    return (
      <div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {docTypes.map(dt => {
            const doc = docs.find(d => d.doc_type === dt)
            const isUploading = uploading === dt
            return (
              <div key={dt} className="rounded-xl border-2 p-3 flex flex-col gap-2 transition-all"
                style={{
                  borderColor: doc ? '#BBF7D0' : isUploading ? '#FDE68A' : '#E2E8F0',
                  borderStyle: doc ? 'solid' : 'dashed',
                  background: doc ? '#F0FDF4' : isUploading ? '#FFFBEB' : 'white'
                }}>
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold" style={{ color: doc ? '#16A34A' : '#64748B' }}>{dt}</div>
                  {doc && <span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ background: '#DCFCE7', color: '#16A34A' }}>✓</span>}
                </div>
                {doc ? (
                  <div className="flex gap-2">
                    <button onClick={() => onView(doc)}
                      className="flex-1 text-xs py-1.5 rounded-lg font-semibold"
                      style={{ background: '#EFF6FF', color: '#2563EB' }}>👁 View</button>
                    <button onClick={() => onDelete(doc)}
                      className="text-xs px-2 py-1 rounded-lg"
                      style={{ background: '#FEE2E2', color: '#DC2626' }}>🗑</button>
                  </div>
                ) : (
                  <label className={isUploading ? 'cursor-wait' : 'cursor-pointer'}>
                    <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" disabled={isUploading}
                      onChange={async e => {
                        if (!e.target.files?.[0] || isUploading) return
                        setUploading(dt)
                        await onUpload(e.target.files[0], dt)
                        setUploading(null)
                      }} />
                    <div className="text-xs py-1.5 text-center rounded-lg font-semibold"
                      style={{ background: isUploading ? '#FDE68A' : '#F1EFE8', color: isUploading ? '#92400E' : '#94A3B8' }}>
                      {isUploading ? '⏳ Uploading...' : '⬆ Upload'}
                    </div>
                  </label>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

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
        {(['drivers','trucks','documents'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-5 py-2 rounded-lg text-sm font-medium capitalize transition-all"
            style={{
              background: tab === t ? 'white' : 'transparent',
              color: tab === t ? '#1A1A2E' : '#94A3B8',
              boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}>
            {t === 'drivers' ? `Drivers (${drivers.length})` : t === 'trucks' ? `Trucks (${trucks.length})` : '📁 Documents'}
          </button>
        ))}
      </div>

      {/* Drivers */}
      {tab === 'drivers' && (
        <div className="grid grid-cols-2 gap-4">
          {loading ? (
            <div className="col-span-2 py-8">
              {[1,2].map(i => <div key={i} className="h-40 rounded-2xl mb-4 animate-pulse" style={{ background: '#F1EFE8' }} />)}
            </div>
          ) :
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
                <button onClick={() => { setTab('documents'); setDocTab('driver'); loadDriverDocs(d) }}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: '#EDE9FE', color: '#7C3AED' }}>📁 Docs</button>
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
          {loading ? (
            <div className="col-span-3 py-8">
              {[1,2,3].map(i => <div key={i} className="h-36 rounded-2xl animate-pulse" style={{ background: '#F1EFE8' }} />)}
            </div>
          ) :
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
              <div className="text-xs mb-4" style={{ color: '#94A3B8' }}>VIN: {t.vin || '—'}</div>
              <div className="flex gap-2">
                <button onClick={() => { setTab('documents'); setDocTab('truck'); loadTruckDocs(t) }}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: '#EDE9FE', color: '#7C3AED' }}>📁 Docs</button>
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

      {/* Documents Tab */}
      {tab === 'documents' && (
        <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
          {/* Sub-tabs */}
          <div className="flex gap-1 p-1 rounded-xl mb-6 w-fit" style={{ background: '#F1EFE8' }}>
            {(['driver','truck','company'] as const).map(t => (
              <button key={t} onClick={() => setDocTab(t)}
                className="px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all"
                style={{
                  background: docTab === t ? 'white' : 'transparent',
                  color: docTab === t ? '#1A1A2E' : '#94A3B8',
                  boxShadow: docTab === t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                }}>
                {t === 'driver' ? '👤 Driver Docs' : t === 'truck' ? '🚛 Truck Docs' : '🏢 Company Docs'}
              </button>
            ))}
          </div>

          {/* Driver Docs */}
          {docTab === 'driver' && (
            <div>
              {!selDriverForDoc ? (
                <div>
                  <div className="text-sm font-semibold mb-4" style={{ color: '#64748B' }}>Select a driver to manage documents:</div>
                  <div className="grid grid-cols-3 gap-3">
                    {drivers.map(d => (
                      <button key={d.id} onClick={() => loadDriverDocs(d)}
                        className="p-4 rounded-xl text-left border-2 hover:border-amber-400 transition-all"
                        style={{ borderColor: '#E2E8F0' }}>
                        <div className="font-semibold text-sm" style={{ color: '#1A1A2E' }}>{d.name}</div>
                        <div className="text-xs" style={{ color: '#94A3B8' }}>{d.type_label}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-3 mb-5">
                    <button onClick={() => setSelDriverForDoc(null)}
                      className="text-xs px-3 py-1.5 rounded-lg" style={{ background: '#F1EFE8', color: '#64748B' }}>← Back</button>
                    <div className="font-semibold" style={{ color: '#1A1A2E' }}>📁 {selDriverForDoc.name} — Documents</div>
                  </div>
                  {docsLoading ? <div className="text-center py-8" style={{ color: '#94A3B8' }}>Loading...</div> : (
                    <DocGrid
                      docTypes={DRIVER_DOC_TYPES}
                      docs={driverDocs}
                      onUpload={async (file, dt) => {
                        try {
                          await fleetDocsApi.uploadDriver(selDriverForDoc.id, file, dt)
                          const r = await fleetDocsApi.listDriver(selDriverForDoc.id); setDriverDocs(r.data)
                          toast.success(`${dt} uploaded ✅`)
                        } catch (e: any) { toast.error(e.response?.data?.detail || 'Upload failed') }
                      }}
                      onView={async (doc) => {
                        try {
                          const r = await fleetDocsApi.viewDriver(selDriverForDoc.id, doc.id)
                          window.open(r.data.url, '_blank')
                        } catch { toast.error('Could not open file') }
                      }}
                      onDelete={async (doc) => {
                        if (!confirm(`Delete ${doc.doc_type}?`)) return
                        try {
                          await fleetDocsApi.deleteDriver(selDriverForDoc.id, doc.id)
                          const r = await fleetDocsApi.listDriver(selDriverForDoc.id); setDriverDocs(r.data)
                          toast.success('Deleted')
                        } catch { toast.error('Delete failed') }
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Truck Docs */}
          {docTab === 'truck' && (
            <div>
              {!selTruckForDoc ? (
                <div>
                  <div className="text-sm font-semibold mb-4" style={{ color: '#64748B' }}>Select a truck to manage documents:</div>
                  <div className="grid grid-cols-3 gap-3">
                    {trucks.map(t => (
                      <button key={t.id} onClick={() => loadTruckDocs(t)}
                        className="p-4 rounded-xl text-left border-2 hover:border-amber-400 transition-all"
                        style={{ borderColor: '#E2E8F0' }}>
                        <div className="font-semibold text-sm" style={{ color: '#1A1A2E' }}>{t.unit_number}</div>
                        <div className="text-xs" style={{ color: '#94A3B8' }}>{[t.year, t.make, t.model].filter(Boolean).join(' ') || 'No details'}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-3 mb-5">
                    <button onClick={() => setSelTruckForDoc(null)}
                      className="text-xs px-3 py-1.5 rounded-lg" style={{ background: '#F1EFE8', color: '#64748B' }}>← Back</button>
                    <div className="font-semibold" style={{ color: '#1A1A2E' }}>🚛 {selTruckForDoc.unit_number} — Documents</div>
                  </div>
                  {docsLoading ? <div className="text-center py-8" style={{ color: '#94A3B8' }}>Loading...</div> : (
                    <DocGrid
                      docTypes={TRUCK_DOC_TYPES}
                      docs={truckDocs}
                      onUpload={async (file, dt) => {
                        try {
                          await fleetDocsApi.uploadTruck(selTruckForDoc.id, file, dt)
                          const r = await fleetDocsApi.listTruck(selTruckForDoc.id); setTruckDocs(r.data)
                          toast.success(`${dt} uploaded ✅`)
                        } catch (e: any) { toast.error(e.response?.data?.detail || 'Upload failed') }
                      }}
                      onView={async (doc) => {
                        try {
                          const r = await fleetDocsApi.viewTruck(selTruckForDoc.id, doc.id)
                          window.open(r.data.url, '_blank')
                        } catch { toast.error('Could not open file') }
                      }}
                      onDelete={async (doc) => {
                        if (!confirm(`Delete ${doc.doc_type}?`)) return
                        try {
                          await fleetDocsApi.deleteTruck(selTruckForDoc.id, doc.id)
                          const r = await fleetDocsApi.listTruck(selTruckForDoc.id); setTruckDocs(r.data)
                          toast.success('Deleted')
                        } catch { toast.error('Delete failed') }
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Company Docs */}
          {docTab === 'company' && (
            <div>
              <div className="font-semibold mb-5" style={{ color: '#1A1A2E' }}>🏢 Company Documents</div>
              <DocGrid
                docTypes={COMPANY_DOC_TYPES}
                docs={companyDocs}
                onUpload={async (file, dt) => {
                  try {
                    await fleetDocsApi.uploadCompany(file, dt)
                    await loadCompanyDocs()
                    toast.success(`${dt} uploaded ✅`)
                  } catch (e: any) { toast.error(e.response?.data?.detail || 'Upload failed') }
                }}
                onView={async (doc) => {
                  try {
                    const r = await fleetDocsApi.viewCompany(doc.id)
                    window.open(r.data.url, '_blank')
                  } catch { toast.error('Could not open file') }
                }}
                onDelete={async (doc) => {
                  if (!confirm(`Delete ${doc.doc_type}?`)) return
                  try {
                    await fleetDocsApi.deleteCompany(doc.id)
                    await loadCompanyDocs()
                    toast.success('Deleted')
                  } catch { toast.error('Delete failed') }
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Driver Form Modal */}
      {showDriverForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowDriverForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowTruckForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setDriverStats(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
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
