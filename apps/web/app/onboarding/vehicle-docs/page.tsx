'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { DocumentSlot } from '@/components/driver/DocumentSlot'
import { useOnboardingStore } from '@/stores/onboardingStore'

export default function VehicleDocsPage() {
  const router = useRouter()
  const { vehicleDocs, updateVehicleDoc, setStep } = useOnboardingStore()

  const allUploaded = vehicleDocs.every((d) => d.status !== 'empty')

  const handleUpload = (docId: string, file: File) => {
    updateVehicleDoc(docId, {
      status: 'uploaded',
      fileName: file.name,
      fileUrl: URL.createObjectURL(file),
      uploadedAt: new Date().toISOString(),
    })
  }

  const handleSubmit = () => {
    setStep(4)
    router.push('/onboarding/confirmation')
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-8">
        <h1 className="mb-2 font-display text-3xl text-[var(--color-navy)]">Vehicle Documents</h1>
        <p className="text-[var(--color-muted)]">
          Upload valid documents for your registered vehicle.
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
          Back
        </Button>
        <Button
          size="lg"
          disabled={!allUploaded}
          onClick={handleSubmit}
        >
          Submit Application
        </Button>
      </div>
    </div>
  )
}
