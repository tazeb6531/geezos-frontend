'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

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

  return (
    <aside className="fixed left-0 top-0 h-full w-56 flex flex-col z-40"
      style={{ background: '#1A1A2E', borderRight: '1px solid rgba(240,165,0,0.15)' }}>

      {/* Logo */}
      <div className="p-6 border-b" style={{ borderColor: 'rgba(240,165,0,0.15)' }}>
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
}
