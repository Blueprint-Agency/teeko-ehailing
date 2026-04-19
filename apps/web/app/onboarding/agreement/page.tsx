'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useOnboardingStore } from '@/stores/onboardingStore'

export default function AgreementPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const { acceptAgreement, setStep } = useOnboardingStore()
  const [scrolled, setScrolled] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    if (atBottom) setScrolled(true)
  }

  const handleAccept = () => {
    acceptAgreement()
    setStep(1)
    router.push('/onboarding/personal-docs')
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-8">
        <h1 className="mb-2 font-display text-3xl text-[var(--color-navy)]">{t('onboarding.agreement.title')}</h1>
        <p className="text-[var(--color-muted)]">
          {t('onboarding.agreement.subtitle')}
        </p>
      </div>

      {/* Scrollable T&C */}
      <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white shadow-[var(--shadow-sm)]">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-[420px] overflow-y-auto p-8"
        >
          <pre className="whitespace-pre-wrap font-body text-sm leading-7 text-[var(--color-text)]">
            {t('onboarding.agreement.content')}
          </pre>
        </div>

        {/* Bottom */}
        <div className="rounded-b-[var(--radius-xl)] border-t border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          {!scrolled && (
            <div className="mb-4 flex items-center gap-2 text-sm text-[var(--color-muted)]">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {t('onboarding.agreement.scrollPrompt')}
            </div>
          )}

          <label
            className={`flex cursor-pointer items-start gap-3 transition-opacity ${!scrolled ? 'opacity-40' : 'opacity-100'}`}
          >
            <input
              type="checkbox"
              disabled={!scrolled}
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 cursor-pointer rounded accent-[var(--color-teal)]"
            />
            <span className="text-sm text-[var(--color-text)]">
              {t('onboarding.agreement.checkbox')}
            </span>
          </label>

          <Button
            size="lg"
            className="mt-4 w-full"
            disabled={!accepted}
            onClick={handleAccept}
          >
            {accepted ? <><CheckCircle2 className="h-4 w-4" /> {t('common.continue')}</> : t('common.continue')}
          </Button>
        </div>
      </div>
    </div>
  )
}
