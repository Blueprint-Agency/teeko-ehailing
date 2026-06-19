'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { DocumentSlot } from '@/components/driver/DocumentSlot'
import { useOnboardingStore } from '@/stores/onboardingStore'
import { useWebAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'

export default function VehicleDocsPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const {
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
      setError(t('onboarding.vehicleDocs.submitError'))
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
      setError(
        err instanceof Error && err.message === 'incomplete_documents'
          ? t('onboarding.vehicleDocs.incompleteError')
          : t('onboarding.vehicleDocs.submitError')
      )
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

      {error && (
        <p className="mt-6 rounded-[var(--radius-md)] border border-[var(--color-error)]/30 bg-[var(--color-error-light)] px-4 py-3 text-sm text-[var(--color-error)]">
          {error}
        </p>
      )}

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
