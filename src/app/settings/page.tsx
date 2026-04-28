'use client'
import { useEffect, useState } from 'react'
import { settingsApi } from '@/lib/api'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const [tab, setTab] = useState<'company'|'email'|'system'>('company')
  const [company, setCompany] = useState<any>({})
  const [smtp, setSmtp] = useState<any>({})
  const [loadStart, setLoadStart] = useState('1')
  const [stats, setStats] = useState<any>({})
  const [testEmail, setTestEmail] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    Promise.all([settingsApi.getCompany(), settingsApi.getAll(), settingsApi.stats()])
      .then(([c, s, st]) => {
        setCompany(c.data)
        setSmtp(s.data)
        setStats(st.data)
        if (s.data?.load_number_start) setLoadStart(s.data.load_number_start)
      })
  }, [])

  const saveCompany = async () => {
    setLoading(true)
    try {
      await settingsApi.saveCompany(company)
      toast.success('Company profile saved')
    } catch { toast.error('Failed to save') } finally { setLoading(false) }
  }

  const saveLoadStart = async () => {
    try {
      const n = parseInt(loadStart)
      if (isNaN(n) || n < 1) { toast.error('Enter a valid number (minimum 1)'); return }
      await settingsApi.set('load_number_start', String(n))
      toast.success(`Load numbers will start from ${String(n).padStart(4,'0')} ✅`)
    } catch { toast.error('Failed to save') }
  }

  const saveSmtp = async () => {
    setLoading(true)
    try {
      for (const [k, v] of Object.entries(smtp)) {
        if (v) await settingsApi.set(k, v as string)
      }
      toast.success('Email settings saved')
    } catch { toast.error('Failed to save') } finally { setLoading(false) }
  }

  const sendTest = async () => {
    if (!testEmail) { toast.error('Enter an email address'); return }
    setLoading(true)
    try {
      await settingsApi.testEmail(testEmail)
      toast.success(`Test email sent to ${testEmail}`)
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed to send test email')
    } finally { setLoading(false) }
  }

  const clearAll = async () => {
    if (!confirm('This will DELETE ALL loads, documents, and payroll records permanently. Are you absolutely sure?')) return
    if (!confirm('Final confirmation — this cannot be undone. Continue?')) return
    setLoading(true)
    try {
      await settingsApi.clearAll()
      toast.success('All data cleared')
    } catch (e: any) { toast.error(e.response?.data?.detail || 'Failed') } finally { setLoading(false) }
  }

  const inputClass = "w-full px-3 py-2 rounded-lg text-sm border outline-none"
  const inputStyle = { borderColor: '#E2E8F0', background: '#FAFAF9' }
  const labelStyle = { color: '#64748B' }

  return (
    <div className="animate-fade-in max-w-2xl">
      <h1 className="text-2xl font-bold mb-6" style={{ color: '#1A1A2E', fontFamily: 'Playfair Display, serif' }}>Settings</h1>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl mb-6 w-fit" style={{ background: '#F1EFE8' }}>
        {([['company','Company'],['email','Email'],['system','System']] as const).map(([t,l]) => (
          <button key={t} onClick={() => setTab(t)}
            className="px-5 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ background: tab === t ? 'white' : 'transparent', color: tab === t ? '#1A1A2E' : '#94A3B8',
              boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
            {l}
          </button>
        ))}
      </div>

      {/* Company */}
      {tab === 'company' && (
        <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
          <h2 className="font-bold mb-5" style={{ color: '#1A1A2E' }}>Company Profile</h2>
          <div className="space-y-4">
            {[['name','Company Name *'],['mc_number','MC Number'],['dot_number','DOT Number'],
              ['address','Address'],['phone','Phone'],['email','Email']].map(([k,l]) => (
              <div key={k}>
                <label className="block text-xs font-medium mb-1" style={labelStyle}>{l}</label>
                <input className={inputClass} style={inputStyle} value={company[k] || ''}
                  onChange={e => setCompany((p: any) => ({ ...p, [k]: e.target.value }))} />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium mb-1" style={labelStyle}>
                Company Percentage — {Math.round((company.company_pct || 0.12) * 100)}%
              </label>
              <input type="range" min="0.05" max="0.50" step="0.01"
                value={company.company_pct || 0.12}
                onChange={e => setCompany((p: any) => ({ ...p, company_pct: Number(e.target.value) }))}
                className="w-full" style={{ accentColor: '#F0A500' }} />
              <div className="text-xs mt-1" style={{ color: '#94A3B8' }}>
                Company keeps {Math.round((company.company_pct || 0.12) * 100)}% of gross revenue
              </div>
            </div>
          </div>
          <button onClick={saveCompany} disabled={loading}
            className="w-full mt-6 py-3 rounded-xl text-sm font-semibold text-white"
            style={{ background: '#F0A500' }}>
            {loading ? 'Saving...' : 'Save Company Profile'}
          </button>
        </div>
      )}

      {tab === 'company' && (
        <div className="bg-white rounded-2xl p-6 mt-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
          <h2 className="font-bold mb-5" style={{ color: '#1A1A2E' }}>🔢 Load Number Settings</h2>
          <label className="block text-xs font-medium mb-1" style={{ color: '#64748B' }}>Starting Load Number</label>
          <div className="flex gap-3 items-center mb-3">
            <input type="number" min="1"
              className="px-3 py-2 rounded-lg text-sm border outline-none w-32"
              style={{ borderColor: '#E2E8F0', background: '#FAFAF9' }}
              value={loadStart}
              onChange={e => setLoadStart(e.target.value)} />
            <span className="text-sm" style={{ color: '#94A3B8' }}>
              → Next load: <strong style={{ color: '#1A1A2E' }}>#{String(parseInt(loadStart) || 1).padStart(4,'0')}</strong>
            </span>
            <button onClick={saveLoadStart}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: '#F0A500' }}>
              Save
            </button>
          </div>
          <div className="text-xs" style={{ color: '#94A3B8' }}>
            Set this before your first load. System auto-increments from this number.
            If loads already exist, the next number will be whichever is higher.
          </div>
        </div>
      )}

      {/* Email */}
      {tab === 'email' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <h2 className="font-bold mb-5" style={{ color: '#1A1A2E' }}>SMTP Configuration</h2>
            <div className="space-y-4">
              {[['smtp_host','SMTP Host','smtp.gmail.com'],['smtp_port','SMTP Port','587'],
                ['smtp_user','SMTP Username (Email)',''],['smtp_from','From Address','']].map(([k,l,ph]) => (
                <div key={k}>
                  <label className="block text-xs font-medium mb-1" style={labelStyle}>{l}</label>
                  <input className={inputClass} style={inputStyle} placeholder={ph} value={smtp[k] || ''}
                    onChange={e => setSmtp((p: any) => ({ ...p, [k]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium mb-1" style={labelStyle}>SMTP Password</label>
                <input type="password" className={inputClass} style={inputStyle}
                  placeholder="App password (for Gmail)"
                  onChange={e => setSmtp((p: any) => ({ ...p, smtp_pass: e.target.value }))} />
              </div>
            </div>
            <button onClick={saveSmtp} disabled={loading}
              className="w-full mt-5 py-3 rounded-xl text-sm font-semibold text-white"
              style={{ background: '#F0A500' }}>
              Save Email Settings
            </button>
          </div>

          <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <h2 className="font-bold mb-4" style={{ color: '#1A1A2E' }}>Send Test Email</h2>
            <div className="flex gap-3">
              <input className={`flex-1 ${inputClass}`} style={inputStyle}
                placeholder="test@example.com" value={testEmail}
                onChange={e => setTestEmail(e.target.value)} />
              <button onClick={sendTest} disabled={loading}
                className="px-5 py-2 rounded-xl text-sm font-semibold text-white whitespace-nowrap"
                style={{ background: '#1A1A2E' }}>
                Send Test
              </button>
            </div>
          </div>
        </div>
      )}

      {/* System */}
      {tab === 'system' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <h2 className="font-bold mb-5" style={{ color: '#1A1A2E' }}>System Stats</h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                ['Total Loads', stats.total_loads],
                ['Total Revenue', `$${stats.total_revenue?.toLocaleString()}`],
                ['Active Drivers', stats.active_drivers],
                ['Active Trucks', stats.active_trucks],
                ['Paid Loads', stats.paid_loads],
                ['Booked Loads', stats.booked_loads],
              ].map(([l,v]) => (
                <div key={l as string} className="p-4 rounded-xl" style={{ background: '#F8F7F4' }}>
                  <div className="text-xs mb-1" style={{ color: '#94A3B8' }}>{l}</div>
                  <div className="text-xl font-bold" style={{ color: '#1A1A2E' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)', border: '1px solid #FEE2E2' }}>
            <h2 className="font-bold mb-2" style={{ color: '#DC2626' }}>Danger Zone</h2>
            <p className="text-sm mb-5" style={{ color: '#64748B' }}>
              Clear ALL loads, documents, and payroll records. Keeps drivers, trucks, and company profile. This cannot be undone.
            </p>
            <button onClick={clearAll} disabled={loading}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: '#DC2626' }}>
              Clear All Loads — Go Live Reset
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
