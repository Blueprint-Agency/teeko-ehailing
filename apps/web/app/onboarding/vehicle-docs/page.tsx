'use client'

import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { DocumentSlot } from '@/components/driver/DocumentSlot'
import { useOnboardingStore } from '@/stores/onboardingStore'
import { useWebAuthStore } from '@/stores/authStore'

export default function VehicleDocsPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const { vehicleDocs, uploadVehicleDoc, setStep } = useOnboardingStore()
  const driverId = useWebAuthStore((s) => s.profile?.id ?? '')

  const allUploaded = vehicleDocs.every((d) => d.status !== 'empty')

  const handleUpload = (docId: string, file: File) => {
    uploadVehicleDoc(docId, file, driverId).catch(console.error)
  }

  const handleSubmit = () => {
    setStep(4)
    router.push('/onboarding/confirmation')
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

      <div className="mt-8 flex items-center justify-between">
        <Button variant="outline" onClick={() => router.push('/onboarding/vehicle-details')}>
          {t('common.back')}
        </Button>
        <Button
          size="lg"
          disabled={!allUploaded}
          onClick={handleSubmit}
        >
          {t('common.submit')}
        </Button>
      </div>
    </div>
  )
}
