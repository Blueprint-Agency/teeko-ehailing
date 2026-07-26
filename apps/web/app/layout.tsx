import type { Metadata, Viewport } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { I18nSync } from '@/components/I18nSync'
import { ClerkTokenBridge } from '@/components/ClerkTokenBridge'
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
    // Driver Clerk instance — the same one the Expo driver app uses, so a driver
    // who registers here can log in to either app.
    <ClerkProvider signInUrl="/auth/login" signUpUrl="/auth/register">
      <html lang="en" suppressHydrationWarning>
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        </head>
        <body className="min-h-screen bg-[var(--color-surface)] font-body antialiased">
          <I18nSync />
          <ClerkTokenBridge />
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
