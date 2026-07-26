'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSignIn } from '@clerk/nextjs'
import { loginSchema, type LoginFormData } from '@teeko/shared/schemas/auth'
import { useWebAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import { routeForApplicationState } from '@/lib/routeForApplicationState'

// Falls back to a plain Error's message so failures from OUR api (e.g. a 500
// from /auth/me) surface verbatim rather than as a misleading generic string.
function clerkError(err: unknown): string {
  const errors = (err as { errors?: { longMessage?: string; message?: string }[] })?.errors
  return (
    errors?.[0]?.longMessage ??
    errors?.[0]?.message ??
    (err instanceof Error ? err.message : null) ??
    'Failed to log in'
  )
}

export default function LoginPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const { isLoaded, signIn, setActive } = useSignIn()
  const { hydrate } = useWebAuthStore()
  const [loading, setLoading] = useState(false)
  // Set once Clerk asks for a second factor / device-trust code.
  const [needsCode, setNeedsCode] = useState(false)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | undefined>()
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  // Resolve (or provision, if this driver's first login happened in the Expo
  // app) our row, then route on the application state rather than assuming an
  // approved account.
  const finishSignIn = async (sessionId: string | null) => {
    if (!setActive) return
    await setActive({ session: sessionId })
    const me = await api.getMe()
    await hydrate()
    router.push(routeForApplicationState(me.application?.state))
  }

  const onSubmit = async (data: LoginFormData) => {
    if (!isLoaded || !signIn) return
    setLoading(true)
    setCodeError(undefined)
    try {
      const attempt = await signIn.create({ identifier: data.email, password: data.password })

      if (attempt.status === 'complete') {
        await finishSignIn(attempt.createdSessionId)
        return
      }

      // The driver Clerk instance may require a second factor or device-trust
      // code (the Expo driver app handles the same two statuses). Fall back to
      // email_code, which every driver has by definition.
      const status = attempt.status as string
      if (status === 'needs_second_factor' || status === 'needs_client_trust') {
        await signIn.prepareSecondFactor({ strategy: 'email_code' })
        setNeedsCode(true)
        return
      }

      throw new Error(`Sign-in incomplete (${attempt.status ?? 'unknown'})`)
    } catch (error: unknown) {
      alert(clerkError(error))
    } finally {
      setLoading(false)
    }
  }

  const onVerifyCode = async () => {
    if (!isLoaded || !signIn || !code.trim()) return
    setLoading(true)
    setCodeError(undefined)
    try {
      const attempt = await signIn.attemptSecondFactor({
        strategy: 'email_code',
        code: code.trim(),
      })
      if (attempt.status !== 'complete') {
        setCodeError(`Verification incomplete (${attempt.status ?? 'unknown'})`)
        return
      }
      await finishSignIn(attempt.createdSessionId)
    } catch (error: unknown) {
      setCodeError(clerkError(error))
    } finally {
      setLoading(false)
    }
  }

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
              {t('auth.login.title')}
            </h2>
            <p className="text-white/60">
              {t('landing.cta.subtitle')}
            </p>
          </div>

          <p className="text-xs text-white/30">
            {t('landing.stats.compliant')}
          </p>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <div className="mb-8 animate-fade-up">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-teal-light)]">
              <Mail className="h-5 w-5 text-[var(--color-teal-dark)]" />
            </div>
            <h1 className="mb-2 font-display text-3xl text-[var(--color-navy)]">{t('auth.login.title')}</h1>
            <p className="text-[var(--color-muted)]">{t('auth.login.subtitle')}</p>
          </div>

          {needsCode ? (
            <div className="animate-fade-up animate-delay-100 space-y-5">
              <p className="text-sm text-[var(--color-muted)]">
                Enter the 6-digit code we emailed you to finish signing in.
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
                {t('auth.login.loginButton')}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="animate-fade-up animate-delay-100 space-y-5">
            <Input
              label={t('auth.login.emailLabel')}
              placeholder={t('auth.login.emailPlaceholder')}
              type="email"
              autoComplete="email"
              required
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label={t('auth.login.passwordLabel')}
              placeholder={t('auth.login.passwordPlaceholder')}
              type="password"
              autoComplete="current-password"
              required
              error={errors.password?.message}
              {...register('password')}
            />

            <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!isLoaded}>
              {t('auth.login.loginButton')}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
          )}

          <p className="animate-fade-up animate-delay-200 mt-6 text-center text-sm text-[var(--color-muted)]">
            {t('auth.login.noAccount')}{' '}
            <Link href="/auth/register" className="font-medium text-[var(--color-teal-dark)] hover:underline">
              {t('auth.login.registerLink')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
