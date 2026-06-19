'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { OnboardingProgress } from '@/components/driver/OnboardingProgress'
import { useWebAuthStore } from '@/stores/authStore'
import { useOnboardingStore } from '@/stores/onboardingStore'
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

// Drivers in these server-side states have already submitted — they shouldn't
// re-run onboarding and are sent to the dashboard to track their review.
const SUBMITTED_STATES = new Set(['in_review', 'rejected', 'activated'])

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const router = useRouter()
  const pathname = usePathname()
  const currentStep = pathname ? STEP_MAP[pathname] ?? 0 : 0
  const { isAuthenticated, profile } = useWebAuthStore()
  const { agreementAccepted, personalDocs, vehicleDetails, submitted } = useOnboardingStore()

  // Furthest step the local (client-side) progress allows access to. Because
  // uploaded files are kept in memory only, a refresh resets doc progress and
  // gates the user back to the docs step to re-select files.
  const allPersonalUploaded = personalDocs.every((d) => d.status !== 'empty')
  let furthestAllowed = 0
  if (submitted) furthestAllowed = 4
  else if (agreementAccepted && allPersonalUploaded && vehicleDetails) furthestAllowed = 3
  else if (agreementAccepted && allPersonalUploaded) furthestAllowed = 2
  else if (agreementAccepted) furthestAllowed = 1

  useEffect(() => {
    if (!isAuthenticated || !profile) {
      router.push('/auth/login')
      return
    }

    const routeStep = STEP_MAP[pathname || ''] ?? 0

    // Forward-progress gating from local state (synchronous, no network).
    if (routeStep > furthestAllowed) {
      router.replace(STEP_ROUTES[furthestAllowed])
      return
    }

    // Read-only guard: bounce already-submitted drivers out of onboarding. Skip
    // when this is the local post-submit success page (route 4 + submitted).
    if (submitted && routeStep === 4) return

    let isMounted = true
    api
      .getApplication(profile.id)
      .then((appState) => {
        if (!isMounted) return
        if (SUBMITTED_STATES.has(appState.state)) router.replace('/dashboard')
      })
      .catch((err) => console.error('Failed to check onboarding status:', err))

    return () => {
      isMounted = false
    }
  }, [isAuthenticated, profile, pathname, router, furthestAllowed, submitted])

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
