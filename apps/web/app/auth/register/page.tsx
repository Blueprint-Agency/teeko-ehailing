'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth, useSignUp } from '@clerk/nextjs'
import { UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { registerSchema, type RegisterFormData } from '@teeko/shared/schemas/auth'
import { useWebAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'

/**
 * Clerk returns validation problems as an errors array; surface the first one.
 * Falls back to a plain Error's message so failures from OUR api (a 500 from
 * /auth/me, say) are shown verbatim instead of a misleading generic string.
 */
function clerkError(err: unknown): string {
  const errors = (err as { errors?: { longMessage?: string; message?: string }[] })?.errors
  return (
    errors?.[0]?.longMessage ??
    errors?.[0]?.message ??
    (err instanceof Error ? err.message : null) ??
    'Failed to create account'
  )
}

/** Clerk refuses signUp.create while a session is active. */
function isSessionExists(err: unknown): boolean {
  const errors = (err as { errors?: { code?: string }[] })?.errors
  return errors?.some((e) => e.code === 'session_exists') ?? false
}

export default function RegisterPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const { isLoaded, signUp, setActive } = useSignUp()
  const { isSignedIn } = useAuth()
  const { hydrate } = useWebAuthStore()
  const [loading, setLoading] = useState(false)
  // Non-null once Clerk has emailed a verification code and is waiting on it.
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | undefined>()

  const { register, handleSubmit, watch, formState: { errors } } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  const pdpaConsent = watch('pdpaConsent')

  // Provisions our rows (users, user_roles, driver_profiles pending,
  // driver_applications), records PDPA consent, then enters the wizard.
  // Split from finishSignUp so a driver whose Clerk sign-up already succeeded —
  // but whose provisioning failed — can be recovered without a second sign-up.
  const provisionAndEnter = async () => {
    await api.getMe()
    await api.acceptConsent()
    await hydrate()
    router.push('/onboarding/agreement')
  }

  const finishSignUp = async (sessionId: string | null) => {
    if (!setActive) return
    await setActive({ session: sessionId })
    await provisionAndEnter()
  }

  const onSubmit = async (data: RegisterFormData) => {
    if (!isLoaded || !signUp) return
    setLoading(true)
    setCodeError(undefined)
    try {
      // Already signed in: the Clerk credential exists and only our own
      // provisioning is outstanding (e.g. a previous attempt died on a backend
      // error after setActive). Resume instead of attempting a second sign-up,
      // which Clerk rejects with session_exists.
      if (isSignedIn) {
        await provisionAndEnter()
        return
      }

      // Clerk creates the credential. fullName is split into Clerk's first/last
      // name so the backend can read it back off the JWT claims.
      const [firstName, ...rest] = data.fullName.trim().split(/\s+/)
      const created = await signUp.create({
        emailAddress: data.email,
        password: data.password,
        firstName,
        lastName: rest.join(' ') || undefined,
      })

      if (created.status === 'complete') {
        await finishSignUp(created.createdSessionId)
        return
      }

      // The driver Clerk instance requires the email to be verified before the
      // sign-up completes ('missing_requirements'). Run Clerk's email-code step
      // inline. Our own OTP then self-skips, because JIT provisioning only fires
      // it when Clerk reports the address unverified.
      if (created.unverifiedFields?.includes('email_address')) {
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
        setPendingEmail(data.email)
        return
      }

      // Anything else the instance demands (phone number, username, …) is a
      // config mismatch we can't satisfy from this form — name it rather than
      // reporting a bare status.
      const missing = created.missingFields?.join(', ')
      throw new Error(
        missing
          ? `Clerk requires fields this form doesn't collect: ${missing}`
          : `Sign-up incomplete (${created.status ?? 'unknown'})`,
      )
    } catch (error: unknown) {
      // Race: a session appeared between the isSignedIn check and create().
      if (isSessionExists(error)) {
        try {
          await provisionAndEnter()
          return
        } catch (resumeError: unknown) {
          alert(clerkError(resumeError))
          return
        }
      }
      alert(clerkError(error))
    } finally {
      setLoading(false)
    }
  }

  const onVerifyCode = async () => {
    if (!isLoaded || !signUp || !code.trim()) return
    setLoading(true)
    setCodeError(undefined)
    try {
      const attempt = await signUp.attemptEmailAddressVerification({ code: code.trim() })
      if (attempt.status !== 'complete') {
        setCodeError(`Verification incomplete (${attempt.status ?? 'unknown'})`)
        return
      }
      await finishSignUp(attempt.createdSessionId)
    } catch (error: unknown) {
      setCodeError(clerkError(error))
    } finally {
      setLoading(false)
    }
  }

  const onResendCode = async () => {
    if (!isLoaded || !signUp) return
    setCodeError(undefined)
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
    } catch (error: unknown) {
      setCodeError(clerkError(error))
    }
  }

  const BENEFITS = [
    t('landing.stats.commissionSub'),
    t('landing.stats.compliant'),
    t('landing.stats.payoutSub'),
    t('landing.hero.subtitle')
  ]

  return (
    <div className="flex min-h-screen">
      {/* Left panel */}
      <div className="relative hidden w-[420px] flex-shrink-0 overflow-hidden bg-[var(--color-navy)] lg:flex lg:flex-col">
        <div className="absolute inset-0 bg-dot-grid" />
        <div className="relative flex flex-1 flex-col justify-between p-10">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-teal)]">
              <span className="font-display text-lg font-bold text-white">T</span>
            </div>
            <span className="font-display text-2xl text-white">{t('common.appName')}</span>
          </Link>
          <div>
            <h2 className="mb-4 font-display text-4xl text-white">
              {t('auth.register.title')}
            </h2>
            <ul className="space-y-3 text-white/60">
              {BENEFITS.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-teal)]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-white/30">{t('landing.stats.compliant')}</p>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <div className="mb-8 animate-fade-up">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-teal-light)]">
              <UserPlus className="h-5 w-5 text-[var(--color-teal-dark)]" />
            </div>
            <h1 className="mb-2 font-display text-3xl text-[var(--color-navy)]">{t('auth.register.createAccount')}</h1>
            <p className="text-[var(--color-muted)]">{t('auth.register.subtitle')}</p>
          </div>

          {pendingEmail ? (
            /* Clerk requires the email address to be verified before the sign-up
               completes. Nothing is written to our DB until this succeeds. */
            <div className="animate-fade-up animate-delay-100 space-y-5">
              <p className="text-sm text-[var(--color-muted)]">
                We sent a 6-digit code to <span className="font-medium">{pendingEmail}</span>. Enter
                it to finish creating your account.
              </p>
              <Input
                label="Verification code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                maxLength={6}
                required
                error={codeError}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value)
                  if (codeError) setCodeError(undefined)
                }}
              />
              <Button
                type="button"
                size="lg"
                className="w-full"
                loading={loading}
                disabled={code.trim().length < 6}
                onClick={onVerifyCode}
              >
                Verify and continue
              </Button>
              <button
                type="button"
                onClick={onResendCode}
                className="w-full text-center text-sm font-medium text-[var(--color-teal-dark)] hover:underline"
              >
                Resend code
              </button>
            </div>
          ) : isSignedIn ? (
            /* Clerk already has a session for this browser, so the credential
               exists and only our own provisioning is left — most likely a
               previous attempt failed after sign-up completed. Offer to resume
               rather than showing a form that Clerk would reject with
               session_exists. */
            <div className="animate-fade-up animate-delay-100 space-y-5">
              <p className="text-sm text-[var(--color-muted)]">
                You&apos;re already signed in. Continue where you left off to finish setting up your
                driver account.
              </p>
              <Button
                type="button"
                size="lg"
                className="w-full"
                loading={loading}
                onClick={async () => {
                  setLoading(true)
                  try {
                    await provisionAndEnter()
                  } catch (error: unknown) {
                    alert(clerkError(error))
                  } finally {
                    setLoading(false)
                  }
                }}
              >
                Continue
              </Button>
            </div>
          ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="animate-fade-up animate-delay-100 space-y-5">
            <Input
              label={t('auth.register.fullNameLabel')}
              placeholder="e.g. Ahmad Faizal"
              required
              error={errors.fullName?.message}
              {...register('fullName')}
            />
            <Input
              label={t('auth.register.emailLabel')}
              type="email"
              autoComplete="email"
              placeholder="e.g. ahmad@example.com"
              required
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label={t('auth.register.password')}
              type="password"
              autoComplete="new-password"
              placeholder={t('auth.register.passwordHint')}
              required
              error={errors.password?.message}
              {...register('password')}
            />

            {/* PDPA consent */}
            <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 cursor-pointer rounded border-[var(--color-border-dark)] accent-[var(--color-teal)]"
                {...register('pdpaConsent')}
              />
              <span className="text-xs leading-relaxed text-[var(--color-muted)]">
                {t('auth.register.pdpaConsent')}
              </span>
            </label>
            {errors.pdpaConsent && (
              <p className="-mt-3 text-xs text-[var(--color-error)]">{errors.pdpaConsent.message}</p>
            )}

            {/* Mount point for Clerk's Smart CAPTCHA bot protection. Custom
                sign-up flows must render this themselves — without it Clerk logs
                a warning and silently downgrades to the invisible widget, which
                can hard-fail sign-up if the instance is set to require a
                challenge. Must be in the DOM before signUp.create() runs. */}
            <div id="clerk-captcha" className="empty:hidden" />

            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={loading}
              disabled={!pdpaConsent || !isLoaded}
            >
              {t('auth.register.createAccount')}
            </Button>
          </form>
          )}

          <p className="animate-fade-up animate-delay-200 mt-6 text-center text-sm text-[var(--color-muted)]">
            {t('auth.register.hasAccount')}{' '}
            <Link href="/auth/login" className="font-medium text-[var(--color-teal-dark)] hover:underline">
              {t('common.login')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
