'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/form-error'
import { DocumentSlot } from '@/components/driver/DocumentSlot'
import { useOnboardingStore } from '@/stores/onboardingStore'
import { useWebAuthStore } from '@/stores/authStore'
import { api, ApiError } from '@/lib/api'

export default function VehicleDocsPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const {
    personalDocs,
    vehicleDocs,
    uploadVehicleDoc,
    setStep,
    markSubmitted,
    vehicleDetails,
    personalFiles,
    vehicleFiles,
  } = useOnboardingStore()
  const driverId = useWebAuthStore((s) => s.profile?.id ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allUploaded = vehicleDocs.every((d) => d.status !== 'empty')

  const handleUpload = (docId: string, file: File) => {
    uploadVehicleDoc(docId, file)
  }

  // Final step: commit everything (vehicle details + all document files) in one
  // batch request. This is the only onboarding call that writes to the DB.
  const handleSubmit = async () => {
    setError(null)

    if (!vehicleDetails) {
      setError(t('onboarding.vehicleDocs.errors.noVehicleDetails'))
      return
    }

    setSubmitting(true)
    try {
      await api.submitOnboarding(
        driverId,
        {
          plateNumber: vehicleDetails.plateNumber,
          make: vehicleDetails.make,
          model: vehicleDetails.model,
          year: Number(vehicleDetails.year),
          colour: vehicleDetails.colour,
        },
        { ...personalFiles, ...vehicleFiles },
      )
      markSubmitted()
      setStep(4)
      router.push('/onboarding/confirmation')
    } catch (err) {
      if (err instanceof ApiError && err.message === 'incomplete_documents') {
        // The server names the missing slots by frontend id; show their labels
        // so the driver knows which card to go back to. The usual cause is a
        // page refresh: File objects live only in memory, so personal-docs
        // uploads are gone even though this page still looks complete.
        const missing = err.body.missing as { personal?: string[]; vehicle?: string[] } | undefined
        const ids = [...(missing?.personal ?? []), ...(missing?.vehicle ?? [])]
        const labels = [...personalDocs, ...vehicleDocs]
          .filter((d) => ids.includes(d.id))
          .map((d) => d.label)
        setError(
          labels.length
            ? `${t('onboarding.vehicleDocs.incompleteError')} ${t('onboarding.vehicleDocs.missingList', { docs: labels.join(', ') })}`
            : t('onboarding.vehicleDocs.incompleteError')
        )
        return
      }

      if (err instanceof ApiError) {
        const labelFor = (id: unknown) =>
          [...personalDocs, ...vehicleDocs].find((d) => d.id === id)?.label ?? String(id ?? '')
        switch (err.message) {
          case 'vehicle_exists':
            setError(t('onboarding.vehicleDocs.errors.vehicleExists'))
            return
          case 'plate_taken':
            setError(t('onboarding.vehicleDocs.errors.plateTaken', { plate: String(err.body.plateNumber ?? '') }))
            return
          case 'invalid_vehicle':
            setError(t('onboarding.vehicleDocs.errors.invalidVehicle', { field: String(err.body.field ?? '') }))
            return
          case 'file_too_large':
            setError(t('onboarding.vehicleDocs.errors.fileTooLarge', { doc: labelFor(err.body.field) }))
            return
          case 'file_invalid_type':
            setError(t('onboarding.vehicleDocs.errors.fileInvalidType', { doc: labelFor(err.body.field) }))
            return
          case 'application_not_found':
            setError(t('onboarding.vehicleDocs.errors.applicationNotFound'))
            return
        }
        // Unknown code (upload_failed, submit_failed, 401/413 from the proxy…):
        // keep the generic copy but append the code so support can act on it.
        setError(`${t('onboarding.vehicleDocs.submitError')} (${err.message}${err.status ? `, HTTP ${err.status}` : ''})`)
        return
      }

      // Not an HTTP error at all — fetch itself failed (offline, CORS, timeout).
      setError(t('onboarding.vehicleDocs.errors.network'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-8">
        <h1 className="mb-2 font-display text-3xl text-[var(--color-navy)]">{t('onboarding.vehicleDocs.title')}</h1>
        <p className="text-[var(--color-muted)]">
          {t('onboarding.vehicleDocs.subtitle')}
        </p>
      </div>

      <div className="space-y-4">
        {vehicleDocs.map((doc) => (
          <DocumentSlot
            key={doc.id}
            doc={doc}
            onUpload={handleUpload}
          />
        ))}
      </div>

      <FormError message={error} className="mt-6" />

      <div className="mt-8 flex items-center justify-between">
        <Button variant="outline" onClick={() => router.push('/onboarding/vehicle-details')}>
          {t('common.back')}
        </Button>
        <Button
          size="lg"
          disabled={!allUploaded || submitting}
          onClick={handleSubmit}
        >
          {submitting ? t('common.submitting') : t('common.submit')}
        </Button>
      </div>
    </div>
  )
}
