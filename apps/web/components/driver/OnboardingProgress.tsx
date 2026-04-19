'use client'

import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

interface OnboardingProgressProps {
  currentStep: number
}

export function OnboardingProgress({ currentStep }: OnboardingProgressProps) {
  const { t } = useTranslation()

  const STEPS = [
    { label: t('onboarding.agreement.title') },
    { label: t('onboarding.personalDocs.title') },
    { label: t('onboarding.vehicleDetails.title') },
    { label: t('onboarding.vehicleDocs.title') },
    { label: t('common.submit') },
  ]

  return (
    <div className="w-full">
      {/* Step bar */}
      <div className="flex items-center">
        {STEPS.map((step, idx) => {
          const isCompleted = idx < currentStep
          const isActive = idx === currentStep
          const isLast = idx === STEPS.length - 1

          return (
            <div key={idx} className="flex flex-1 items-center">
              {/* Circle */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all duration-300',
                    isCompleted
                      ? 'border-[var(--color-teal)] bg-[var(--color-teal)] text-[var(--color-navy)]'
                      : isActive
                      ? 'border-[var(--color-teal)] bg-white text-[var(--color-teal)]'
                      : 'border-[var(--color-border-dark)] bg-white text-[var(--color-placeholder)]'
                  )}
                >
                  {isCompleted ? <Check className="h-4 w-4 stroke-[3]" /> : idx + 1}
                </div>
                <span
                  className={cn(
                    'mt-1.5 hidden text-[10px] font-medium sm:block',
                    isActive
                      ? 'text-[var(--color-teal-dark)]'
                      : isCompleted
                      ? 'text-[var(--color-text)]'
                      : 'text-[var(--color-placeholder)]'
                  )}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector */}
              {!isLast && (
                <div className="mx-1 h-0.5 flex-1 rounded-full transition-all duration-500">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      isCompleted ? 'bg-[var(--color-teal)]' : 'bg-[var(--color-border)]'
                    )}
                    style={{ width: isCompleted ? '100%' : '0%' }}
                  />
                  <div className="mt-[-2px] h-full rounded-full bg-[var(--color-border)]" />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
