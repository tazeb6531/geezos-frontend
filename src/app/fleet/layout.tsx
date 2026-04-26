import Sidebar from "@/components/layout/Sidebar"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen" style={{ background: "#F8F7F4" }}>
      <Sidebar />
      <main className="flex-1 ml-56">
        <div className="p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
