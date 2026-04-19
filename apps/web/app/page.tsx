'use client'

import Link from 'next/link'
import { ArrowRight, CheckCircle2, Shield, Star, Zap, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Header } from '@/components/driver/Header'
import { useWebAuthStore } from '@/stores/authStore'

export default function LandingPage() {
  const { t } = useTranslation()
  const { isAuthenticated, devRole, setDevRole } = useWebAuthStore()

  const BENEFITS = [
    {
      icon: <Zap className="h-5 w-5" />,
      title: t('onboarding.confirmation.step3Title'), // Using existing keys where appropriate or landing ones
      desc: t('onboarding.confirmation.step3Desc'),
    },
    {
      icon: <Shield className="h-5 w-5" />,
      title: t('landing.stats.compliant'),
      desc: t('landing.hero.description'),
    },
    {
      icon: <Star className="h-5 w-5" />,
      title: t('onboarding.agreement.title'),
      desc: t('onboarding.agreement.subtitle'),
    },
    {
      icon: <CheckCircle2 className="h-5 w-5" />,
      title: t('onboarding.confirmation.step1Title'),
      desc: t('onboarding.confirmation.step1Desc'),
    },
  ]

  const STEPS = [
    { num: '01', title: t('auth.register.createAccount'), desc: t('auth.register.subtitle') },
    { num: '02', title: t('onboarding.personalDocs.title'), desc: t('onboarding.personalDocs.subtitle') },
    { num: '03', title: t('onboarding.confirmation.step1Title'), desc: t('onboarding.confirmation.step1Desc') },
    { num: '04', title: t('onboarding.confirmation.step3Title'), desc: t('onboarding.confirmation.step3Desc') },
  ]

  return (
    <div className="min-h-screen">
      <Header variant="navy" showNav />

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[var(--color-navy)] pb-24 pt-20">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-dot-grid opacity-100" />
        <div className="absolute right-0 top-0 h-[600px] w-[600px] rounded-full bg-[var(--color-teal)]/5 blur-3xl" />
        <div className="absolute -left-40 bottom-0 h-80 w-80 rounded-full bg-[var(--color-teal)]/8 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-16 lg:grid-cols-2">
            {/* Left: copy */}
            <div>
              <div className="animate-fade-up mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--color-teal)]/30 bg-[var(--color-teal)]/10 px-4 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-teal)]" />
                <span className="text-sm font-medium text-[var(--color-teal)]">{t('landing.hiring')}</span>
              </div>

              <h1 className="animate-fade-up animate-delay-100 mb-6 font-display text-5xl text-white lg:text-6xl">
                {t('landing.hero.title')}
                <br /><em className="not-italic text-[var(--color-teal)]">{t('landing.hero.subtitle')}</em>
              </h1>

              <p className="animate-fade-up animate-delay-200 mb-8 text-lg leading-relaxed text-white/70">
                {t('landing.hero.description')}
              </p>

              <div className="animate-fade-up animate-delay-300 flex flex-wrap items-center gap-3">
                <Link href="/auth/register">
                  <Button size="xl" variant="primary">
                    {t('landing.hero.ctaRegister')}
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/auth/login">
                  <Button size="xl" variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:border-white/40">
                    {t('landing.hero.ctaLogin')}
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right: stats card */}
            <div className="animate-fade-up animate-delay-400 hidden lg:block">
              <div className="relative rounded-[var(--radius-2xl)] border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
                <div className="mb-6 grid grid-cols-2 gap-4">
                  {[
                    { label: t('landing.stats.commission'), value: '10%', sub: t('landing.stats.commissionSub') },
                    { label: t('landing.stats.trips'), value: '12–18', sub: t('landing.stats.tripsSub') },
                    { label: t('landing.stats.payout'), value: 'Daily', sub: t('landing.stats.payoutSub') },
                    { label: t('landing.stats.onboarding'), value: '< 7 days', sub: t('landing.stats.onboardingSub') },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-[var(--radius-lg)] border border-white/10 bg-white/5 p-4">
                      <p className="font-display text-2xl text-[var(--color-teal)]">{stat.value}</p>
                      <p className="mt-1 text-xs font-semibold text-white/90">{stat.label}</p>
                      <p className="text-xs text-white/50">{stat.sub}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <Shield className="h-4 w-4 text-[var(--color-teal)]" />
                  {t('landing.stats.compliant')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <h2 className="mb-3 font-display text-3xl text-[var(--color-navy)] lg:text-4xl">
              {t('landing.howItWorks.title')}
            </h2>
            <p className="mx-auto max-w-xl text-[var(--color-muted)]">
              {t('landing.howItWorks.subtitle')}
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <div
                key={step.num}
                className="animate-fade-up relative rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white p-6 shadow-[var(--shadow-sm)]"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <span className="mb-4 inline-block font-display text-4xl text-[var(--color-teal)]/30">
                  {step.num}
                </span>
                <h3 className="mb-2 text-base font-semibold text-[var(--color-navy)]">{step.title}</h3>
                <p className="text-sm text-[var(--color-muted)]">{step.desc}</p>
                {i < STEPS.length - 1 && (
                  <ChevronRight className="absolute -right-3 top-1/2 hidden h-6 w-6 -translate-y-1/2 text-[var(--color-border-dark)] lg:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Benefits ────────────────────────────────────────────────── */}
      <section className="bg-[var(--color-navy)] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <h2 className="mb-3 font-display text-3xl text-white lg:text-4xl">
              {t('landing.benefits.title')}
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map((b, i) => (
              <div
                key={b.title}
                className="animate-fade-up rounded-[var(--radius-xl)] border border-white/10 bg-white/5 p-6"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-teal)]/20 text-[var(--color-teal)]">
                  {b.icon}
                </div>
                <h3 className="mb-2 font-semibold text-white">{b.title}</h3>
                <p className="text-sm text-white/60">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA strip ───────────────────────────────────────────────── */}
      <section className="border-t border-[var(--color-border)] bg-[var(--color-teal-light)] py-16">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="mb-4 font-display text-3xl text-[var(--color-navy)]">
            {t('landing.cta.title')}
          </h2>
          <p className="mb-8 text-[var(--color-muted)]">
            {t('landing.cta.subtitle')}
          </p>
          <Link href="/auth/register">
            <Button size="xl" variant="navy">
              {t('landing.cta.button')}
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ── Dev toggle ──────────────────────────────────────────────── */}
      <div className="fixed bottom-4 right-4 z-50">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-3 shadow-[var(--shadow-lg)]">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
            Dev Mode
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setDevRole('new')}
              className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                devRole === 'new'
                  ? 'bg-[var(--color-navy)] text-white'
                  : 'bg-[var(--color-surface)] text-[var(--color-muted)]'
              }`}
            >
              New Driver
            </button>
            <button
              onClick={() => setDevRole('returning')}
              className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                devRole === 'returning'
                  ? 'bg-[var(--color-navy)] text-white'
                  : 'bg-[var(--color-surface)] text-[var(--color-muted)]'
              }`}
            >
              Returning
            </button>
            {isAuthenticated && (
              <Link href="/dashboard" className="rounded bg-[var(--color-teal)] px-2 py-1 text-xs font-medium text-[var(--color-navy)]">
                → {t('nav.dashboard')}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border)] bg-white py-8">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <p className="text-sm text-[var(--color-muted)]">
            {t('common.allRightsReserved')} ·{' '}
            <a href="#" className="hover:text-[var(--color-teal)]">{t('common.privacyPolicy')}</a> ·{' '}
            <a href="#" className="hover:text-[var(--color-teal)]">{t('common.termsOfService')}</a>
          </p>
        </div>
      </footer>
    </div>
  )
}
