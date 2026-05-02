'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DocumentSlot } from '@/components/driver/DocumentSlot'
import { useApplicationStatusStore } from '@/stores/applicationStatusStore'
import { useWebAuthStore } from '@/stores/authStore'

interface Props {
  params: Promise<{ docId: string }>
}

export default function ResubmitPage({ params }: Props) {
  const { docId } = use(params)
  const router = useRouter()
  const { personalDocs, vehicleDocs, resubmitDoc } = useApplicationStatusStore()
  const { profile } = useWebAuthStore()

  const allDocs = [...personalDocs, ...vehicleDocs]
  const doc = allDocs.find((d) => d.id === docId)

  if (!doc) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <p className="mb-4 text-[var(--color-muted)]">Document not found.</p>
        <Link href="/dashboard"><Button variant="outline">Back to Dashboard</Button></Link>
      </div>
    )
  }

  const handleUpload = (id: string, file: File) => {
    if (!profile) return
    resubmitDoc(id, file, profile.id)
  }

  const isResubmitted = doc.status === 'uploaded' || doc.status === 'under_review'

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-6 py-10">
      {/* Back */}
      <Link
        href="/dashboard"
        className="mb-8 flex items-center gap-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      <div className="animate-fade-up">
        <h1 className="mb-2 font-display text-3xl text-[var(--color-navy)]">Resubmit Document</h1>
        <p className="mb-8 text-[var(--color-muted)]">
          Upload a replacement for <strong>{doc.label}</strong>
        </p>

        {/* Rejection reason */}
        {doc.rejectionReason && !isResubmitted && (
          <div className="mb-6 flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--color-error)]/30 bg-[var(--color-error-light)] p-5">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-[var(--color-error)]" />
            <div>
              <p className="font-semibold text-[var(--color-error)]">Rejection reason</p>
              <p className="mt-1 text-sm text-[var(--color-error)]/80">{doc.rejectionReason}</p>
            </div>
          </div>
        )}

        {isResubmitted ? (
          <div className="rounded-[var(--radius-xl)] border border-emerald-200 bg-emerald-50 p-8 text-center">
            <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-600" />
            <h2 className="mb-2 font-display text-2xl text-emerald-800">Document Resubmitted</h2>
            <p className="mb-6 text-emerald-700">
              Your {doc.label} has been resubmitted and is now under review.
            </p>
            <Link href="/dashboard">
              <Button variant="navy" size="lg">Return to Dashboard</Button>
            </Link>
          </div>
        ) : (
          <>
            <DocumentSlot
              doc={doc}
              onUpload={handleUpload}
              editable
            />
            <div className="mt-6 text-center">
              <p className="text-xs text-[var(--color-muted)]">
                Accepted formats: JPG, PNG, PDF · Max 10 MB
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
