'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { OnboardingProgress } from '@/components/driver/OnboardingProgress'
import { useWebAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'

const STEP_MAP: Record<string, number> = {
  '/onboarding/agreement': 0,
  '/onboarding/personal-docs': 1,
  '/onboarding/vehicle-details': 2,
  '/onboarding/vehicle-docs': 3,
  '/onboarding/confirmation': 4,
}

const STEP_ROUTES = [
  '/onboarding/agreement',
  '/onboarding/personal-docs',
  '/onboarding/vehicle-details',
  '/onboarding/vehicle-docs',
  '/onboarding/confirmation',
]

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const router = useRouter()
  const pathname = usePathname()
  const currentStep = pathname ? STEP_MAP[pathname] ?? 0 : 0
  const { isAuthenticated, profile } = useWebAuthStore()

  useEffect(() => {
    if (!isAuthenticated || !profile) {
      router.push('/auth/login')
      return
    }

    const driverId = profile.id
    const path = pathname || ''
    let isMounted = true

    async function checkStatus() {
      try {
        const appState = await api.getApplication(driverId)
        if (!isMounted) return

        if (appState.state === 'activated') {
          router.push('/dashboard')
          return
        }

        const targetStep = appState.currentStep
        const currentRouteStep = STEP_MAP[path] ?? 0

        // Redirect if attempting to skip ahead or on root /onboarding route
        if (currentRouteStep > targetStep || !STEP_MAP.hasOwnProperty(path)) {
          router.push(STEP_ROUTES[targetStep])
        }
      } catch (err) {
        console.error('Failed to check onboarding status:', err)
      }
    }

    checkStatus()

    return () => {
      isMounted = false
    }
  }, [isAuthenticated, profile, pathname, router])

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 no-underline">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-teal)]">
              <span className="font-display text-xs font-bold text-white">T</span>
            </div>
            <span className="font-display text-lg text-[var(--color-navy)]">{t('common.appName')}</span>
          </Link>
          <span className="text-xs font-medium text-[var(--color-muted)]">
            {t('common.step')} {currentStep + 1} {t('common.of')} 5
          </span>
        </div>

        {/* Progress bar */}
        <div className="border-t border-[var(--color-surface)]">
          <div className="mx-auto max-w-3xl px-6 py-4">
            <OnboardingProgress currentStep={currentStep} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
    </div>
  )
}
