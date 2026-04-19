import type { Metadata, Viewport } from 'next'
import { I18nSync } from '@/components/I18nSync'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Teeko Driver Portal', template: '%s | Teeko Driver' },
  description: 'Register as a Teeko driver-partner. Complete your onboarding and start earning.',
  icons: { icon: '/favicon.ico' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen bg-[var(--color-surface)] font-body antialiased">
        <I18nSync />
        {children}
      </body>
    </html>
  )
}
