'use client'

import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Car, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { vehicleDetailsSchema, type VehicleDetailsFormData } from '@teeko/shared/schemas/onboarding'
import { useOnboardingStore } from '@/stores/onboardingStore'

const currentYear = new Date().getFullYear()

export default function VehicleDetailsPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const { setVehicleDetails, setStep, vehicleDetails } = useOnboardingStore()

  const MAKES = ['Perodua', 'Proton', 'Toyota', 'Honda', 'Nissan', 'Hyundai', 'Mitsubishi', 'Mazda', 'Ford', 'Volkswagen', t('common.other')]
  const COLOURS = [
    t('onboarding.vehicleDetails.colours.white'),
    t('onboarding.vehicleDetails.colours.silver'),
    t('onboarding.vehicleDetails.colours.black'),
    t('onboarding.vehicleDetails.colours.grey'),
    t('onboarding.vehicleDetails.colours.blue'),
    t('onboarding.vehicleDetails.colours.red'),
    t('onboarding.vehicleDetails.colours.brown'),
    t('onboarding.vehicleDetails.colours.green'),
    t('onboarding.vehicleDetails.colours.gold'),
    t('common.other')
  ]

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VehicleDetailsFormData>({
    resolver: zodResolver(vehicleDetailsSchema),
    defaultValues: vehicleDetails ?? undefined,
  })

  const onSubmit = (data: VehicleDetailsFormData) => {
    setVehicleDetails(data)
    setStep(3)
    router.push('/onboarding/vehicle-docs')
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-8">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-teal-light)]">
          <Car className="h-5 w-5 text-[var(--color-teal-dark)]" />
        </div>
        <h1 className="mb-2 font-display text-3xl text-[var(--color-navy)]">{t('onboarding.vehicleDetails.title')}</h1>
        <p className="text-[var(--color-muted)]">
          {t('onboarding.vehicleDetails.subtitle')}
        </p>
      </div>

      <div className="mb-6 flex items-center gap-2 rounded-[var(--radius-md)] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
        {t('onboarding.vehicleDetails.yearRestriction', { start: currentYear - 15, end: currentYear })}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white p-6 shadow-[var(--shadow-sm)]">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            {t('onboarding.vehicleDetails.infoHeading')}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Make */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[var(--color-text)]">
                {t('onboarding.vehicleDetails.make')} <span className="text-[var(--color-error)]">*</span>
              </label>
              <select
                className="h-11 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-teal)]"
                {...register('make')}
              >
                <option value="">{t('onboarding.vehicleDetails.selectMake')}</option>
                {MAKES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              {errors.make && <p className="text-xs text-[var(--color-error)]">{errors.make.message}</p>}
            </div>

            <Input
              label={t('onboarding.vehicleDetails.model')}
              placeholder="e.g. Myvi, Vios, City"
              required
              error={errors.model?.message}
              {...register('model')}
            />

            <Input
              label={t('onboarding.vehicleDetails.year')}
              type="number"
              placeholder={`e.g. ${currentYear - 2}`}
              required
              min={currentYear - 15}
              max={currentYear}
              error={errors.year?.message}
              {...register('year', { valueAsNumber: true })}
            />

            <Input
              label={t('onboarding.vehicleDetails.plate')}
              placeholder="e.g. WKK 1234"
              required
              error={errors.plateNumber?.message}
              style={{ textTransform: 'uppercase' }}
              {...register('plateNumber')}
            />

            {/* Colour */}
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-sm font-medium text-[var(--color-text)]">
                {t('onboarding.vehicleDetails.colour')} <span className="text-[var(--color-error)]">*</span>
              </label>
              <select
                className="h-11 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-teal)]"
                {...register('colour')}
              >
                <option value="">{t('onboarding.vehicleDetails.selectColour')}</option>
                {COLOURS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {errors.colour && <p className="text-xs text-[var(--color-error)]">{errors.colour.message}</p>}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Button variant="outline" type="button" onClick={() => router.push('/onboarding/personal-docs')}>
            {t('common.back')}
          </Button>
          <Button size="lg" type="submit">
            {t('common.continue')}
          </Button>
        </div>
      </form>
    </div>
  )
}
