'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

const NAV = [
  { href: '/dashboard', icon: '▦',  label: 'Dashboard'  },
  { href: '/dispatch',  icon: '⊞',  label: 'Dispatch'   },
  { href: '/fleet',     icon: '⊡',  label: 'Fleet'      },
  { href: '/payroll',   icon: '💰', label: 'Accounting' },
  { href: '/reports',   icon: '◱',  label: 'Reports'    },
  { href: '/settings',  icon: '⚙',  label: 'Settings'   },
]

export default function Sidebar() {
  const path = usePathname()
  const [open, setOpen] = useState(false)

  // Close sidebar on route change (mobile)
  useEffect(() => { setOpen(false) }, [path])

  // Close on escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const SidebarContent = () => (
    <aside className="flex flex-col h-full"
      style={{ background: '#1A1A2E', borderRight: '1px solid rgba(240,165,0,0.15)' }}>

      {/* Logo + close button on mobile */}
      <div className="p-6 border-b flex items-center justify-between"
        style={{ borderColor: 'rgba(240,165,0,0.15)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: '#F0A500' }}>
            <span className="text-base font-bold text-white"
              style={{ fontFamily: 'Playfair Display, serif' }}>G</span>
          </div>
          <div>
            <div className="text-sm font-bold text-white"
              style={{ fontFamily: 'Playfair Display, serif' }}>GeezOS</div>
            <div className="text-xs" style={{ color: 'rgba(240,165,0,0.7)' }}>GEEZ EXPRESS</div>
          </div>
        </div>
        {/* Close button — mobile only */}
        <button onClick={() => setOpen(false)}
          className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg"
          style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
          ✕
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {NAV.map(({ href, icon, label }) => {
          const active = path.startsWith(href)
          return (
            <Link key={href} href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150"
              style={{
                background:  active ? 'rgba(240,165,0,0.15)' : 'transparent',
                color:       active ? '#F0A500' : 'rgba(255,255,255,0.6)',
                borderLeft:  active ? '2px solid #F0A500' : '2px solid transparent',
              }}>
              <span className="w-5 text-center text-base">{icon}</span>
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="p-4 border-t" style={{ borderColor: 'rgba(240,165,0,0.15)' }}>
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
            style={{ background: '#0F3460' }}>T</div>
          <div>
            <div className="text-xs font-medium text-white">Tazeb</div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Admin</div>
          </div>
        </div>
      </div>
    </aside>
  )

  return (
    <>
      {/* ── DESKTOP sidebar — always visible on lg+ ── */}
      <div className="hidden lg:block fixed left-0 top-0 h-full w-56 z-40">
        <SidebarContent />
      </div>

      {/* ── MOBILE hamburger button ── */}
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 w-10 h-10 flex items-center justify-center rounded-xl shadow-lg"
        style={{ background: '#1A1A2E', color: '#F0A500' }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <rect x="2" y="4" width="16" height="2" rx="1"/>
          <rect x="2" y="9" width="16" height="2" rx="1"/>
          <rect x="2" y="14" width="16" height="2" rx="1"/>
        </svg>
      </button>

      {/* ── MOBILE overlay + drawer ── */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={() => setOpen(false)}
          />
          {/* Drawer */}
          <div className="lg:hidden fixed left-0 top-0 h-full w-64 z-50">
            <SidebarContent />
          </div>
        </>
      )}
    </>
  )
}
