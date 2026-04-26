'use client'
import { useEffect, useState } from 'react'
import { loadsApi, accountingApi } from '@/lib/api'
import Link from 'next/link'

const STATUS_COLORS: Record<string, string> = {
  Booked: '#3B82F6', Dispatched: '#8B5CF6', 'In Transit': '#F59E0B',
  Delivered: '#10B981', Invoiced: '#06B6D4', Paid: '#6B7280',
  TONU: '#EF4444', Void: '#9CA3AF',
}

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [loads, setLoads] = useState<any[]>([])
  const [outstanding, setOutstanding] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      loadsApi.stats(),
      loadsApi.list({ limit: 8 }),
      accountingApi.outstanding(),
    ]).then(([s, l, o]) => {
      setStats(s.data)
      setLoads(l.data)
      setOutstanding(o.data)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: '#F0A500', borderTopColor: 'transparent' }} />
    </div>
  )

  const kpis = [
    { label: 'Total Loads', value: stats?.total_loads ?? 0, icon: '⊞', color: '#3B82F6', sub: `${stats?.booked_loads ?? 0} active` },
    { label: 'Total Revenue', value: `$${(stats?.total_revenue ?? 0).toLocaleString()}`, icon: '◈', color: '#F0A500', sub: 'all time' },
    { label: 'Pending Invoice', value: `$${(stats?.pending_invoice ?? 0).toLocaleString()}`, icon: '◎', color: '#F59E0B', sub: 'needs collection' },
    { label: 'Active Drivers', value: stats?.active_drivers ?? 0, icon: '◉', color: '#10B981', sub: `${stats?.active_trucks ?? 0} trucks` },
  ]

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1A1A2E', fontFamily: 'Playfair Display, serif' }}>
            Dashboard
          </h1>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Link href="/dispatch"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
          style={{ background: '#F0A500', boxShadow: '0 4px 16px rgba(240,165,0,0.3)' }}>
          + New Load
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-5 mb-8">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl p-5 bg-white"
            style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl" style={{ color: k.color }}>{k.icon}</span>
              <span className="text-xs px-2 py-1 rounded-full" style={{ background: '#F8F7F4', color: '#64748B' }}>
                {k.sub}
              </span>
            </div>
            <div className="text-2xl font-bold mb-1" style={{ color: '#1A1A2E' }}>{k.value}</div>
            <div className="text-xs" style={{ color: '#94A3B8' }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Recent Loads */}
        <div className="col-span-2 bg-white rounded-2xl p-6"
          style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold" style={{ color: '#1A1A2E' }}>Recent Loads</h2>
            <Link href="/dispatch" className="text-sm font-medium" style={{ color: '#F0A500' }}>View all →</Link>
          </div>
          <div className="space-y-3">
            {loads.length === 0 && (
              <div className="text-center py-8" style={{ color: '#94A3B8' }}>
                No loads yet. <Link href="/dispatch" style={{ color: '#F0A500' }}>Create your first load →</Link>
              </div>
            )}
            {loads.map((l: any) => (
              <div key={l.id} className="flex items-center justify-between py-3 border-b last:border-0"
                style={{ borderColor: '#F1EFE8' }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: STATUS_COLORS[l.status] || '#6B7280' }}>
                    {l.load_number}
                  </div>
                  <div>
                    <div className="text-sm font-medium" style={{ color: '#1A1A2E' }}>{l.broker_name || 'No broker'}</div>
                    <div className="text-xs" style={{ color: '#94A3B8' }}>{l.route}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold" style={{ color: '#1A1A2E' }}>
                    ${l.freight_rate?.toLocaleString()}
                  </span>
                  <span className="text-xs px-2 py-1 rounded-full font-medium"
                    style={{ background: `${STATUS_COLORS[l.status]}20`, color: STATUS_COLORS[l.status] }}>
                    {l.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Outstanding */}
        <div className="bg-white rounded-2xl p-6"
          style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold" style={{ color: '#1A1A2E' }}>Needs Attention</h2>
            <Link href="/reports" className="text-sm font-medium" style={{ color: '#F0A500' }}>Reports →</Link>
          </div>
          {outstanding?.count === 0 ? (
            <div className="text-center py-8">
              <div className="text-3xl mb-2">✅</div>
              <div className="text-sm" style={{ color: '#64748B' }}>All loads are up to date</div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 rounded-xl" style={{ background: '#FEF9EE', border: '1px solid #FDE68A' }}>
                <div className="text-sm font-semibold" style={{ color: '#92400E' }}>
                  {outstanding?.count} loads need attention
                </div>
                <div className="text-xs mt-1" style={{ color: '#B45309' }}>
                  ${outstanding?.total?.toLocaleString()} total value
                </div>
              </div>
              {outstanding?.loads?.slice(0, 4).map((l: any) => (
                <div key={l.id} className="flex items-center gap-2 py-2 border-b last:border-0"
                  style={{ borderColor: '#F1EFE8' }}>
                  <div className="flex-1">
                    <div className="text-xs font-medium" style={{ color: '#1A1A2E' }}>#{l.load_number} — {l.broker_name}</div>
                    <div className="flex gap-2 mt-1">
                      {!l.rc && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#FEE2E2', color: '#DC2626' }}>No RC</span>}
                      {!l.bol && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#FEE2E2', color: '#DC2626' }}>No BOL</span>}
                      {l.needs_payment && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#FEF9EE', color: '#D97706' }}>Unpaid</span>}
                    </div>
                  </div>
                  <span className="text-xs font-semibold" style={{ color: '#1A1A2E' }}>${l.freight_rate?.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
