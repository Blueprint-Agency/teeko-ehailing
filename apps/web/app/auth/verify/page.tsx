'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWebAuthStore } from '@/stores/authStore'
import mockProfile from '@/data/mock-driver-profile.json'
import type { DriverProfile } from '@teeko/shared/types'

function VerifyForm() {
  const { t } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  const phone = searchParams?.get('phone') ?? ''
  const { login } = useWebAuthStore()

  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [countdown, setCountdown] = useState(30)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  const handleChange = (val: string, idx: number) => {
    if (!/^\d?$/.test(val)) return
    const next = [...otp]
    next[idx] = val
    setOtp(next)
    setError('')
    if (val && idx < 5) {
      document.getElementById(`otp-${idx + 1}`)?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      document.getElementById(`otp-${idx - 1}`)?.focus()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = otp.join('')
    if (code.length < 6) { setError(t('auth.verify.enterDigits')); return }
    setLoading(true)
    await new Promise((r) => setTimeout(r, 800))
    // Mock: any 6-digit code works
    login(mockProfile as DriverProfile)
    router.push('/auth/register')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 animate-fade-up text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-teal-light)]">
            <MessageSquare className="h-5 w-5 text-[var(--color-teal-dark)]" />
          </div>
          <h1 className="mb-2 font-display text-3xl text-[var(--color-navy)]">{t('auth.verify.title')}</h1>
          <p className="text-[var(--color-muted)]">
            {t('auth.verify.subtitle')}{' '}
            <span className="font-semibold text-[var(--color-text)]">{phone}</span>
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">{t('auth.verify.mockHint')}</p>
        </div>

        <form onSubmit={handleSubmit} className="animate-fade-up animate-delay-100">
          <div className="mb-6 flex justify-center gap-3">
            {otp.map((digit, idx) => (
              <input
                key={idx}
                id={`otp-${idx}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(e.target.value, idx)}
                onKeyDown={(e) => handleKeyDown(e, idx)}
                className="h-14 w-12 rounded-[var(--radius-md)] border-2 text-center text-xl font-semibold text-[var(--color-navy)] transition-all focus:border-[var(--color-teal)] focus:outline-none focus:ring-2 focus:ring-[var(--color-teal)]/20"
                style={{
                  borderColor: error ? 'var(--color-error)' : digit ? 'var(--color-teal)' : 'var(--color-border)',
                }}
              />
            ))}
          </div>

          {error && (
            <p className="mb-4 text-center text-sm text-[var(--color-error)]">{error}</p>
          )}

          <Button type="submit" size="lg" className="w-full" loading={loading}>
            {t('auth.verify.button')}
          </Button>
        </form>

        <div className="animate-fade-up animate-delay-200 mt-6 text-center text-sm text-[var(--color-muted)]">
          {countdown > 0 ? (
            <span>{t('auth.verify.resendTimer')} {countdown}s</span>
          ) : (
            <button
              onClick={() => setCountdown(30)}
              className="font-medium text-[var(--color-teal-dark)] hover:underline"
            >
              {t('auth.verify.resendButton')}
            </button>
          )}
        </div>

        <p className="mt-4 text-center text-sm text-[var(--color-muted)]">
          {t('auth.verify.wrongNumber')}{' '}
          <Link href="/auth/login" className="font-medium text-[var(--color-teal-dark)] hover:underline">
            {t('common.goBack')}
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  )
}
