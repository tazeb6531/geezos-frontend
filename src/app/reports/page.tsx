'use client'
import { useEffect, useState } from 'react'
import { accountingApi, loadsApi } from '@/lib/api'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts'

export default function ReportsPage() {
  const [tab, setTab] = useState<'overview'|'broker'|'driver'|'route'|'outstanding'>('overview')
  const [summary, setSummary] = useState<any>(null)
  const [byBroker, setByBroker] = useState<any[]>([])
  const [byDriver, setByDriver] = useState<any[]>([])
  const [byMonth, setByMonth] = useState<any[]>([])
  const [byRoute, setByRoute] = useState<any[]>([])
  const [outstanding, setOutstanding] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      accountingApi.summary(),
      accountingApi.byBroker(),
      accountingApi.byDriver(),
      accountingApi.byMonth(),
      accountingApi.byRoute(),
      accountingApi.outstanding(),
    ]).then(([s,b,d,m,r,o]) => {
      setSummary(s.data); setByBroker(b.data); setByDriver(d.data)
      setByMonth(m.data); setByRoute(r.data); setOutstanding(o.data)
    }).finally(() => setLoading(false))
  }, [])

  const exportCsv = async () => {
    const res = await loadsApi.exportCsv()
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const a = document.createElement('a'); a.href = url
    a.download = `geezos_loads_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: '#F0A500', borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#1A1A2E', fontFamily: 'Playfair Display, serif' }}>Reports</h1>
        <button onClick={exportCsv}
          className="px-4 py-2 rounded-xl text-sm font-medium border"
          style={{ borderColor: '#E2E8F0', color: '#64748B' }}>
          Export CSV
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Total Loads', value: summary?.total_loads },
          { label: 'Total Revenue', value: `$${summary?.total_revenue?.toLocaleString()}`, gold: true },
          { label: 'Avg Rate', value: `$${summary?.avg_rate?.toLocaleString()}` },
          { label: 'Pending Invoice', value: `$${summary?.pending_invoice?.toLocaleString()}` },
          { label: 'Paid Loads', value: summary?.paid_loads },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl p-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <div className="text-xs mb-1" style={{ color: '#94A3B8' }}>{k.label}</div>
            <div className="text-xl font-bold" style={{ color: k.gold ? '#F0A500' : '#1A1A2E' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl mb-6 w-fit" style={{ background: '#F1EFE8' }}>
        {([['overview','Overview'],['broker','By Broker'],['driver','By Driver'],['route','By Route'],['outstanding','Outstanding']] as const).map(([t,l]) => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 rounded-lg text-xs font-medium transition-all"
            style={{ background: tab === t ? 'white' : 'transparent', color: tab === t ? '#1A1A2E' : '#94A3B8',
              boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
            {l}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <h2 className="font-semibold mb-4" style={{ color: '#1A1A2E' }}>Revenue by Month</h2>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={byMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1EFE8" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} />
                <Tooltip formatter={(v: any) => [`$${v?.toLocaleString()}`, 'Revenue']} />
                <Line type="monotone" dataKey="revenue" stroke="#F0A500" strokeWidth={2} dot={{ fill: '#F0A500' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <h2 className="font-semibold mb-4" style={{ color: '#1A1A2E' }}>Top Routes</h2>
            {byRoute.slice(0,6).map((r: any) => (
              <div key={r.route} className="flex items-center justify-between py-2 border-b" style={{ borderColor: '#F1EFE8' }}>
                <div className="text-sm font-medium" style={{ color: '#1A1A2E' }}>{r.route}</div>
                <div className="text-right">
                  <div className="text-sm font-bold" style={{ color: '#F0A500' }}>${r.revenue?.toLocaleString()}</div>
                  <div className="text-xs" style={{ color: '#94A3B8' }}>{r.loads} loads</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* By Broker */}
      {tab === 'broker' && (
        <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
          <h2 className="font-semibold mb-5" style={{ color: '#1A1A2E' }}>Revenue by Broker</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={byBroker.slice(0,10)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1EFE8" />
              <XAxis dataKey="broker" tick={{ fontSize: 10, fill: '#94A3B8' }} />
              <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} />
              <Tooltip formatter={(v: any) => [`$${v?.toLocaleString()}`, 'Revenue']} />
              <Bar dataKey="revenue" fill="#F0A500" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
          <table className="w-full mt-5">
            <thead>
              <tr style={{ borderBottom: '1px solid #F1EFE8' }}>
                {['Broker','Loads','Revenue','Avg Rate'].map(h => (
                  <th key={h} className="text-left py-2 text-xs font-semibold" style={{ color: '#94A3B8' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byBroker.map((b: any) => (
                <tr key={b.broker} className="border-b" style={{ borderColor: '#F1EFE8' }}>
                  <td className="py-2 text-sm font-medium" style={{ color: '#1A1A2E' }}>{b.broker}</td>
                  <td className="py-2 text-sm" style={{ color: '#64748B' }}>{b.loads}</td>
                  <td className="py-2 text-sm font-semibold" style={{ color: '#F0A500' }}>${b.revenue?.toLocaleString()}</td>
                  <td className="py-2 text-sm" style={{ color: '#64748B' }}>${b.avg_rate?.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* By Driver */}
      {tab === 'driver' && (
        <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
          <h2 className="font-semibold mb-5" style={{ color: '#1A1A2E' }}>Revenue by Driver</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={byDriver}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1EFE8" />
              <XAxis dataKey="driver" tick={{ fontSize: 10, fill: '#94A3B8' }} />
              <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} />
              <Tooltip formatter={(v: any) => [`$${v?.toLocaleString()}`, 'Revenue']} />
              <Bar dataKey="revenue" fill="#1A1A2E" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* By Route */}
      {tab === 'route' && (
        <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
          <table className="w-full">
            <thead>
              <tr style={{ background: '#F8F7F4', borderBottom: '1px solid #F1EFE8' }}>
                {['Route','Loads','Revenue'].map(h => (
                  <th key={h} className="text-left px-6 py-3 text-xs font-semibold" style={{ color: '#94A3B8' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byRoute.map((r: any) => (
                <tr key={r.route} className="border-b hover:bg-gray-50" style={{ borderColor: '#F1EFE8' }}>
                  <td className="px-6 py-3 text-sm font-medium" style={{ color: '#1A1A2E' }}>
                    <span style={{ color: '#F0A500' }}>{r.origin_state}</span>
                    {' → '}
                    <span style={{ color: '#1A1A2E' }}>{r.destination_state}</span>
                  </td>
                  <td className="px-6 py-3 text-sm" style={{ color: '#64748B' }}>{r.loads}</td>
                  <td className="px-6 py-3 text-sm font-bold" style={{ color: '#F0A500' }}>${r.revenue?.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Outstanding */}
      {tab === 'outstanding' && (
        <div>
          {outstanding?.count > 0 && (
            <div className="p-4 rounded-xl mb-5" style={{ background: '#FEF9EE', border: '1px solid #FDE68A' }}>
              <span className="text-sm font-semibold" style={{ color: '#92400E' }}>
                {outstanding.count} loads need attention — ${outstanding.total?.toLocaleString()} total
              </span>
            </div>
          )}
          <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: '#F8F7F4', borderBottom: '1px solid #F1EFE8' }}>
                  {['Load #','Broker','Driver','Route','Rate','RC','BOL','Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold" style={{ color: '#94A3B8' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {outstanding?.loads?.map((l: any) => (
                  <tr key={l.id} className="border-b hover:bg-gray-50" style={{ borderColor: '#F1EFE8' }}>
                    <td className="px-4 py-3 text-sm font-bold" style={{ color: '#1A1A2E' }}>#{l.load_number}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: '#64748B' }}>{l.broker_name}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: '#64748B' }}>{l.driver_name}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#64748B' }}>{l.route}</td>
                    <td className="px-4 py-3 text-sm font-semibold" style={{ color: '#F0A500' }}>${l.freight_rate?.toLocaleString()}</td>
                    <td className="px-4 py-3">{l.rc ? '✅' : '❌'}</td>
                    <td className="px-4 py-3">{l.bol ? '✅' : '❌'}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-full"
                        style={{ background: l.needs_payment ? '#FEF9EE' : '#F0FDF4',
                          color: l.needs_payment ? '#D97706' : '#16A34A' }}>
                        {l.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
