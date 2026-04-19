'use client'

import { CheckCircle2, Clock, XCircle, AlertCircle, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge, statusVariant, statusLabel } from '@/components/ui/badge'
import type { ApplicationStatus } from '@teeko/shared/types'

interface StageProps {
  index: number
  title: string
  status: string
  detail?: string
  isLast?: boolean
}

function Stage({ index, title, status, detail, isLast }: StageProps) {
  const isApproved = status === 'approved' || status === 'active'
  const isRejected = status === 'rejected' || status === 'suspended'
  const isActive = status === 'in_progress' || status === 'submitted' || status === 'under_review'
  const isPending = !isApproved && !isRejected && !isActive

  return (
    <div className="flex gap-4">
      {/* Timeline */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2',
            isApproved
              ? 'border-[var(--color-teal)] bg-[var(--color-teal)]'
              : isRejected
              ? 'border-[var(--color-error)] bg-[var(--color-error-light)]'
              : isActive
              ? 'border-[var(--color-info)] bg-blue-50'
              : 'border-[var(--color-border-dark)] bg-[var(--color-surface)]'
          )}
        >
          {isApproved && <CheckCircle2 className="h-5 w-5 text-[var(--color-navy)]" />}
          {isRejected && <XCircle className="h-5 w-5 text-[var(--color-error)]" />}
          {isActive && <Clock className="h-5 w-5 text-[var(--color-info)]" />}
          {isPending && <Circle className="h-5 w-5 text-[var(--color-placeholder)]" />}
        </div>
        {!isLast && (
          <div
            className={cn(
              'my-1 w-0.5 flex-1',
              isApproved ? 'bg-[var(--color-teal)]' : 'bg-[var(--color-border)]'
            )}
            style={{ minHeight: '32px' }}
          />
        )}
      </div>

      {/* Content */}
      <div className="pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-[var(--color-text)]">{title}</span>
          <Badge variant={statusVariant(status)}>{statusLabel(status)}</Badge>
        </div>
        {detail && <p className="mt-1 text-sm text-[var(--color-muted)]">{detail}</p>}
      </div>
    </div>
  )
}

interface StatusTrackerProps {
  status: ApplicationStatus
}

export function StatusTracker({ status }: StatusTrackerProps) {
  const evpDetail =
    status.evpApplication !== 'not_started'
      ? `Submitted to ${status.evpBody ?? 'APAD'} · Approval takes 5–7 working days`
      : 'Will be submitted after document review is complete'

  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white p-6 shadow-[var(--shadow-md)]">
      <h2 className="mb-6 font-display text-xl text-[var(--color-navy)]">Application Progress</h2>
      <Stage
        index={1}
        title="Document Review"
        status={status.docReview}
        detail="Our team reviews your documents within 1–3 working days"
      />
      <Stage
        index={2}
        title="EVP Application"
        status={status.evpApplication}
        detail={evpDetail}
      />
      <Stage
        index={3}
        title="Account Activation"
        status={status.accountStatus}
        detail={
          status.accountStatus === 'active'
            ? `Activated on ${status.activatedDate ? new Date(status.activatedDate).toLocaleDateString('en-MY') : '—'}`
            : 'You will be notified to download the Teeko Driver app'
        }
        isLast
      />
    </div>
  )
}
