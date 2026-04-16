'use client'

import Link from 'next/link'
import { ArrowRight, CheckCircle2, Shield, Star, Zap, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Header } from '@/components/driver/Header'
import { useWebAuthStore } from '@/stores/authStore'

const BENEFITS = [
  {
    icon: <Zap className="h-5 w-5" />,
    title: 'Lower commission',
    desc: 'Keep more of your earnings — Teeko charges the lowest commission in Malaysia.',
  },
  {
    icon: <Shield className="h-5 w-5" />,
    title: 'APAD compliant',
    desc: 'We handle your EVP application — fully licensed e-hailing operations.',
  },
  {
    icon: <Star className="h-5 w-5" />,
    title: 'Flexible hours',
    desc: 'Drive on your schedule. Go online and offline whenever you want.',
  },
  {
    icon: <CheckCircle2 className="h-5 w-5" />,
    title: 'Fast onboarding',
    desc: 'Register online in minutes. Upload your documents, we handle the rest.',
  },
]

const STEPS = [
  { num: '01', title: 'Create Account', desc: 'Register with your phone number and basic details' },
  { num: '02', title: 'Upload Documents', desc: 'NRIC, driving licence, insurance and vehicle documents' },
  { num: '03', title: 'Wait for Approval', desc: 'Our team reviews documents in 1–3 working days' },
  { num: '04', title: 'Start Earning', desc: 'Download the app and go online — start accepting rides' },
]

export default function LandingPage() {
  const { isAuthenticated, devRole, setDevRole } = useWebAuthStore()

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
                <span className="text-sm font-medium text-[var(--color-teal)]">Now hiring driver-partners</span>
              </div>

              <h1 className="animate-fade-up animate-delay-100 mb-6 font-display text-5xl text-white lg:text-6xl">
                Drive with <em className="not-italic text-[var(--color-teal)]">Teeko</em>.{' '}
                <br />Earn more,{' '}
                <br />pay less.
              </h1>

              <p className="animate-fade-up animate-delay-200 mb-8 text-lg leading-relaxed text-white/70">
                Malaysia's newest e-hailing platform offers the lowest commission rates and full
                APAD/JPJ compliance. Register online — drive within days.
              </p>

              <div className="animate-fade-up animate-delay-300 flex flex-wrap items-center gap-3">
                <Link href="/auth/register">
                  <Button size="xl" variant="primary">
                    Register as a Driver
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/auth/login">
                  <Button size="xl" variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:border-white/40">
                    Log in
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right: stats card */}
            <div className="animate-fade-up animate-delay-400 hidden lg:block">
              <div className="relative rounded-[var(--radius-2xl)] border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
                <div className="mb-6 grid grid-cols-2 gap-4">
                  {[
                    { label: 'Commission rate', value: '10%', sub: 'vs. 25–30% elsewhere' },
                    { label: 'Avg. daily trips', value: '12–18', sub: 'Klang Valley drivers' },
                    { label: 'Payout cycle', value: 'Daily', sub: 'T+1 bank transfer' },
                    { label: 'Onboarding time', value: '< 7 days', sub: 'Doc review + EVP' },
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
                  APAD-licensed · PDPA 2010 compliant
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
              From registration to road in 4 steps
            </h2>
            <p className="mx-auto max-w-xl text-[var(--color-muted)]">
              Complete your onboarding here in the Driver Portal, then download the app to start earning.
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
              Why choose Teeko?
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
            Ready to start driving?
          </h2>
          <p className="mb-8 text-[var(--color-muted)]">
            Join thousands of driver-partners already earning with Teeko across Malaysia.
          </p>
          <Link href="/auth/register">
            <Button size="xl" variant="navy">
              Register Now — It's Free
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
                → Dashboard
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border)] bg-white py-8">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <p className="text-sm text-[var(--color-muted)]">
            © 2026 Teeko Sdn. Bhd. · APAD Licensed E-Hailing Operator ·{' '}
            <a href="#" className="hover:text-[var(--color-teal)]">Privacy Policy</a> ·{' '}
            <a href="#" className="hover:text-[var(--color-teal)]">Terms of Service</a>
          </p>
        </div>
      </footer>
    </div>
  )
}
