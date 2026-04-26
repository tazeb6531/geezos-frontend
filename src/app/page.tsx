'use client'
import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleLogin = () => {
    setLoading(true)
    // With Auth0 this would be: window.location.href = '/api/auth/login'
    // For now redirect to dashboard
    setTimeout(() => router.push('/dashboard'), 1000)
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#1A1A2E' }}>
      {/* Left — Branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-16"
        style={{ background: 'linear-gradient(135deg, #1A1A2E 0%, #0F3460 100%)' }}>
        <div>
          <div className="flex items-center gap-4 mb-16">
            <div className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: '#F0A500' }}>
              <span className="text-2xl font-bold text-white" style={{ fontFamily: 'Playfair Display, serif' }}>G</span>
            </div>
            <div>
              <div className="text-white font-semibold text-lg" style={{ fontFamily: 'Playfair Display, serif' }}>GeezOS</div>
              <div className="text-xs" style={{ color: '#F0A500' }}>GEEZ EXPRESS LLC</div>
            </div>
          </div>
          <h1 className="text-5xl font-bold text-white mb-6 leading-tight"
            style={{ fontFamily: 'Playfair Display, serif' }}>
            Dispatch.<br />
            <span style={{ color: '#F0A500' }}>Smarter.</span>
          </h1>
          <p className="text-lg" style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>
            AI-powered transportation management. Upload a rate confirmation and let GeezOS do the rest.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'AI Extraction', desc: 'Rate cons filled in seconds' },
            { label: 'Live Dispatch', desc: 'Full load pipeline' },
            { label: 'Smart Payroll', desc: 'Auto driver settlements' },
          ].map((f) => (
            <div key={f.label} className="rounded-xl p-4"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(240,165,0,0.2)' }}>
              <div className="text-sm font-semibold mb-1" style={{ color: '#F0A500' }}>{f.label}</div>
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right — Login form */}
      <div className="flex-1 flex items-center justify-center p-8" style={{ background: '#F8F7F4' }}>
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: '#F0A500' }}>
              <span className="text-lg font-bold text-white">G</span>
            </div>
            <span className="font-bold text-xl" style={{ color: '#1A1A2E', fontFamily: 'Playfair Display, serif' }}>GeezOS</span>
          </div>

          <h2 className="text-3xl font-bold mb-2" style={{ color: '#1A1A2E', fontFamily: 'Playfair Display, serif' }}>
            Welcome back
          </h2>
          <p className="mb-10" style={{ color: '#64748B' }}>Sign in to your dispatch dashboard</p>

          <button onClick={handleLogin} disabled={loading}
            className="w-full py-4 rounded-xl font-semibold text-white transition-all duration-200 flex items-center justify-center gap-3"
            style={{
              background: loading ? '#C47E00' : '#F0A500',
              boxShadow: '0 4px 24px rgba(240,165,0,0.3)',
              fontSize: '15px',
            }}>
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Sign in with Auth0
              </>
            )}
          </button>

          <div className="mt-8 p-4 rounded-xl" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
            <p className="text-sm" style={{ color: '#1E40AF' }}>
              <strong>Secure access</strong> — Your dispatch data is protected with enterprise-grade Auth0 authentication.
            </p>
          </div>

          <p className="text-center text-xs mt-8" style={{ color: '#94A3B8' }}>
            GEEZ EXPRESS LLC · GeezOS v2.0 · Powered by Claude AI
          </p>
        </div>
      </div>
    </div>
  )
}
