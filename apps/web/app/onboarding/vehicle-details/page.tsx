'use client'

import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Car, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, FieldError, fieldStateClasses } from '@/components/ui/input'
import {
  vehicleDetailsSchema,
  VEHICLE_MIN_YEAR,
  type VehicleDetailsFormData,
} from '@teeko/shared/schemas/onboarding'
import { formatPlate } from '@teeko/shared/utils/plate'
import { useOnboardingStore } from '@/stores/onboardingStore'
import { cn } from '@/lib/utils'
import { useFieldError } from '@/lib/useFieldError'

const currentYear = new Date().getFullYear()

const SELECT_CLASS =
  'h-11 rounded-[var(--radius-md)] border bg-white px-3.5 text-sm text-[var(--color-text)] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--color-teal)] focus:border-transparent'

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

  const OTHER = t('common.other')

  // If a saved make isn't one of the listed brands, treat it as a custom "Other" entry.
  const savedMake = vehicleDetails?.make
  const isSavedMakeCustom = !!savedMake && !MAKES.includes(savedMake)
  // Plate is stored canonical ('WKK1234'); show it spaced the way JPJ prints it.
  const defaultValues = vehicleDetails
    ? {
        ...vehicleDetails,
        plateNumber: formatPlate(vehicleDetails.plateNumber),
        ...(isSavedMakeCustom ? { make: OTHER, makeOther: savedMake } : {}),
      }
    : undefined

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<VehicleDetailsFormData>({
    resolver: zodResolver(vehicleDetailsSchema),
    defaultValues,
  })
  const fieldError = useFieldError()
  // validation.yearMin interpolates the cutoff; every other key is plain.
  const yearError = fieldError(errors.year?.message, { year: VEHICLE_MIN_YEAR })
  const makeError = fieldError(errors.make?.message)
  const colourError = fieldError(errors.colour?.message)

  const isOtherMake = watch('make') === OTHER

  // Local-only: vehicle details are stored client-side and committed at final submit.
  const onSubmit = (data: VehicleDetailsFormData) => {
    let make = data.make
    if (data.make === OTHER) {
      const custom = data.makeOther?.trim()
      if (!custom) {
        setError('makeOther', { message: 'validation.makeOtherRequired' })
        return
      }
      make = custom
    }

    setVehicleDetails({ ...data, make })
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
        {t('onboarding.vehicleDetails.yearRestriction', { start: VEHICLE_MIN_YEAR, end: currentYear })}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white p-6 shadow-[var(--shadow-sm)]">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            {t('onboarding.vehicleDetails.infoHeading')}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Make */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="make" className="text-sm font-medium text-[var(--color-text)]">
                {t('onboarding.vehicleDetails.make')} <span className="ml-1 text-[var(--color-error)]">*</span>
              </label>
              <select id="make" className={cn(SELECT_CLASS, fieldStateClasses(makeError))} {...register('make')}>
                <option value="">{t('onboarding.vehicleDetails.selectMake')}</option>
                {MAKES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <FieldError error={makeError} />
            </div>

            {isOtherMake && (
              <div className="sm:col-span-2">
                <Input
                  label={t('onboarding.vehicleDetails.makeOther')}
                  placeholder={t('onboarding.vehicleDetails.makeOtherPlaceholder')}
                  required
                  error={fieldError(errors.makeOther?.message)}
                  {...register('makeOther')}
                />
              </div>
            )}

            <Input
              label={t('onboarding.vehicleDetails.model')}
              placeholder="e.g. Myvi, Vios, City"
              required
              error={fieldError(errors.model?.message)}
              {...register('model')}
            />

            <Input
              label={t('onboarding.vehicleDetails.year')}
              type="number"
              placeholder={`e.g. ${currentYear - 2}`}
              required
              min={VEHICLE_MIN_YEAR}
              max={currentYear}
              error={yearError}
              {...register('year', { valueAsNumber: true })}
            />

            <Input
              label={t('onboarding.vehicleDetails.plate')}
              placeholder="e.g. WKK 1234"
              required
              error={fieldError(errors.plateNumber?.message)}
              style={{ textTransform: 'uppercase' }}
              {...register('plateNumber')}
            />

            {/* Colour */}
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label htmlFor="colour" className="text-sm font-medium text-[var(--color-text)]">
                {t('onboarding.vehicleDetails.colour')} <span className="ml-1 text-[var(--color-error)]">*</span>
              </label>
              <select id="colour" className={cn(SELECT_CLASS, fieldStateClasses(colourError))} {...register('colour')}>
                <option value="">{t('onboarding.vehicleDetails.selectColour')}</option>
                {COLOURS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <FieldError error={colourError} />
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
