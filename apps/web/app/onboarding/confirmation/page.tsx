'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Clock, Download, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ConfirmationPage() {
  const { t } = useTranslation()

  const NEXT_STEPS = [
    {
      icon: <Clock className="h-5 w-5 text-[var(--color-teal-dark)]" />,
      step: '01',
      title: t('onboarding.confirmation.step1Title'),
      desc: t('onboarding.confirmation.step1Desc'),
      timeline: t('onboarding.confirmation.step1Timeline'),
    },
    {
      icon: <CheckCircle2 className="h-5 w-5 text-[var(--color-teal-dark)]" />,
      step: '02',
      title: t('onboarding.confirmation.step2Title'),
      desc: t('onboarding.confirmation.step2Desc'),
      timeline: t('onboarding.confirmation.step2Timeline'),
    },
    {
      icon: <Smartphone className="h-5 w-5 text-[var(--color-teal-dark)]" />,
      step: '03',
      title: t('onboarding.confirmation.step3Title'),
      desc: t('onboarding.confirmation.step3Desc'),
      timeline: t('onboarding.confirmation.step3Timeline'),
    },
  ]

  return (
    <div className="animate-fade-up">
      {/* Success hero */}
      <div className="mb-10 rounded-[var(--radius-2xl)] border border-[var(--color-teal)]/20 bg-gradient-to-br from-[var(--color-teal-light)] to-[var(--color-surface)] p-10 text-center">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border-4 border-[var(--color-teal)]/30 bg-[var(--color-teal)]">
          <CheckCircle2 className="h-10 w-10 text-[var(--color-navy)]" />
        </div>
        <h1 className="mb-3 font-display text-4xl text-[var(--color-navy)]">
          {t('onboarding.confirmation.title')}
        </h1>
        <p className="mx-auto max-w-md text-[var(--color-muted)]">
          {t('onboarding.confirmation.subtitle')}
        </p>
      </div>

      {/* Next steps */}
      <div className="mb-10">
        <h2 className="mb-6 font-display text-2xl text-[var(--color-navy)]">{t('onboarding.confirmation.nextSteps')}</h2>
        <div className="space-y-4">
          {NEXT_STEPS.map((s, i) => (
            <div
              key={s.step}
              className="flex gap-5 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white p-6 shadow-[var(--shadow-sm)]"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="flex flex-col items-center">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-teal-light)]">
                  {s.icon}
                </div>
                {i < NEXT_STEPS.length - 1 && (
                  <div className="mt-2 w-0.5 flex-1 bg-[var(--color-border)]" style={{ minHeight: '32px' }} />
                )}
              </div>
              <div className="pb-2">
                <div className="mb-1 flex items-center gap-3">
                  <h3 className="font-semibold text-[var(--color-navy)]">{s.title}</h3>
                  <span className="rounded-full bg-[var(--color-teal-light)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-teal-dark)]">
                    {s.timeline}
                  </span>
                </div>
                <p className="text-sm text-[var(--color-muted)]">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* App download */}
      <div className="mb-8 rounded-[var(--radius-xl)] border border-[var(--color-navy)]/10 bg-[var(--color-navy)] p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-teal)]">
          <Download className="h-5 w-5 text-[var(--color-navy)]" />
        </div>
        <h3 className="mb-2 font-display text-2xl text-white">{t('onboarding.confirmation.getAppTitle')}</h3>
        <p className="mb-6 text-white/60">
          {t('onboarding.confirmation.getAppDesc')}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <a
            href="#"
            className="flex items-center gap-2 rounded-[var(--radius-md)] border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/20"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" /></svg>
            App Store
          </a>
          <a
            href="#"
            className="flex items-center gap-2 rounded-[var(--radius-md)] border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/20"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><path d="M3.18 23.76a2.5 2.5 0 01-.93-.97L12 12l2.18 2.18-9.64 9.85c-.32-.07-.6-.16-.36-.27m-1.36-2.4a2.5 2.5 0 010-.72V3.36a2.5 2.5 0 010-.72L12 12 1.82 21.36M20.5 10.85l-2.36-1.36-2.32 2.32 2.32 2.32 2.4-1.37c.68-.4.68-1.51-.04-1.91M3.18.24L12.68 10 9.82 12.86 3.18.24z" /></svg>
            Google Play
          </a>
        </div>
      </div>

      <div className="text-center">
        <Link href="/dashboard">
          <Button variant="outline" size="lg">
            {t('dashboard.actionButton')}
          </Button>
        </Link>
      </div>
    </div>
  )
}
