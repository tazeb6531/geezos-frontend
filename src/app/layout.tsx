import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'GeezOS — GEEZ EXPRESS LLC',
  description: 'AI-Powered Transportation Management System',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
