'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { UserPlus, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { registerSchema, type RegisterFormData } from '@teeko/shared/schemas/auth'
import { useWebAuthStore } from '@/stores/authStore'
import mockProfile from '@/data/mock-driver-profile.json'
import type { DriverProfile } from '@teeko/shared/types'

export default function RegisterPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const { login } = useWebAuthStore()
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, watch, formState: { errors } } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  const pdpaConsent = watch('pdpaConsent')

  const onSubmit = async (data: RegisterFormData) => {
    setLoading(true)
    await new Promise((r) => setTimeout(r, 800))
    login({ ...mockProfile, fullName: data.fullName, phone: data.phone } as DriverProfile)
    router.push('/onboarding/agreement')
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
              <span className="font-display text-lg font-bold text-[var(--color-navy)]">T</span>
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

          <form onSubmit={handleSubmit(onSubmit)} className="animate-fade-up animate-delay-100 space-y-5">
            <Input
              label={t('auth.register.fullNameLabel')}
              placeholder="e.g. Ahmad Faizal"
              required
              error={errors.fullName?.message}
              {...register('fullName')}
            />
            <Input
              label={t('auth.register.phoneLabel')}
              type="tel"
              placeholder={t('auth.register.phonePlaceholder')}
              required
              error={errors.phone?.message}
              {...register('phone')}
            />

            <div className="relative">
              <Input
                label={t('auth.register.password')}
                type={showPass ? 'text' : 'password'}
                placeholder={t('auth.register.passwordHint')}
                required
                error={errors.password?.message}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-8 text-[var(--color-muted)] hover:text-[var(--color-text)]"
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

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

            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={loading}
              disabled={!pdpaConsent}
            >
              {t('auth.register.createAccount')}
            </Button>
          </form>

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
