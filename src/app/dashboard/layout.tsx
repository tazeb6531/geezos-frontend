import Sidebar from '@/components/layout/Sidebar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen" style={{ background: '#F8F7F4' }}>
      <Sidebar />
      {/* Desktop: ml-56 to offset sidebar. Mobile: ml-0, padding-top for hamburger button */}
      <main className="flex-1 lg:ml-56">
        <div className="p-4 pt-16 lg:pt-8 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
