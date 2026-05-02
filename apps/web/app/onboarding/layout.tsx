'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { OnboardingProgress } from '@/components/driver/OnboardingProgress'

const STEP_MAP: Record<string, number> = {
  '/onboarding/agreement': 0,
  '/onboarding/personal-docs': 1,
  '/onboarding/vehicle-details': 2,
  '/onboarding/vehicle-docs': 3,
  '/onboarding/confirmation': 4,
}

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const pathname = usePathname()
  const currentStep = STEP_MAP[pathname] ?? 0

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
