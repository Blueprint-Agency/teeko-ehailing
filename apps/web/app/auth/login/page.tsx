'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowRight, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { phoneSchema } from '@teeko/shared/schemas/auth'
import { api } from '@/lib/api'

const schema = z.object({ phone: phoneSchema })
type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const { devOtp } = await api.loginDriver(data.phone as string)
      const params = new URLSearchParams({ phone: data.phone as string })
      if (devOtp) params.set('otp', devOtp)
      router.push(`/auth/verify?${params.toString()}`)
    } catch (error: any) {
      alert(error.message || 'Failed to send OTP')
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
              <Phone className="h-5 w-5 text-[var(--color-teal-dark)]" />
            </div>
            <h1 className="mb-2 font-display text-3xl text-[var(--color-navy)]">{t('auth.login.title')}</h1>
            <p className="text-[var(--color-muted)]">{t('auth.login.subtitle')}</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="animate-fade-up animate-delay-100 space-y-5">
            <Input
              label={t('auth.login.phoneLabel')}
              placeholder={t('auth.login.phonePlaceholder')}
              type="tel"
              required
              error={errors.phone?.message}
              {...register('phone')}
            />

            <Button type="submit" size="lg" className="w-full" loading={loading}>
              {t('auth.login.sendOtp')}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

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
