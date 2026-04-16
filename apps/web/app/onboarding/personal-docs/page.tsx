'use client'

import { useRouter } from 'next/navigation'
import { Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DocumentSlot } from '@/components/driver/DocumentSlot'
import { useOnboardingStore } from '@/stores/onboardingStore'

export default function PersonalDocsPage() {
  const router = useRouter()
  const { personalDocs, updatePersonalDoc, setStep } = useOnboardingStore()

  const allUploaded = personalDocs.every((d) => d.status !== 'empty')

  const handleUpload = (docId: string, file: File) => {
    updatePersonalDoc(docId, {
      status: 'uploaded',
      fileName: file.name,
      fileUrl: URL.createObjectURL(file),
      uploadedAt: new Date().toISOString(),
    })
  }

  const handleNext = () => {
    setStep(2)
    router.push('/onboarding/vehicle-details')
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-8">
        <h1 className="mb-2 font-display text-3xl text-[var(--color-navy)]">Personal Documents</h1>
        <p className="text-[var(--color-muted)]">
          Upload clear photos or scans of all required documents.
        </p>
      </div>

      <div className="mb-4 flex items-start gap-2 rounded-[var(--radius-md)] border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <span>Ensure all documents are clear, unexpired, and match the name on your NRIC. Low-quality or expired documents will be rejected.</span>
      </div>

      <div className="space-y-4">
        {personalDocs.map((doc) => (
          <DocumentSlot
            key={doc.id}
            doc={doc}
            onUpload={handleUpload}
          />
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <Button variant="outline" onClick={() => router.push('/onboarding/agreement')}>
          Back
        </Button>
        <Button
          size="lg"
          disabled={!allUploaded}
          onClick={handleNext}
        >
          Continue to Vehicle Details
        </Button>
      </div>

      {!allUploaded && (
        <p className="mt-3 text-center text-xs text-[var(--color-muted)]">
          Upload all {personalDocs.length} documents to continue
        </p>
      )}
    </div>
  )
}
