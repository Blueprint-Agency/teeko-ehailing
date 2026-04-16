'use client'

import Link from 'next/link'
import { useOnboardingStore } from '@/stores/onboardingStore'
import { OnboardingProgress } from '@/components/driver/OnboardingProgress'

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const { currentStep } = useOnboardingStore()

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 no-underline">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-teal)]">
              <span className="font-display text-xs font-bold text-[var(--color-navy)]">T</span>
            </div>
            <span className="font-display text-lg text-[var(--color-navy)]">Teeko</span>
          </Link>
          <span className="text-xs font-medium text-[var(--color-muted)]">
            Step {currentStep + 1} of 5
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
